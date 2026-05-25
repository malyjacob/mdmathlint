import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { visit } from "unist-util-visit";
import { rangeAt, type SourceDocument } from "../core/document.js";
import type { Range } from "../types.js";

export interface ParsedMathSpan {
  id: string;
  kind: "inline" | "display";
  content: string;
  range: Range;
  contentRange: Range;
}

export interface ParsedMarkdown {
  mathSpans: ParsedMathSpan[];
  tableRanges: Range[];
  linkDestinationRanges: Range[];
}

interface PositionedNode {
  type: string;
  value?: string;
  url?: string;
  position?: {
    start: { offset?: number };
    end: { offset?: number };
  };
}

export function parseMarkdown(document: SourceDocument): ParsedMarkdown {
  const contextTree = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]).use(remarkGfm).parse(document.text);
  const mathTree = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]).use(remarkGfm).use(remarkMath).parse(document.text);
  const mathSpans: ParsedMathSpan[] = [];
  const tableRanges: Range[] = [];
  const linkDestinationRanges: Range[] = [];
  visit(contextTree, (node: PositionedNode) => {
    if (node.type === "table") {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (start !== undefined && end !== undefined) tableRanges.push(rangeAt(document, start, end));
    }
    if (node.type === "link" && node.url) {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (start !== undefined && end !== undefined) {
        const raw = document.text.slice(start, end);
        const relativeOffset = raw.lastIndexOf(node.url);
        if (relativeOffset >= 0) {
          linkDestinationRanges.push(rangeAt(document, start + relativeOffset, start + relativeOffset + node.url.length));
        }
      }
    }
  });
  visit(mathTree, (node: PositionedNode) => {
    if (node.type !== "inlineMath" && node.type !== "math") return;
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start === undefined || end === undefined) return;
    const display = node.type === "math";
    const delimiterLength = display ? 2 : 1;
    mathSpans.push({
      id: `parsed-${mathSpans.length}`,
      kind: display ? "display" : "inline",
      content: node.value ?? "",
      range: rangeAt(document, start, end),
      contentRange: rangeAt(document, start + delimiterLength, end - delimiterLength),
    });
  });
  return { mathSpans, tableRanges, linkDestinationRanges };
}
