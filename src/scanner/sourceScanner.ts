import { rangeAt, type SourceDocument } from "../core/document.js";
import type { Range } from "../types.js";

export interface RawDollarToken {
  kind: "single" | "double";
  offset: number;
  endOffset: number;
  range: Range;
}

export interface RawDollarPair {
  id: string;
  kind: "inline" | "display";
  open: RawDollarToken;
  close: RawDollarToken;
  range: Range;
  content: string;
}

export interface RawBracketToken {
  kind: "inline" | "display";
  opening: boolean;
  offset: number;
  endOffset: number;
  range: Range;
}

export interface RawBracketPair {
  id: string;
  kind: "inline" | "display";
  open: RawBracketToken;
  close: RawBracketToken;
  range: Range;
  content: string;
}

export interface ScanResult {
  tokens: RawDollarToken[];
  pairs: RawDollarPair[];
  unmatched: RawDollarToken[];
  bracketPairs: RawBracketPair[];
  unmatchedBrackets: RawBracketToken[];
  codeDollarRanges: Range[];
  githubDelimiterRanges: Range[];
}

function isEscaped(text: string, offset: number): boolean {
  let slashes = 0;
  for (let index = offset - 1; index >= 0 && text[index] === "\\"; index -= 1) slashes += 1;
  return slashes % 2 === 1;
}

function isShellVariable(text: string, offset: number): boolean {
  const tail = text.slice(offset);
  if (/^\$\{[^}\n]+\}/.test(tail) || /^\$[#@?*!$-]/.test(tail)) return true;
  const variable = tail.match(/^\$([A-Za-z_][A-Za-z0-9_]*)/)?.[1];
  if (!variable) return false;
  const next = text[offset + variable.length + 1];
  if (/^[A-Z_][A-Z0-9_]*$/.test(variable)) {
    return !next || !"$=+-*/^{}()[\\]".includes(next);
  }
  return variable.includes("_") && variable.length > 1;
}

function protectedOffsets(document: SourceDocument): { protectedSet: Set<number>; codeSet: Set<number> } {
  const protectedSet = new Set<number>();
  const codeSet = new Set<number>();
  let fence: { marker: string; markdown: boolean } | undefined;
  let frontmatter = document.lines[0]?.trim() === "---";
  let htmlComment = false;

  document.lines.forEach((line, lineIndex) => {
    const start = document.lineOffsets[lineIndex];
    if (frontmatter) {
      for (let i = 0; i < line.length; i += 1) protectedSet.add(start + i);
      if (lineIndex > 0 && line.trim() === "---") frontmatter = false;
      return;
    }
    const fenceMatch = line.match(/^\s*(```+|~~~+)(.*)$/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!fence) fence = { marker, markdown: /\b(?:md|markdown)\b/i.test(fenceMatch[2]) };
      else if (fence.marker === marker) fence = undefined;
      for (let i = 0; i < line.length; i += 1) protectedSet.add(start + i);
      return;
    }
    if (fence) {
      for (let i = 0; i < line.length; i += 1) {
        protectedSet.add(start + i);
        if (fence.markdown && line[i] === "$" && !isEscaped(line, i)) codeSet.add(start + i);
      }
      return;
    }
    for (let i = 0; i < line.length; i += 1) {
      if (line.slice(i, i + 4) === "<!--") htmlComment = true;
      if (htmlComment) protectedSet.add(start + i);
      if (line.slice(i, i + 3) === "-->") {
        protectedSet.add(start + i + 1);
        protectedSet.add(start + i + 2);
        htmlComment = false;
        i += 2;
      }
    }
    for (const match of line.matchAll(/(`+)([\s\S]*?)\1/g)) {
      const from = start + (match.index ?? 0);
      const github = /^\$`[\s\S]*`\$$/.test(match[0]);
      if (github) continue;
      for (let i = from; i < from + match[0].length; i += 1) {
        protectedSet.add(i);
        if (document.text[i] === "$") codeSet.add(i);
      }
    }
  });
  return { protectedSet, codeSet };
}

