import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse, printParseErrorCode, type ParseError } from "jsonc-parser";
import type { ConfigFile, ProfileName, RuleSetting } from "../types.js";

const profiles = new Set<ProfileName>(["portable", "strict", "github", "llm-output", "markdown-it"]);
const severities = new Set<RuleSetting>(["off", "info", "warning", "error"]);

function parseConfig(path: string): ConfigFile {
  const errors: ParseError[] = [];
  const data = parse(readFileSync(path, "utf8"), errors, { allowTrailingComma: true }) as ConfigFile | undefined;
  if (errors.length) throw new Error(`${path}: invalid JSONC (${printParseErrorCode(errors[0].error)})`);
  const config = data ?? {};
  if (config.profile && !profiles.has(config.profile)) throw new Error(`${path}: unknown profile "${config.profile}"`);
  for (const [rule, value] of Object.entries(config.rules ?? {})) {
    if (!severities.has(value)) throw new Error(`${path}: invalid severity for ${rule}`);
  }
  return config;
}

export function findConfig(startDirectory: string, explicitPath?: string): { path?: string; config: ConfigFile } {
  if (explicitPath) {
    const path = resolve(explicitPath);
    if (!existsSync(path)) throw new Error(`Configuration file not found: ${path}`);
    return { path, config: parseConfig(path) };
  }
  let directory = resolve(startDirectory);
  for (;;) {
    for (const filename of [".mdmathlintrc.json", ".mdmathlintrc.jsonc"]) {
      const path = join(directory, filename);
      if (existsSync(path)) return { path, config: parseConfig(path) };
    }
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return { config: {} };
}
