import type { RuleSetting } from "../types.js";

interface RuleExplanation {
  name: string;
  defaultSeverity: RuleSetting;
  fixable: boolean;
  summary: string;
  bad?: string;
  good?: string;
  why: string;
}

const rules: Record<string, RuleExplanation> = {
  MDM001: { name: "unclosed-inline-dollar", defaultSeverity: "error", fixable: false, summary: "Inline math delimiters must be closed.", why: "An unclosed delimiter changes how the remaining prose is parsed." },
  MDM002: { name: "unclosed-display-dollar", defaultSeverity: "error", fixable: false, summary: "Display math delimiters must be closed.", why: "Unclosed display math cannot be rendered reliably." },
  MDM003: {
    name: "display-delimiter-not-own-line",
    defaultSeverity: "warning",
    fixable: true,
    summary: "Display math delimiters should each be on their own line.",
    bad: "所以$$x=1$$成立。",
    good: "所以\n\n$$\nx=1\n$$\n\n成立。",
    why: "Attached display delimiters are interpreted differently by Markdown rendering chains.",
  },
  MDM004: { name: "display-math-missing-blank-lines", defaultSeverity: "warning", fixable: true, summary: "Display blocks should be separated by blank lines.", why: "Blank lines preserve block structure across parsers." },
  MDM005: { name: "inline-math-adjacent-text", defaultSeverity: "info", fixable: true, summary: "Inline math should be separated from prose.", why: "Spacing avoids delimiter ambiguity in portable Markdown." },
  MDM006: { name: "possible-currency-dollar", defaultSeverity: "info", fixable: false, summary: "A dollar sign may denote currency rather than math.", why: "Literal currency dollars can corrupt later math pairing." },
  MDM007: { name: "math-delimiter-in-code", defaultSeverity: "info", fixable: false, summary: "Math in code examples is not rendered.", why: "Fenced or inline code displays source text intentionally." },
  MDM008: { name: "display-math-inside-table", defaultSeverity: "warning", fixable: false, summary: "Display math in GFM tables is not portable.", why: "Table cells and block mathematics interact differently across renderers." },
  MDM009: { name: "list-display-math-indentation", defaultSeverity: "warning", fixable: false, summary: "List display math needs matching indentation.", why: "Incorrect indentation detaches the block from its list item." },
  MDM010: { name: "blockquote-math-marker", defaultSeverity: "warning", fixable: false, summary: "Quoted display math requires consistent quote markers.", why: "A missing marker terminates blockquote context." },
  MDM011: { name: "inline-math-crosses-line", defaultSeverity: "warning", fixable: false, summary: "Inline math should not cross line boundaries.", why: "Line wrapping semantics vary by parser." },
  MDM012: { name: "katex-parse-error", defaultSeverity: "error", fixable: false, summary: "Formula content must parse as KaTeX.", why: "Invalid TeX cannot render successfully." },
  MDM013: { name: "unsupported-delimiter-for-profile", defaultSeverity: "warning", fixable: false, summary: "The selected profile does not support this delimiter style.", why: "Platform-specific delimiters are not portable." },
  MDM014: { name: "parser-disagreement", defaultSeverity: "off", fixable: false, summary: "Math recognition differs between parsers.", why: "A formula that works in one rendering chain may fail in another." },
  MDM015: { name: "raw-delimiter-not-parsed", defaultSeverity: "off", fixable: false, summary: "A raw math delimiter was not recognized by the selected parser.", why: "This usually signals non-portable placement or ambiguous literal dollars." },
  MDM017: { name: "nested-dollar-delimiter", defaultSeverity: "warning", fixable: false, summary: "An inline formula appears to contain nested dollar delimiters.", why: "Dollar-delimited math cannot safely contain another dollar-delimited formula." },
  MDM018: { name: "mathjax-only-primitive", defaultSeverity: "warning", fixable: false, summary: "Formula uses a TeX primitive with inconsistent KaTeX and MathJax support.", why: "Renderer-specific primitives make documents fail when moved between math engines." },
  MDM019: { name: "undefined-label-reference", defaultSeverity: "warning", fixable: false, summary: "A formula references a label not defined in this document.", why: "Broken equation references render as missing or unresolved links." },
};

export function explainRule(ruleId: string): string | undefined {
  const rule = rules[ruleId.toUpperCase()];
  if (!rule) return undefined;
  const lines = [
    `Rule: ${ruleId.toUpperCase()} - ${rule.name}`,
    `Severity: ${rule.defaultSeverity} (default)`,
    `Fixable: ${rule.fixable ? "yes" : "no"}`,
    "",
    "Summary:",
    rule.summary,
  ];
  if (rule.bad) lines.push("", "Bad:", rule.bad);
  if (rule.good) lines.push("", "Good:", rule.good);
  lines.push("", "Why:", rule.why);
  return lines.join("\n");
}
