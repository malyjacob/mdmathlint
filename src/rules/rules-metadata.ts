import type { RuleSetting } from "../types.js";

export interface RuleExample {
  /** 错误示例 */
  bad: string;
  /** 正确示例 */
  good: string;
}

export interface RuleMetadata {
  name: string;
  defaultSeverity: RuleSetting;
  fixable: boolean;
  summary: string;
  why: string;
  examples: RuleExample[];
}

export const rulesMetadata: Record<string, RuleMetadata> = {
  MDM001: {
    name: "unclosed-inline-dollar",
    defaultSeverity: "error",
    fixable: false,
    summary: "Inline math delimiters must be closed.",
    why: "An unclosed delimiter changes how the remaining prose is parsed.",
    examples: [
      { bad: "计算 $x + 1 的值", good: "计算 $x + 1$ 的值" },
      { bad: "The formula $E=mc^2 is famous.", good: "The formula $E=mc^2$ is famous." },
    ],
  },
  MDM002: {
    name: "unclosed-display-dollar",
    defaultSeverity: "error",
    fixable: false,
    summary: "Display math delimiters must be closed.",
    why: "Unclosed display math cannot be rendered reliably.",
    examples: [
      { bad: "$$\n\\frac{1}{2}", good: "$$\n\\frac{1}{2}\n$$" },
      { bad: "$$$$\n\\text{content}", good: "$$\n\\text{content}\n$$" },
    ],
  },
  MDM003: {
    name: "display-delimiter-not-own-line",
    defaultSeverity: "warning",
    fixable: true,
    summary: "Display math delimiters should each be on their own line.",
    why: "Attached display delimiters are interpreted differently by Markdown rendering chains.",
    examples: [
      { bad: "所以$$x=1$$成立。", good: "所以\n\n$$\nx=1\n$$\n\n成立。" },
      { bad: "The formula $$E=mc^2$$ is famous.", good: "The formula\n\n$$\nE=mc^2\n$$\n\nis famous." },
      {
        bad: "Let us compute $$f(x)=\\frac{1}{x}$$ for all x.",
        good: "Let us compute\n\n$$\nf(x)=\\frac{1}{x}\n$$\n\nfor all x.",
      },
    ],
  },
  MDM004: {
    name: "display-math-missing-blank-lines",
    defaultSeverity: "warning",
    fixable: true,
    summary: "Display blocks should be separated by blank lines.",
    why: "Blank lines preserve block structure across parsers.",
    examples: [
      {
        bad: "Some text\n$$\nx=1\n$$\nMore text",
        good: "Some text\n\n$$\nx=1\n$$\n\nMore text",
      },
      {
        bad: "## Heading\n$$\ny=2\n$$\n## Next",
        good: "## Heading\n\n$$\ny=2\n$$\n\n## Next",
      },
    ],
  },
  MDM005: {
    name: "inline-math-adjacent-text",
    defaultSeverity: "info",
    fixable: true,
    summary: "Inline math should be separated from prose.",
    why: "Spacing avoids delimiter ambiguity in portable Markdown.",
    examples: [
      { bad: "令$x$为变量", good: "令 $x$ 为变量" },
      { bad: "Let$x$be a variable.", good: "Let $x$ be a variable." },
      { bad: "当$n=1$时", good: "当 $n=1$ 时" },
    ],
  },
  MDM006: {
    name: "possible-currency-dollar",
    defaultSeverity: "info",
    fixable: false,
    summary: "A dollar sign may denote currency rather than math.",
    why: "Literal currency dollars can corrupt later math pairing.",
    examples: [
      { bad: "The price is $5 per unit.", good: "The price is \\$5 per unit." },
      { bad: "Budget: $1,000 per month", good: "Budget: \\$1,000 per month" },
    ],
  },
  MDM007: {
    name: "math-delimiter-in-code",
    defaultSeverity: "info",
    fixable: false,
    summary: "Math in code examples is not rendered.",
    why: "Fenced or inline code displays source text intentionally.",
    examples: [
      { bad: "Use `$x+1$` in your Markdown.", good: "Use `$x+1$` in your Markdown.\n<!-- This is fine — it's documentation of math syntax -->" },
      {
        bad: "```md\n$x+1$\n```",
        good: "```md\n$x+1$\n```\n<!-- MDM007 will fire at info level — this is expected -->",
      },
    ],
  },
  MDM008: {
    name: "display-math-inside-table",
    defaultSeverity: "warning",
    fixable: false,
    summary: "Display math in GFM tables is not portable.",
    why: "Table cells and block mathematics interact differently across renderers.",
    examples: [
      {
        bad: "| Formula | Result |\n|---|---|\n| $$\nx=1\n$$ | 1 |",
        good: "| Formula | Result |\n|---|---|\n| $x=1$ | 1 |",
      },
    ],
  },
  MDM009: {
    name: "list-display-math-indentation",
    defaultSeverity: "warning",
    fixable: false,
    summary: "List display math needs matching indentation.",
    why: "Incorrect indentation detaches the block from its list item.",
    examples: [
      {
        bad: "1. First step\n\n$$\nx=1\n$$",
        good: "1. First step\n\n   $$\n   x=1\n   $$",
      },
    ],
  },
  MDM010: {
    name: "blockquote-math-marker",
    defaultSeverity: "warning",
    fixable: false,
    summary: "Quoted display math requires consistent quote markers.",
    why: "A missing marker terminates blockquote context.",
    examples: [
      {
        bad: "> Theorem:\n>\n$$\nx=1\n$$",
        good: "> Theorem:\n>\n> $$\n> x=1\n> $$",
      },
    ],
  },
  MDM011: {
    name: "inline-math-crosses-line",
    defaultSeverity: "warning",
    fixable: false,
    summary: "Inline math should not cross line boundaries.",
    why: "Line wrapping semantics vary by parser.",
    examples: [
      {
        bad: "The formula $x +\ny = 1$ is wrong.",
        good: "The formula $x + y = 1$ is wrong.",
      },
    ],
  },
  MDM012: {
    name: "katex-parse-error",
    defaultSeverity: "error",
    fixable: false,
    summary: "Formula content must parse as KaTeX.",
    why: "Invalid TeX cannot render successfully.",
    examples: [
      {
        bad: "$$\n\\frac{1}{x\n$$",
        good: "$$\n\\frac{1}{x}\n$$",
      },
      {
        bad: "$$\n\\unknowncommand{x}\n$$",
        good: "$$\n\\mathrm{unknown}(x)\n$$",
      },
    ],
  },
  MDM013: {
    name: "unsupported-delimiter-for-profile",
    defaultSeverity: "warning",
    fixable: false,
    summary: "The selected profile does not support this delimiter style.",
    why: "Platform-specific delimiters are not portable.",
    examples: [
      {
        bad: "$`x+1`$  ← 在 non-github profile 下不兼容",
        good: "$x+1$  ← 在所有 profile 下均兼容",
      },
      {
        bad: "$`\\frac{1}{2}`$ in strict profile",
        good: "$\\frac{1}{2}$ in strict profile",
      },
    ],
  },
  MDM014: {
    name: "parser-disagreement",
    defaultSeverity: "off",
    fixable: false,
    summary: "Math recognition differs between parsers.",
    why: "A formula that works in one rendering chain may fail in another.",
    examples: [
      {
        bad: "$$\nx=1\n$$\n<!-- remark 识别为 display math，但 markdown-it + dollarmath 可能不识别 -->",
        good: "$$\nx=1\n$$\n\n<!-- 确保空行和独占行，所有 parser 均一致识别 -->",
      },
    ],
  },
  MDM015: {
    name: "raw-delimiter-not-parsed",
    defaultSeverity: "off",
    fixable: false,
    summary: "A raw math delimiter was not recognized by the selected parser.",
    why: "This usually signals non-portable placement or ambiguous literal dollars.",
    examples: [
      { bad: "所以$$x=1$$成立。", good: "所以\n\n$$\nx=1\n$$\n\n成立。" },
      {
        bad: "The value is $1.50 per unit and $x$ is the variable.",
        good: "The value is \\$1.50 per unit and $x$ is the variable.",
      },
    ],
  },
  MDM017: {
    name: "nested-dollar-delimiter",
    defaultSeverity: "warning",
    fixable: false,
    summary: "An inline formula appears to contain nested dollar delimiters.",
    why: "Dollar-delimited math cannot safely contain another dollar-delimited formula.",
    examples: [
      {
        bad: "${x \\text{ for } $y$}$",
        good: "${x \\text{ for } y}$",
      },
    ],
  },
  MDM018: {
    name: "mathjax-only-primitive",
    defaultSeverity: "warning",
    fixable: false,
    summary: "Formula uses a TeX primitive with inconsistent KaTeX and MathJax support.",
    why: "Renderer-specific primitives make documents fail when moved between math engines.",
    examples: [
      {
        bad: "$$\n{n \\choose k}\n$$",
        good: "$$\n\\binom{n}{k}\n$$",
      },
    ],
  },
  MDM019: {
    name: "undefined-label-reference",
    defaultSeverity: "warning",
    fixable: false,
    summary: "A formula references a label not defined in this document.",
    why: "Broken equation references render as missing or unresolved links.",
    examples: [
      {
        bad: "$$\nE=mc^2 \\label{eq:einstein}\n$$\n\nSee \\ref{eq:relativity} for details.",
        good: "$$\nE=mc^2 \\label{eq:einstein}\n$$\n\nSee \\ref{eq:einstein} for details.",
      },
    ],
  },
  MDM020: {
    name: "mathjax-extension-command",
    defaultSeverity: "warning",
    fixable: false,
    summary: "Formula uses a MathJax-specific extension command.",
    why: "MathJax extension commands often do not render in KaTeX-based sites.",
    examples: [
      {
        bad: "$$\n\\bbox[yellow]{x+1}\n$$",
        good: "$$\n\\boxed{x+1}\n$$",
      },
    ],
  },
  MDM021: {
    name: "formula-complexity",
    defaultSeverity: "warning",
    fixable: false,
    summary: "Formula is unusually long or structurally complex.",
    why: "Very complex formulas are hard to review and may exceed renderer limits.",
    examples: [
      {
        bad: "$$\n\\frac{\\sum_{i=1}^{n}\\frac{\\sum_{j=1}^{m}\\frac{\\sum_{k=1}^{p}\\dots}{\\dots}}{\\dots}}{\\dots}\n$$",
        good: "$$\n\\begin{aligned}\nS_i &= \\sum_{i=1}^{n} a_i \\\\\nS_j &= \\sum_{j=1}^{m} b_j \\\\\nS_k &= \\sum_{k=1}^{p} c_k\n\\end{aligned}\n$$",
      },
    ],
  },
  MDM022: {
    name: "prefer-latex-delimiter",
    defaultSeverity: "off",
    fixable: false,
    summary: "Prefer \\(...\\) / \\[...\\] over $...$ / $$...$$ for maximum portability.",
    why: "LaTeX bracket delimiters avoid the $5 currency ambiguity, dollar-adjacency rules, and are uniformly supported by all math renderers.",
    examples: [
      {
        bad: "$x+1$ 和 $$y+2$$",
        good: "\\(x+1\\) 和 \\[y+2\\]",
      },
      {
        bad: "The formula $E=mc^2$ is inline.",
        good: "The formula \\(E=mc^2\\) is inline.",
      },
    ],
  },
  MDM023: {
    name: "mixed-math-delimiter-style",
    defaultSeverity: "warning",
    fixable: false,
    summary: "Do not mix dollar-style and bracket-style math delimiters in the same document.",
    why: "Mixed delimiter styles cause inconsistent recognition across different Markdown rendering chains.",
    examples: [
      {
        bad: "$x+1$ 和 \\(y+2\\) 同时出现",
        good: "$x+1$ 和 $y+2$ 统一使用 dollar 风格",
      },
      {
        bad: "$$\nx=1\n$$\n\n\\[\ny=2\n\\]",
        good: "$$\nx=1\n$$\n\n$$\ny=2\n$$",
      },
    ],
  },
  MDM024: {
    name: "unknown-latex-command",
    defaultSeverity: "warning",
    fixable: false,
    summary: "Formula uses a LaTeX command that KaTeX does not recognize.",
    why: "Unknown commands are a common LLM hallucination pattern — the command was invented rather than drawn from standard LaTeX.",
    examples: [
      {
        bad: "$$\n\\differential{x}\n$$",
        good: "$$\n\\mathrm{d}x\n$$",
      },
      {
        bad: "$$\n\\vect{v}\n$$",
        good: "$$\n\\vec{v}\n$$",
      },
    ],
  },
};
