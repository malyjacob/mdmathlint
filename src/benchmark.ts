#!/usr/bin/env node
import { performance } from "node:perf_hooks";
import process from "node:process";
import fg from "fast-glob";
import { lintFiles } from "./index.js";

async function main(): Promise<void> {
  const patterns = process.argv.slice(2);
  const files = await fg(patterns.length ? patterns : ["**/*.md"], {
    absolute: true,
    ignore: ["node_modules/**", "dist/**"],
    onlyFiles: true,
  });
  const start = performance.now();
  const results = await lintFiles(files);
  const elapsed = performance.now() - start;
  const diagnostics = results.reduce((total, result) => total + result.diagnostics.length, 0);
  process.stdout.write(`linted ${files.length} file(s), ${diagnostics} diagnostic(s), ${elapsed.toFixed(2)} ms\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`mdmathlint benchmark: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
});
