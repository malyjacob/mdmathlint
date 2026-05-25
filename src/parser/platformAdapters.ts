import type { SourceDocument } from "../core/document.js";
import type { RawDollarPair } from "../scanner/sourceScanner.js";
import type { MarkdownItMathSpan } from "./markdownItAdapter.js";

export type PlatformAdapterName = "pandoc" | "goldmark" | "obsidian";

function recognizes(document: SourceDocument, pair: RawDollarPair, adapter: PlatformAdapterName): boolean {
  if (adapter === "pandoc") {
    return pair.kind === "display" || (!/^\s|\s$/.test(pair.content) && !pair.content.includes("\n"));
  }
  if (adapter === "goldmark") {
    if (pair.kind === "inline") return false;
    const opening = document.lines[pair.open.range.start.line - 1]?.trim();
    const closing = document.lines[pair.close.range.start.line - 1]?.trim();
    return opening === "$$" && closing === "$$";
  }
  return pair.kind === "display" || !pair.content.includes("\n");
}

export function parsePlatformMath(
  document: SourceDocument,
  pairs: RawDollarPair[],
  adapter: PlatformAdapterName,
): MarkdownItMathSpan[] {
  return pairs
    .filter((pair) => recognizes(document, pair, adapter))
    .map((pair) => ({ kind: pair.kind, content: pair.content, range: pair.range, pairId: pair.id }));
}
