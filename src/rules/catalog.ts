import { rulesMetadata, type RuleMetadata } from "./rules-metadata.js";

export function explainRule(ruleId: string): string | undefined {
  const rule = rulesMetadata[ruleId.toUpperCase()];
  if (!rule) return undefined;
  const lines = [
    `Rule: ${ruleId.toUpperCase()} - ${rule.name}`,
    `Severity: ${rule.defaultSeverity} (default)`,
    `Fixable: ${rule.fixable ? "yes" : "no"}`,
    "",
    "Summary:",
    rule.summary,
  ];
  if (rule.examples.length > 0) {
    lines.push("", "Bad:", rule.examples[0].bad);
    lines.push("", "Good:", rule.examples[0].good);
  }
  lines.push("", "Why:", rule.why);
  return lines.join("\n");
}

export function getRuleInfo(ruleId: string): RuleMetadata | undefined {
  return rulesMetadata[ruleId.toUpperCase()];
}
