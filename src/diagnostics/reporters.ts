import { getRuleInfo } from "../rules/catalog.js";
import type { Diagnostic, LintResult, ProfileDiffResult, ProfileName, Severity } from "../types.js";
import { VERSION } from "../version.js";

interface PrettyOptions {
  color?: boolean;
}

const ansi = {
  reset: "\u001b[0m",
  error: "\u001b[31m",
  warning: "\u001b[33m",
  info: "\u001b[90m",
} satisfies Record<Severity | "reset", string>;

function styled(text: string, severity: Severity, color = false): string {
  return color ? `${ansi[severity]}${text}${ansi.reset}` : text;
}

function sourceFrame(sourceText: string, diagnostic: Diagnostic, color = false): string[] {
  const sourceLines = sourceText.split(/\r?\n/);
  const firstLine = Math.max(1, diagnostic.range.start.line - 1);
  const lastLine = Math.min(sourceLines.length, diagnostic.range.end.line + 1);
  const width = String(lastLine).length;
  const lines = [` ${" ".repeat(width)} |`];
  for (let line = firstLine; line <= lastLine; line += 1) {
    const content = sourceLines[line - 1] ?? "";
    lines.push(` ${String(line).padStart(width)} | ${content}`);
    if (line < diagnostic.range.start.line || line > diagnostic.range.end.line) continue;
    const startColumn = line === diagnostic.range.start.line ? diagnostic.range.start.column : 1;
    const endColumn = line === diagnostic.range.end.line ? diagnostic.range.end.column : content.length + 1;
    const marker = `${" ".repeat(Math.max(0, startColumn - 1))}${"^".repeat(Math.max(1, endColumn - startColumn))}`;
    lines.push(` ${" ".repeat(width)} | ${styled(marker, diagnostic.severity, color)}`);
  }
  lines.push(` ${" ".repeat(width)} |`);
  return lines;
}

export function reportPretty(results: LintResult[], options: PrettyOptions = {}): string {
  const lines: string[] = [];
  results.forEach((result) => {
    result.diagnostics.forEach((diagnostic) => {
      const location = `${result.filePath}:${diagnostic.range.start.line}:${diagnostic.range.start.column}`;
      const label = `${diagnostic.severity}[${diagnostic.code}]`;
      lines.push(`${styled(label, diagnostic.severity, options.color)}: ${diagnostic.message}`);
      lines.push(` --> ${location}`);
      lines.push(...sourceFrame(result.sourceText, diagnostic, options.color));
      if (diagnostic.help) lines.push(` = help: ${diagnostic.help}`);
      lines.push("");
    });
  });
  const errorCount = results.reduce((count, result) => count + result.stats.errorCount, 0);
  const warningCount = results.reduce((count, result) => count + result.stats.warningCount, 0);
  const infoCount = results.reduce((count, result) => count + result.stats.infoCount, 0);
  lines.push(`${errorCount} error(s), ${warningCount} warning(s), ${infoCount} info message(s)`);
  return lines.join("\n");
}

export function reportJson(results: LintResult[]): string {
  const errorCount = results.reduce((count, result) => count + result.stats.errorCount, 0);
  const warningCount = results.reduce((count, result) => count + result.stats.warningCount, 0);
  const infoCount = results.reduce((count, result) => count + result.stats.infoCount, 0);
  return JSON.stringify({
    version: VERSION,
    files: results.map((result) => ({
      path: result.filePath,
      diagnostics: result.diagnostics.map(({ spanId: _spanId, ...diagnostic }) => diagnostic),
      ...(result.fixedText === undefined ? {} : { fixedText: result.fixedText }),
    })),
    summary: { errorCount, warningCount, infoCount },
  }, null, 2);
}

