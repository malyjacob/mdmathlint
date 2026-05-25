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

interface PositionedNode {
  type: string;
  value?: string;
  position?: {
    start: { offset?: number };
    end: { offset?: number };
  };
}

export function parseMathSpans(document: SourceDocument): ParsedMathSpan[] {
  const tree = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]).use(remarkGfm).use(remarkMath).parse(document.text);
  const spans: ParsedMathSpan[] = [];
  visit(tree, (node: PositionedNode) => {
    if (node.type !== "inlineMath" && node.type !== "math") return;
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start === undefined || end === undefined) return;
    const display = node.type === "math";
    const delimiterLength = display ? 2 : 1;
    spans.push({
      id: `parsed-${spans.length}`,
      kind: display ? "display" : "inline",
      content: node.value ?? "",
      range: rangeAt(document, start, end),
      contentRange: rangeAt(document, start + delimiterLength, end - delimiterLength),
    });
  });
  return spans;
}
