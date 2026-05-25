import type { LintResult } from "../types.js";

export function reportPretty(results: LintResult[]): string {
  const lines: string[] = [];
  results.forEach((result) => {
    result.diagnostics.forEach((diagnostic) => {
      const location = `${result.filePath}:${diagnostic.range.start.line}:${diagnostic.range.start.column}`;
      lines.push(`${diagnostic.severity}[${diagnostic.code}]: ${diagnostic.message}`);
      lines.push(` --> ${location}`);
      if (diagnostic.help) lines.push(` help: ${diagnostic.help}`);
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
    version: "0.2.0",
    files: results.map((result) => ({
      path: result.filePath,
      diagnostics: result.diagnostics.map(({ spanId: _spanId, ...diagnostic }) => diagnostic),
      ...(result.fixedText === undefined ? {} : { fixedText: result.fixedText }),
    })),
    summary: { errorCount, warningCount, infoCount },
  }, null, 2);
}