export function scanSource(document: SourceDocument, excludedRanges: Range[] = []): ScanResult {
  const { protectedSet, codeSet } = protectedOffsets(document);
  excludedRanges.forEach((range) => {
    for (let offset = range.start.offset; offset < range.end.offset; offset += 1) protectedSet.add(offset);
  });
  const tokens: RawDollarToken[] = [];
  const bracketTokens: RawBracketToken[] = [];
  const githubDelimiterRanges: Range[] = [];
  for (const match of document.text.matchAll(/\$`[^`\n]+`\$/g)) {
    if (protectedSet.has(match.index!) || protectedSet.has(match.index! + match[0].length - 1)) continue;
    githubDelimiterRanges.push(rangeAt(document, match.index!, match.index! + match[0].length));
    for (let i = match.index!; i < match.index! + match[0].length; i += 1) protectedSet.add(i);
  }
  for (let offset = 0; offset < document.text.length; offset += 1) {
    if (
      document.text[offset] === "\\" &&
      !protectedSet.has(offset) &&
      !isEscaped(document.text, offset) &&
      ["(", ")", "[", "]"].includes(document.text[offset + 1])
    ) {
      const char = document.text[offset + 1];
      bracketTokens.push({
        kind: char === "(" || char === ")" ? "inline" : "display",
        opening: char === "(" || char === "[",
        offset,
        endOffset: offset + 2,
        range: rangeAt(document, offset, offset + 2),
      });
      offset += 1;
      continue;
    }
    if (document.text[offset] !== "$" || protectedSet.has(offset) || isEscaped(document.text, offset)) continue;
    const double = document.text[offset + 1] === "$" && !protectedSet.has(offset + 1);
    if (!double && isShellVariable(document.text, offset)) continue;
    const length = double ? 2 : 1;
    tokens.push({
      kind: double ? "double" : "single",
      offset,
      endOffset: offset + length,
      range: rangeAt(document, offset, offset + length),
    });
    if (double) offset += 1;
  }
  const stacks: Record<"single" | "double", RawDollarToken[]> = { single: [], double: [] };
  const pairs: RawDollarPair[] = [];
  tokens.forEach((token) => {
    const stack = stacks[token.kind];
    const open = stack.pop();
    if (!open) {
      stack.push(token);
      return;
    }
    if (token.kind === "double" && open.endOffset === token.offset) {
      stack.push(open);
      return;
    }
    const kind = token.kind === "double" ? "display" : "inline";
    pairs.push({
      id: `raw-${pairs.length}`,
      kind,
      open,
      close: token,
      range: rangeAt(document, open.offset, token.endOffset),
      content: document.text.slice(open.endOffset, token.offset),
    });
  });
  const codeDollarRanges = [...codeSet].map((offset) => rangeAt(document, offset, offset + 1));
  const bracketStacks: Record<"inline" | "display", RawBracketToken[]> = { inline: [], display: [] };
  const bracketPairs: RawBracketPair[] = [];
  const unmatchedBrackets: RawBracketToken[] = [];
  bracketTokens.forEach((token) => {
    if (token.opening) {
      bracketStacks[token.kind].push(token);
      return;
    }
    const open = bracketStacks[token.kind].pop();
    if (!open) {
      unmatchedBrackets.push(token);
      return;
    }
    bracketPairs.push({
      id: `bracket-${bracketPairs.length}`,
      kind: token.kind,
      open,
      close: token,
      range: rangeAt(document, open.offset, token.endOffset),
      content: document.text.slice(open.endOffset, token.offset),
    });
  });
  unmatchedBrackets.push(...bracketStacks.inline, ...bracketStacks.display);
  return {
    tokens,
    pairs: pairs.sort((a, b) => a.open.offset - b.open.offset),
    unmatched: [...stacks.single, ...stacks.double].sort((a, b) => a.offset - b.offset),
    bracketPairs,
    unmatchedBrackets: unmatchedBrackets.sort((a, b) => a.offset - b.offset),
    codeDollarRanges,
    githubDelimiterRanges,
  };
}
