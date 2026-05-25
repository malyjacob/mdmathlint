#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { Command, InvalidArgumentError } from "commander";
import fg from "fast-glob";
import { findConfig, lintText, type LintOptions, type ProfileName } from "./index.js";
import { reportJson, reportPretty } from "./diagnostics/reporters.js";

function integer(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) throw new InvalidArgumentError("expected a non-negative integer");
  return parsed;
}

async function stdin(): Promise<string> {
  let content = "";
  for await (const chunk of process.stdin) content += chunk;
  return content;
}

const command = new Command()
  .name("mdmathlint")
  .argument("[files...]")
  .option("--stdin", "read Markdown from stdin")
  .option("--stdin-filename <name>", "virtual filename for stdin diagnostics", "<stdin>")
  .option("--profile <name>", "portable|strict|github|llm-output|markdown-it")
  .option("--config <path>", "configuration file path")
  .option("--format <format>", "pretty|json", "pretty")
  .option("--fix", "apply safe fixes")
  .option("--fix-dry-run", "calculate fixes without writing files")
  .option("--max-warnings <n>", "fail if warnings exceed n", integer)
  .option("--no-color", "disable colored output");

async function main(): Promise<number> {
  command.parse();
  const options = command.opts<{
    stdin?: boolean;
    stdinFilename: string;
    profile?: ProfileName;
    config?: string;
    format: "pretty" | "json";
    fix?: boolean;
    fixDryRun?: boolean;
    maxWarnings?: number;
  }>();
  if (!["pretty", "json"].includes(options.format)) throw new Error(`Unsupported format: ${options.format}`);
  const found = findConfig(process.cwd(), options.config);
  const lintOptions: LintOptions = {
    profile: options.profile ?? found.config.profile ?? "portable",
    rules: found.config.rules,
    katex: found.config.katex,
    fixOptions: found.config.fix,
    fix: Boolean(options.fix || options.fixDryRun),
  };
  const inputs: Array<{ path: string; text: string; writable: boolean }> = [];
  if (options.stdin) inputs.push({ path: options.stdinFilename, text: await stdin(), writable: false });
  const rawPatterns = command.processedArgs.length ? command.processedArgs : command.args;
  const patterns = rawPatterns.flatMap((item) => Array.isArray(item) ? item : [item]) as string[];
  const paths: string[] = [];
  for (const pattern of patterns) {
    if (/[*?[\]{}()!]/.test(pattern)) paths.push(...await fg(pattern, { onlyFiles: true, unique: true, absolute: true }));
    else paths.push(resolve(pattern));
  }
  for (const path of paths) inputs.push({ path, text: await readFile(path, "utf8"), writable: true });
  if (inputs.length === 0) throw new Error("No input files. Provide Markdown files or --stdin.");
  const results = await Promise.all(inputs.map((input) => lintText(input.text, { ...lintOptions, filePath: input.path })));
  if (options.fix && !options.fixDryRun) {
    for (let index = 0; index < inputs.length; index += 1) {
      if (inputs[index].writable && results[index].fixedText !== undefined) {
        await writeFile(resolve(inputs[index].path), results[index].fixedText!, "utf8");
      }
    }
  }
  const output = options.format === "json" ? reportJson(results) : reportPretty(results);
  const preview = options.fixDryRun && options.format === "pretty"
    ? results.filter((result) => result.fixedText !== undefined).map((result) => `fix preview: ${result.filePath} would be modified`).join("\n")
    : "";
  process.stdout.write(`${preview ? `${preview}\n\n` : ""}${output}\n`);
  const errors = results.reduce((count, item) => count + item.stats.errorCount, 0);
  const warnings = results.reduce((count, item) => count + item.stats.warningCount, 0);
  return errors > 0 || (options.maxWarnings !== undefined && warnings > options.maxWarnings) ? 1 : 0;
}

main()
  .then((code) => { process.exitCode = code; })
  .catch((error: unknown) => {
    process.stderr.write(`mdmathlint: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  });
