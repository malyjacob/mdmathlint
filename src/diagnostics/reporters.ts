import type { Diagnostic, LintResult, ProfileDiffResult, ProfileName, Severity } from "../types.js";

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
    version: "0.5.0",
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
          version: "0.5.0",
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
    version: "0.5.0",
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
