#!/usr/bin/env node
import { watch } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { Command, InvalidArgumentError } from "commander";
import fg from "fast-glob";
import { findConfig, lintText, profileDiffText, type LintOptions, type MarkdownItSimulation, type ProfileName } from "./index.js";
import { reportFixDiff, reportJson, reportPretty, reportProfileDiffJson, reportProfileDiffPretty, reportSarif } from "./diagnostics/reporters.js";
import { initializeConfig } from "./init.js";
import { explainRule } from "./rules/catalog.js";

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
  .option("--init", "create a .mdmathlintrc.json configuration interactively")
  .option("--stdin", "read Markdown from stdin")
  .option("--stdin-filename <name>", "virtual filename for stdin diagnostics", "<stdin>")
  .option("--profile <name>", "portable|strict|github|llm-output|markdown-it")
  .option("--profile-diff <profiles>", "compare comma-separated profiles")
  .option("--markdown-it-simulation <name>", "texmath|dollarmath", "dollarmath")
  .option("--config <path>", "configuration file path")
  .option("--no-config", "skip configuration file discovery")
  .option("--format <format>", "pretty|json|sarif", "pretty")
  .option("--color", "force ANSI colors in pretty output")
  .option("--no-color", "disable ANSI colors in pretty output")
  .option("--fix", "apply safe fixes")
  .option("--fix-dry-run", "calculate fixes without writing files")
  .option("--watch", "watch input files and lint again when they change")
  .option("--explain <rule-id>", "print a rule explanation")
  .option("--max-warnings <n>", "fail if warnings exceed n", integer);

async function main(): Promise<number> {
  command.parse();
  const options = command.opts<{
    init?: boolean;
    stdin?: boolean;
    stdinFilename: string;
    profile?: ProfileName;
    profileDiff?: string;
    markdownItSimulation?: MarkdownItSimulation;
    config?: string | false;
    format: "pretty" | "json" | "sarif";
    color?: boolean;
    fix?: boolean;
    fixDryRun?: boolean;
    watch?: boolean;
    explain?: string;
    maxWarnings?: number;
  }>();
  if (options.init) {
    await initializeConfig();
    return 0;
  }
  if (options.explain) {
    const explanation = explainRule(options.explain);
    if (!explanation) throw new Error(`Unknown rule: ${options.explain}`);
    process.stdout.write(`${explanation}\n`);
    return 0;
  }
  if (!["pretty", "json", "sarif"].includes(options.format)) throw new Error(`Unsupported format: ${options.format}`);
  if (options.markdownItSimulation && !["texmath", "dollarmath"].includes(options.markdownItSimulation)) {
    throw new Error(`Unsupported markdown-it simulation: ${options.markdownItSimulation}`);
  }
  if (options.watch && options.stdin) throw new Error("--watch cannot be used with --stdin.");
  if (options.watch && options.profileDiff) throw new Error("--watch cannot be used with --profile-diff.");
  const found = options.config === false
    ? { config: {} }
    : findConfig(process.cwd(), options.config);
  const prettyColor = options.color === undefined
    ? process.env.NO_COLOR === undefined && Boolean(process.stdout.isTTY)
    : options.color;
  const lintOptions: LintOptions = {
    profile: options.profile ?? found.config.profile ?? "portable",
    rules: found.config.rules,
    katex: found.config.katex,
    fixOptions: found.config.fix,
    fix: Boolean(options.fix || options.fixDryRun),
    markdownItSimulation: options.markdownItSimulation,
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
  if (options.profileDiff) {
    if (options.format === "sarif") throw new Error("SARIF output is not available for profile comparisons.");
    const profiles = options.profileDiff.split(",").map((profile) => profile.trim()).filter(Boolean) as ProfileName[];
    const allowed = new Set<ProfileName>(["portable", "strict", "github", "llm-output", "markdown-it"]);
    if (profiles.length < 2 || profiles.some((profile) => !allowed.has(profile))) {
      throw new Error("Profile diff expects at least two valid comma-separated profiles.");
    }
    const comparisons = await Promise.all(inputs.map((input) => profileDiffText(input.text, profiles, { ...lintOptions, filePath: input.path })));
    const output = options.format === "json"
      ? reportProfileDiffJson(comparisons, profiles)
      : reportProfileDiffPretty(comparisons, profiles, { color: prettyColor });
    process.stdout.write(`${output}\n`);
    return comparisons.some((comparison) => profiles.some((profile) => (comparison.profiles[profile]?.stats.errorCount ?? 0) > 0)) ? 1 : 0;
  }
  async function lintInputs(currentInputs: Array<{ path: string; text: string; writable: boolean }>) {
    const results = await Promise.all(currentInputs.map((input) => lintText(input.text, { ...lintOptions, filePath: input.path })));
    if (options.fix && !options.fixDryRun) {
      for (let index = 0; index < currentInputs.length; index += 1) {
        if (currentInputs[index].writable && results[index].fixedText !== undefined) {
          await writeFile(resolve(currentInputs[index].path), results[index].fixedText!, "utf8");
        }
      }
    }
    const output = options.format === "json" ? reportJson(results) : options.format === "sarif" ? reportSarif(results) : reportPretty(results, { color: prettyColor });
    const preview = options.fixDryRun && options.format === "pretty"
      ? reportFixDiff(results)
      : "";
    process.stdout.write(`${preview ? `${preview}\n\n` : ""}${output}\n`);
    return results;
  }
  const results = await lintInputs(inputs);
  const errors = results.reduce((count, item) => count + item.stats.errorCount, 0);
  const warnings = results.reduce((count, item) => count + item.stats.warningCount, 0);
  if (options.watch) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    paths.forEach((path) => watch(path, () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void Promise.all(paths.map(async (filePath) => ({ path: filePath, text: await readFile(filePath, "utf8"), writable: true })))
          .then(lintInputs)
          .catch((error: unknown) => process.stderr.write(`mdmathlint: ${error instanceof Error ? error.message : String(error)}\n`));
      }, 50);
    }));
    await new Promise<void>(() => undefined);
  }
  return errors > 0 || (options.maxWarnings !== undefined && warnings > options.maxWarnings) ? 1 : 0;
}

main()
  .then((code) => { process.exitCode = code; })
  .catch((error: unknown) => {
    process.stderr.write(`mdmathlint: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  });
