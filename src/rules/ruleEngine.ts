import { positionAt, rangeAt, type SourceDocument } from "../core/document.js";
import { safeKatexCheck } from "../math/safeKatexCheck.js";
import type { MarkdownItMathSpan } from "../parser/markdownItAdapter.js";
import type { ParsedMathSpan } from "../parser/remarkAdapter.js";
import type { RawDollarPair, ScanResult } from "../scanner/sourceScanner.js";
import type { Diagnostic, Fix, KatexOptions, ProfileName, RuleSetting, Severity } from "../types.js";

interface EngineOptions {
  profile: ProfileName;
  settings: Record<string, RuleSetting>;
  katex: KatexOptions;
  fixOptions: { inlineSpacing: boolean; displayOwnLine: boolean; currencyDollar: boolean };
}

interface ParserComparison {
  selected: MarkdownItMathSpan[];
  texmath: MarkdownItMathSpan[];
  dollarmath: MarkdownItMathSpan[];
}

interface FormulaContent {
  content: string;
  offset: number;
}

function intersects(left: Diagnostic, right: Diagnostic): boolean {
  return left.range.start.offset <= right.range.end.offset && right.range.start.offset <= left.range.end.offset;
}

function diagnostic(
  settings: Record<string, RuleSetting>,
  code: string,
  message: string,
  range: Diagnostic["range"],
  help?: string,
  fixes?: Fix[],
  spanId?: string,
): Diagnostic | undefined {
  const severity = settings[code];
  if (!severity || severity === "off") return undefined;
  return { code, severity, message, range, help, fixes, spanId };
}

function recognized(pair: RawDollarPair, parsed: ParsedMathSpan[]): boolean {
  return parsed.some(
    (span) =>
      span.kind === pair.kind &&
      span.range.start.offset <= pair.open.offset &&
      span.range.end.offset >= pair.close.endOffset,
  );
}

function add(target: Diagnostic[], value: Diagnostic | undefined): void {
  if (value) target.push(value);
}

function ownLine(document: SourceDocument, offset: number, length: number): boolean {
  const position = positionAt(document, offset);
  return document.lines[position.line - 1].trim() === "$".repeat(length);
}

function displayOwnLineFix(document: SourceDocument, pair: RawDollarPair): Fix | undefined {
  if (pair.open.range.start.line !== pair.close.range.start.line) return undefined;
  const replacement = `\n\n$$\n${pair.content.trim()}\n$$\n\n`;
  return {
    title: "split display math into its own block",
    range: pair.range,
    replacement,
    code: "MDM003",
  };
}

function blankLineFixes(document: SourceDocument, pair: RawDollarPair): Fix[] {
  const fixes: Fix[] = [];
  const openingLine = pair.open.range.start.line - 1;
  const closingLine = pair.close.range.start.line - 1;
  if (openingLine > 0 && document.lines[openingLine - 1].trim() !== "") {
    const offset = document.lineOffsets[openingLine];
    fixes.push({ title: "add blank line before display math", range: rangeAt(document, offset, offset), replacement: "\n", code: "MDM004" });
  }
  if (closingLine < document.lines.length - 1 && document.lines[closingLine + 1].trim() !== "") {
    const offset = pair.close.range.end.offset;
    const lineEnd = document.text.indexOf("\n", offset);
    const insertion = lineEnd === -1 ? document.text.length : lineEnd + 1;
    fixes.push({ title: "add blank line after display math", range: rangeAt(document, insertion, insertion), replacement: "\n", code: "MDM004" });
  }
  return fixes;
}

function spacingFix(document: SourceDocument, pair: RawDollarPair, before: boolean, after: boolean): Fix[] {
  const fixes: Fix[] = [];
  if (after) fixes.push({ title: "add space after inline math", range: rangeAt(document, pair.close.endOffset, pair.close.endOffset), replacement: " ", code: "MDM005" });
  if (before) fixes.push({ title: "add space before inline math", range: rangeAt(document, pair.open.offset, pair.open.offset), replacement: " ", code: "MDM005" });
  return fixes;
}

function isAdjacent(char: string | undefined): boolean {
  return Boolean(char && /[\p{L}\p{N}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(char));
}

function braceBalance(text: string): number {
  let balance = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\\" && ["{", "}"].includes(text[index + 1])) {
      index += 1;
      continue;
    }
    if (text[index] === "{") balance += 1;
    if (text[index] === "}") balance -= 1;
  }
  return balance;
}