export function reportSarif(results: LintResult[]): string {
  const codes = [...new Set(results.flatMap((result) => result.diagnostics.map((diagnostic) => diagnostic.code)))];
  return JSON.stringify({
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [{
      tool: {
        driver: {
          name: "mdmathlint",
          version: VERSION,
          informationUri: "https://github.com/malyjacob/mdmathlint",
          rules: codes.map((code) => ({ id: code, shortDescription: { text: code } })),
        },
      },
      results: results.flatMap((result) => result.diagnostics.map((diagnostic) => ({
        ruleId: diagnostic.code,
        level: diagnostic.severity === "info" ? "note" : diagnostic.severity,
        message: { text: diagnostic.message },
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: result.filePath.replaceAll("\\", "/") },
            region: {
              startLine: diagnostic.range.start.line,
              startColumn: diagnostic.range.start.column,
              endLine: diagnostic.range.end.line,
              endColumn: diagnostic.range.end.column,
            },
          },
        }],
      }))),
    }],
  }, null, 2);
}

export function reportProfileDiffPretty(results: ProfileDiffResult[], profiles: ProfileName[], options: PrettyOptions = {}): string {
  const lines: string[] = [];
  results.forEach((result) => {
    lines.push(result.filePath);
    profiles.forEach((profile) => {
      const diagnostics = result.profiles[profile]?.diagnostics ?? [];
      const summary = diagnostics.length
        ? diagnostics.map((diagnostic) => styled(`${diagnostic.severity}[${diagnostic.code}]`, diagnostic.severity, options.color)).join(", ")
        : "clean";
      lines.push(`  ${profile}: ${summary}`);
    });
  });
  return lines.join("\n");
}

export function reportProfileDiffJson(results: ProfileDiffResult[], profiles: ProfileName[]): string {
  return JSON.stringify({
    version: VERSION,
    profiles,
    files: results.map((result) => ({
      path: result.filePath,
      profiles: Object.fromEntries(profiles.map((profile) => [profile, result.profiles[profile]?.diagnostics ?? []])),
    })),
  }, null, 2);
}

