import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import dollarmathPlugin from "markdown-it-dollarmath";
import texmath from "markdown-it-texmath";
import katex from "katex";
import type { SourceDocument } from "../core/document.js";
import type { RawDollarPair } from "../scanner/sourceScanner.js";
import type { MarkdownItSimulation, Range } from "../types.js";

export interface MarkdownItMathSpan {
  kind: "inline" | "display";
  content: string;
  range: Range;
  pairId: string;
}

function mathTokens(tokens: Token[]): Array<{ kind: "inline" | "display"; content: string }> {
  const results: Array<{ kind: "inline" | "display"; content: string }> = [];
  const examine = (token: Token): void => {
    if (token.type === "math_inline") results.push({ kind: "inline", content: token.content });
    if (token.type === "math_inline_double" || token.type === "math_block" || token.type === "math_block_eqno") {
      results.push({ kind: "display", content: token.content.trim() });
    }
    token.children?.forEach(examine);
  };
  tokens.forEach(examine);
  return results;
}

function createParser(simulation: MarkdownItSimulation): MarkdownIt {
  const parser = new MarkdownIt();
  if (simulation === "texmath") {
    return parser.use(texmath, {
      engine: katex,
      delimiters: "dollars",
      katexOptions: { throwOnError: false },
    });
  }
  return parser.use(dollarmathPlugin, {
    allow_space: true,
    allow_digits: true,
    double_inline: true,
    renderer(content: string, options: { displayMode: boolean }) {
      return katex.renderToString(content, { displayMode: options.displayMode, throwOnError: false });
    },
  });
}

export function parseMarkdownItMath(
  document: SourceDocument,
  pairs: RawDollarPair[],
  simulation: MarkdownItSimulation,
): MarkdownItMathSpan[] {
  const detected = mathTokens(createParser(simulation).parse(document.text, {}));
  const remaining = [...pairs];
  const spans: MarkdownItMathSpan[] = [];
  detected.forEach((token) => {
    const index = remaining.findIndex((pair) =>
      pair.kind === token.kind && pair.content.trim() === token.content.trim(),
    );
    if (index === -1) return;
    const [pair] = remaining.splice(index, 1);
    spans.push({ kind: pair.kind, content: pair.content, range: pair.range, pairId: pair.id });
  });
  return spans;
}