function formulaContents(scan: ScanResult): FormulaContent[] {
  return [
    ...scan.pairs.map((pair) => ({ content: pair.content, offset: pair.open.endOffset })),
    ...scan.bracketPairs.map((pair) => ({ content: pair.content, offset: pair.open.endOffset })),
  ];
}

export function runRules(
  document: SourceDocument,
  scan: ScanResult,
  parsed: ParsedMathSpan[],
  tableRanges: Diagnostic["range"][],
  markdownIt: ParserComparison | undefined,
  options: EngineOptions,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const settings = options.settings;
  const formulas = formulaContents(scan);

  const singleTokens = scan.tokens.filter((token) => token.kind === "single");
  for (let index = 0; index <= singleTokens.length - 4; index += 1) {
    const [outerOpen, innerOpen, innerClose, outerClose] = singleTokens.slice(index, index + 4);
    const left = document.text.slice(outerOpen.endOffset, innerOpen.offset);
    const right = document.text.slice(innerClose.endOffset, outerClose.offset);
    if (braceBalance(left) > 0 && braceBalance(right) < 0 && braceBalance(`${left}${right}`) === 0) {
      add(diagnostics, diagnostic(
        settings,
        "MDM017",
        "inline math appears to contain nested $...$ delimiters",
        rangeAt(document, outerOpen.offset, outerClose.endOffset),
        "Use a single math span and remove the nested dollar delimiters.",
      ));
      index += 3;
    }
  }

  formulas.forEach((formula) => {
    for (const match of formula.content.matchAll(/\\(?:choose|over|atop)\b/g)) {
      const offset = formula.offset + (match.index ?? 0);
      add(diagnostics, diagnostic(
        settings,
        "MDM018",
        `TeX primitive ${match[0]} is not portable between KaTeX and MathJax`,
        rangeAt(document, offset, offset + match[0].length),
        "Prefer \\binom, \\frac, or another portable LaTeX command.",
      ));
    }
  });

  const labels = new Set<string>();
  formulas.forEach((formula) => {
    for (const match of formula.content.matchAll(/\\label\s*\{([^{}]+)\}/g)) labels.add(match[1]);
  });
  formulas.forEach((formula) => {
    for (const match of formula.content.matchAll(/\\(?:eq)?ref\s*\{([^{}]+)\}/g)) {
      if (labels.has(match[1])) continue;
      const offset = formula.offset + (match.index ?? 0);
      add(diagnostics, diagnostic(
        settings,
        "MDM019",
        `reference to undefined label "${match[1]}"`,
        rangeAt(document, offset, offset + match[0].length),
        "Define the referenced label in this document or correct the reference name.",
      ));
    }
  });

  scan.unmatched.forEach((token) => {
    const code = token.kind === "single" ? "MDM001" : "MDM002";
    add(diagnostics, diagnostic(settings, code, token.kind === "single" ? "unclosed inline math delimiter" : "unclosed display math delimiter", token.range, "Close the delimiter or escape a literal dollar sign."));
  });
  scan.unmatchedBrackets.forEach((token) => {
    const code = token.kind === "inline" ? "MDM001" : "MDM002";
    add(diagnostics, diagnostic(settings, code, `unclosed ${token.kind} math delimiter`, token.range, "Close the delimiter or escape a literal delimiter."));
  });

  scan.unmatched.forEach((token) => {
    if (token.kind !== "single" || !/^\$\d+(?:,\d{3})*(?:\.\d+)?(?:\b|$)/.test(document.text.slice(token.offset))) return;
    const prior = document.text.slice(0, token.offset).match(/\S(?=\s*$)/)?.[0];
    if (prior && /[A-Z]/.test(prior)) return;
    const fixes = options.fixOptions.currencyDollar
      ? [{ title: "escape currency dollar", range: rangeAt(document, token.offset, token.offset), replacement: "\\", code: "MDM006" }]
      : undefined;
    add(diagnostics, diagnostic(settings, "MDM006", "possible currency dollar sign may interfere with math parsing", token.range, "Escape literal currency as \\$ when math is also present.", fixes));
  });

  scan.codeDollarRanges.forEach((range) => {
    add(diagnostics, diagnostic(settings, "MDM007", "math delimiter in Markdown code example is not rendered", range, "This is fine when the code block intentionally documents math syntax."));
  });

  scan.pairs.forEach((pair) => {
    const remarkRecognized = recognized(pair, parsed);
    const markdownItRecognized = markdownIt?.selected.some((span) => span.pairId === pair.id) ?? false;
    const parsedPair = options.profile === "markdown-it" ? markdownItRecognized : remarkRecognized;
    if (!parsedPair) {
      add(diagnostics, diagnostic(settings, "MDM015", "raw math delimiter was not recognized by the Markdown parser", pair.range, "Use portable math delimiter placement.", undefined, pair.id));
    }
    if (markdownIt) {
      const texmathRecognized = markdownIt.texmath.some((span) => span.pairId === pair.id);
      const dollarmathRecognized = markdownIt.dollarmath.some((span) => span.pairId === pair.id);
      if (new Set([remarkRecognized, texmathRecognized, dollarmathRecognized]).size > 1) {
        add(diagnostics, diagnostic(settings, "MDM014", "math delimiter is interpreted differently by Markdown parsers", pair.range, "Compare the target rendering profile before publishing.", undefined, pair.id));
      }
    }
    if (pair.kind === "display") {
      const openOwn = ownLine(document, pair.open.offset, 2);
      const closeOwn = ownLine(document, pair.close.offset, 2);
      if (!openOwn || !closeOwn) {
        const fix = options.fixOptions.displayOwnLine ? displayOwnLineFix(document, pair) : undefined;
        add(diagnostics, diagnostic(settings, "MDM003", "display math delimiter should be on its own line", pair.range, "Place each $$ delimiter on a separate line.", fix ? [fix] : undefined, pair.id));
      } else {
        const fixes = blankLineFixes(document, pair);
        if (fixes.length) add(diagnostics, diagnostic(settings, "MDM004", "display math block should be separated by blank lines", pair.range, "Add blank lines around display math.", fixes, pair.id));
      }
      const involvedLines = document.lines.slice(pair.open.range.start.line - 1, pair.close.range.start.line);
      if (tableRanges.some((range) =>
        range.start.offset <= pair.range.start.offset && range.end.offset >= pair.range.end.offset,
      )) {
        add(diagnostics, diagnostic(settings, "MDM008", "display math inside a GFM table is not portable", pair.range, "Prefer inline math inside table cells.", undefined, pair.id));
      }
      let listIndex = pair.open.range.start.line - 2;
      while (listIndex >= 0) {
        if (document.lines[listIndex].trim() === "") {
          listIndex -= 1;
          continue;
        }
        const match = document.lines[listIndex].match(/^(\s*)(?:[-+*]|\d+\.)\s+/);
        if (match) {
          const required = match[0].length;
          const indentation = document.lines[pair.open.range.start.line - 1].match(/^\s*/)?.[0].length ?? 0;
          if (indentation < required) {
            add(diagnostics, diagnostic(settings, "MDM009", "display math in a list item needs list indentation", pair.range, `Indent the display block by at least ${required} spaces.`, undefined, pair.id));
          }
        }
        break;
      }
      const openingLine = document.lines[pair.open.range.start.line - 1];
      if (/^\s*>/.test(openingLine)) {
        const quoteLines = involvedLines.filter((line) => line.trim() !== "");
        if (quoteLines.some((line) => !/^\s*>/.test(line))) {
          add(diagnostics, diagnostic(settings, "MDM010", "blockquote display math lines must use consistent > markers", pair.range, "Prefix every display math line in the quote with >.", undefined, pair.id));
        }
      }
    } else {
      const before = document.text[pair.open.offset - 1];
      const after = document.text[pair.close.endOffset];
      const needsBefore = isAdjacent(before);
      const needsAfter = isAdjacent(after);
      if (needsBefore || needsAfter) {
        add(diagnostics, diagnostic(settings, "MDM005", "inline math should be separated from adjacent text", pair.range, "Add spaces around inline math.", options.fixOptions.inlineSpacing ? spacingFix(document, pair, needsBefore, needsAfter) : undefined, pair.id));
      }
      if (pair.content.includes("\n")) {
        add(diagnostics, diagnostic(settings, "MDM011", "inline math crosses a line boundary", pair.range, "Keep inline math on one line or use display math.", undefined, pair.id));
      }
    }
  });

  scan.githubDelimiterRanges.forEach((range) => {
    if (options.profile !== "github" && options.profile !== "markdown-it") {
      add(diagnostics, diagnostic(settings, "MDM013", "GitHub backtick math delimiter is unsupported by this profile", range, "Use portable $...$ delimiters or choose the github profile."));
    }
  });

  scan.bracketPairs.forEach((pair) => {
    if (pair.kind === "inline" && pair.content.includes("\n")) {
      add(diagnostics, diagnostic(settings, "MDM011", "inline math crosses a line boundary", pair.range, "Keep inline math on one line or use display math.", undefined, pair.id));
    }
    const result = safeKatexCheck(pair.content, pair.kind === "display", options.katex);
    if (result.ok || settings.MDM012 === "off") return;
    const range = result.position === undefined
      ? rangeAt(document, pair.open.endOffset, pair.close.offset)
      : rangeAt(document, pair.open.endOffset + result.position, pair.open.endOffset + result.position + 1);
    diagnostics.push({
      code: "MDM012",
      severity: result.tooLong || result.internalError ? "info" : settings.MDM012,
      message: result.message,
      range,
      help: "Correct the TeX syntax accepted by KaTeX.",
      spanId: pair.id,
    });
  });

  parsed.forEach((span) => {
    const confirmedByRawScan = scan.pairs.some((pair) =>
      pair.kind === span.kind &&
      pair.range.start.offset === span.range.start.offset &&
      pair.range.end.offset === span.range.end.offset,
    );
    if (!confirmedByRawScan) return;
    const result = safeKatexCheck(span.content, span.kind === "display", options.katex);
    if (result.ok) return;
    const range = result.position === undefined
      ? span.contentRange
      : rangeAt(document, span.contentRange.start.offset + result.position, span.contentRange.start.offset + result.position + 1);
    const baseSeverity = settings.MDM012;
    if (baseSeverity === "off") return;
    const severity: Severity = result.tooLong || result.internalError ? "info" : baseSeverity;
    diagnostics.push({
      code: "MDM012",
      severity,
      message: result.message,
      range,
      help: result.tooLong ? "Split very large formulae before validation." : "Correct the TeX syntax accepted by KaTeX.",
      spanId: span.id,
    });
  });
  if (options.profile === "markdown-it" && markdownIt) {
    markdownIt.selected.forEach((span) => {
      const checkedByRemark = parsed.some((parsedSpan) =>
        parsedSpan.kind === span.kind &&
        parsedSpan.range.start.offset === span.range.start.offset &&
        parsedSpan.range.end.offset === span.range.end.offset,
      );
      if (checkedByRemark || settings.MDM012 === "off") return;
      const result = safeKatexCheck(span.content, span.kind === "display", options.katex);
      if (result.ok) return;
      const delimiterLength = span.kind === "display" ? 2 : 1;
      const contentOffset = span.range.start.offset + delimiterLength;
      const range = result.position === undefined
        ? rangeAt(document, contentOffset, span.range.end.offset - delimiterLength)
        : rangeAt(document, contentOffset + result.position, contentOffset + result.position + 1);
      diagnostics.push({
        code: "MDM012",
        severity: result.tooLong || result.internalError ? "info" : settings.MDM012,
        message: result.message,
        range,
        help: result.tooLong ? "Split very large formulae before validation." : "Correct the TeX syntax accepted by KaTeX.",
        spanId: span.pairId,
      });
    });
  }

  return applySuppression(diagnostics);
}

function applySuppression(diagnostics: Diagnostic[]): Diagnostic[] {
  const suppresses: Record<string, string[]> = {
    MDM001: ["MDM003", "MDM004"],
    MDM002: ["MDM003", "MDM004"],
    MDM015: ["MDM003", "MDM004", "MDM005"],
    MDM006: ["MDM005"],
    MDM007: ["MDM001", "MDM002", "MDM012"],
  };
  return diagnostics.filter((candidate) => !diagnostics.some((root) =>
    root !== candidate &&
    suppresses[root.code]?.includes(candidate.code) &&
    ((root.spanId && root.spanId === candidate.spanId) || intersects(root, candidate)),
  ));
}
