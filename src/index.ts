import { readFile } from "node:fs/promises";
import { createDocument } from "./core/document.js";
import { resolveRules } from "./core/profiles.js";
import { applyFixes, collectFixes } from "./fixer/fixPipeline.js";
import { parseMathSpans } from "./parser/remarkAdapter.js";
import { runRules } from "./rules/ruleEngine.js";
import { scanSource } from "./scanner/sourceScanner.js";
import type { Diagnostic, LintOptions, LintResult } from "./types.js";

export type {
  ConfigFile,
  Diagnostic,
  Fix,
  KatexOptions,
  LintOptions,
  LintResult,
  ProfileName,
  RuleSetting,
} from "./types.js";
export { findConfig } from "./config/loadConfig.js";

function lintOnce(text: string, options: LintOptions): Diagnostic[] {
  const document = createDocument(text, options.filePath);
  const profile = options.profile ?? "portable";
  return runRules(document, scanSource(document), parseMathSpans(document), {
    profile,
    settings: resolveRules(profile, options.rules),
    katex: options.katex ?? {},
    fixOptions: {
      inlineSpacing: options.fixOptions?.inlineSpacing ?? true,
      displayOwnLine: options.fixOptions?.displayOwnLine ?? true,
      currencyDollar: options.fixOptions?.currencyDollar ?? false,
    },
  });
}

function result(filePath: string, diagnostics: Diagnostic[], fixedText?: string): LintResult {
  return {
    filePath,
    diagnostics,
    ...(fixedText === undefined ? {} : { fixedText }),
    stats: {
      errorCount: diagnostics.filter((item) => item.severity === "error").length,
      warningCount: diagnostics.filter((item) => item.severity === "warning").length,
      infoCount: diagnostics.filter((item) => item.severity === "info").length,
    },
  };
}

export async function lintText(text: string, options: LintOptions = {}): Promise<LintResult> {
  const filePath = options.filePath ?? "<text>";
  if (!options.fix) return result(filePath, lintOnce(text, options));
  let current = text;
  let changed = false;
  for (let iteration = 0; iteration < 5; iteration += 1) {
    const diagnostics = lintOnce(current, options);
    const fixes = collectFixes(diagnostics);
    if (fixes.length === 0) return result(filePath, diagnostics, changed ? current : undefined);
    const next = applyFixes(current, fixes);
    if (next === current) return result(filePath, diagnostics, changed ? current : undefined);
    changed = true;
    current = next;
  }
  const diagnostics = lintOnce(current, options);
  diagnostics.push({
    code: "MDM-FIX",
    severity: "warning",
    message: "fix iteration limit reached; some fixes may remain unapplied",
    range: createDocument(current, filePath).text.length
      ? { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } }
      : { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
  });
  return result(filePath, diagnostics, current);
}

export async function lintFiles(files: string[], options: LintOptions = {}): Promise<LintResult[]> {
  return Promise.all(files.map(async (filePath) => lintText(await readFile(filePath, "utf8"), { ...options, filePath })));
}
