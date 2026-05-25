import type { LintResult, ProfileDiffResult, ProfileName } from "../types.js";

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
    version: "0.3.0",
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
          version: "0.3.0",
          informationUri: "https://github.com/mdmathlint/mdmathlint",
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

export function reportProfileDiffPretty(results: ProfileDiffResult[], profiles: ProfileName[]): string {
  const lines: string[] = [];
  results.forEach((result) => {
    lines.push(result.filePath);
    profiles.forEach((profile) => {
      const diagnostics = result.profiles[profile]?.diagnostics ?? [];
      const summary = diagnostics.length
        ? diagnostics.map((diagnostic) => `${diagnostic.severity}[${diagnostic.code}]`).join(", ")
        : "clean";
      lines.push(`  ${profile}: ${summary}`);
    });
  });
  return lines.join("\n");
}

export function reportProfileDiffJson(results: ProfileDiffResult[], profiles: ProfileName[]): string {
  return JSON.stringify({
    version: "0.3.0",
    profiles,
    files: results.map((result) => ({
      path: result.filePath,
      profiles: Object.fromEntries(profiles.map((profile) => [profile, result.profiles[profile]?.diagnostics ?? []])),
    })),
  }, null, 2);
}