function unifiedDiff(filePath: string, before: string, after: string): string {
  const original = before.split(/\r?\n/);
  const modified = after.split(/\r?\n/);
  let prefix = 0;
  while (prefix < original.length && prefix < modified.length && original[prefix] === modified[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < original.length - prefix &&
    suffix < modified.length - prefix &&
    original[original.length - suffix - 1] === modified[modified.length - suffix - 1]
  ) suffix += 1;
  const contextStart = Math.max(0, prefix - 3);
  const originalEnd = Math.min(original.length, original.length - suffix + 3);
  const modifiedEnd = Math.min(modified.length, modified.length - suffix + 3);
  const lines = [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    `@@ -${contextStart + 1},${originalEnd - contextStart} +${contextStart + 1},${modifiedEnd - contextStart} @@`,
  ];
  original.slice(contextStart, prefix).forEach((line) => lines.push(` ${line}`));
  original.slice(prefix, original.length - suffix).forEach((line) => lines.push(`-${line}`));
  modified.slice(prefix, modified.length - suffix).forEach((line) => lines.push(`+${line}`));
  original.slice(original.length - suffix, originalEnd).forEach((line) => lines.push(` ${line}`));
  return lines.join("\n");
}

export function reportFixDiff(results: LintResult[]): string {
  return results
    .filter((result): result is LintResult & { fixedText: string } => result.fixedText !== undefined)
    .map((result) => unifiedDiff(result.filePath, result.originalText ?? result.sourceText, result.fixedText))
    .join("\n\n");
}

interface LlmIssue {
  severity: Severity;
  rule: string;
  line: number;
  column: number;
  message: string;
  help: string | null;
  why: string | null;
  snippet: string;
  examples: Array<{ bad: string; good: string }>;
}

interface LlmOutput {
  pass: boolean;
  summary: { errors: number; warnings: number; info: number };
  files: Array<{
    path: string;
    issues: LlmIssue[];
  }>;
  fix_prompt: string;
}

function snippetFromRange(text: string, startLine: number, startColumn: number, endLine: number, endColumn: number): string {
  const lines = text.split(/\r?\n/);
  if (startLine === endLine) {
    const line = lines[startLine - 1] ?? "";
    return line.slice(startColumn - 1, endColumn - 1);
  }
  const parts: string[] = [];
  for (let line = startLine; line <= endLine; line += 1) {
    const content = lines[line - 1] ?? "";
    if (line === startLine) parts.push(content.slice(startColumn - 1));
    else if (line === endLine) parts.push(content.slice(0, endColumn - 1));
    else parts.push(content);
  }
  return parts.join("\n");
}

function buildFixPrompt(results: LintResult[]): string {
  const issues: Array<{ file: string; line: number; column: number; severity: string; rule: string; message: string; help: string | null; bad: string | null; good: string | null }> = [];
  results.forEach((result) => {
    result.diagnostics.forEach((diagnostic) => {
      const info = getRuleInfo(diagnostic.code);
      issues.push({
        file: result.filePath,
        line: diagnostic.range.start.line,
        column: diagnostic.range.start.column,
        severity: diagnostic.severity,
        rule: diagnostic.code,
        message: diagnostic.message,
        help: diagnostic.help ?? null,
        bad: info?.examples[0]?.bad ?? null,
        good: info?.examples[0]?.good ?? null,
      });
    });
  });

  const total = issues.length;
  if (total === 0) return "No math rendering issues found.";

  const header = `The Markdown below has ${total} math rendering issue${total > 1 ? "s" : ""}. Regenerate it with these fixes:\n`;
  const body = issues.map((issue, index) => {
    const parts = [
      `${index + 1}. ${issue.file}:${issue.line}:${issue.column} — ${issue.severity}[${issue.rule}]: ${issue.message}`,
    ];
    if (issue.help) parts.push(`   Fix: ${issue.help}`);
    if (issue.bad) parts.push(`   Bad:  ${issue.bad.replace(/\n/g, "\n         ")}`);
    if (issue.good) parts.push(`   Good: ${issue.good.replace(/\n/g, "\n         ")}`);
    return parts.join("\n");
  }).join("\n\n");

  const sourceTexts = results.map((result) => {
    return `--- ${result.filePath} ---\n${result.sourceText}`;
  }).join("\n\n");

  return `${header}\n${body}\n\n--- Original Markdown ---\n${sourceTexts}`;
}

export function reportLlm(results: LintResult[]): string {
  const errors = results.reduce((count, result) => count + result.stats.errorCount, 0);
  const warnings = results.reduce((count, result) => count + result.stats.warningCount, 0);
  const info = results.reduce((count, result) => count + result.stats.infoCount, 0);

  const llmFiles = results.map((result) => {
    const issues: LlmIssue[] = result.diagnostics.map((diagnostic) => {
      const ruleInfo = getRuleInfo(diagnostic.code);
      const snippet = snippetFromRange(
        result.sourceText,
        diagnostic.range.start.line,
        diagnostic.range.start.column,
        diagnostic.range.end.line,
        diagnostic.range.end.column,
      );
      return {
        severity: diagnostic.severity,
        rule: diagnostic.code,
        line: diagnostic.range.start.line,
        column: diagnostic.range.start.column,
        message: diagnostic.message,
        help: diagnostic.help ?? null,
        why: ruleInfo?.why ?? null,
        snippet,
        examples: ruleInfo?.examples ?? [],
      };
    });
    return { path: result.filePath, issues };
  });

  const output: LlmOutput = {
    pass: errors === 0,
    summary: { errors, warnings, info },
    files: llmFiles,
    fix_prompt: buildFixPrompt(results),
  };

  return JSON.stringify(output, null, 2);
}

export function reportFixPrompt(results: LintResult[]): string {
  return buildFixPrompt(results);
}
