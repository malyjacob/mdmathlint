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
  if (config.root !== undefined && typeof config.root !== "boolean") throw new Error(`${path}: root must be a boolean`);
  if (config.profile && !profiles.has(config.profile)) throw new Error(`${path}: unknown profile "${config.profile}"`);
  for (const [rule, value] of Object.entries(config.rules ?? {})) {
    if (!severities.has(value)) throw new Error(`${path}: invalid severity for ${rule}`);
  }
  return config;
}

function mergeConfig(parent: ConfigFile, child: ConfigFile): ConfigFile {
  return {
    ...((child.root ?? parent.root) === undefined ? {} : { root: child.root ?? parent.root }),
    ...(child.profile ?? parent.profile ? { profile: child.profile ?? parent.profile } : {}),
    ...((parent.rules || child.rules) ? { rules: { ...parent.rules, ...child.rules } } : {}),
    ...((parent.katex || child.katex) ? {
      katex: {
        ...parent.katex,
        ...child.katex,
        ...((parent.katex?.macros || child.katex?.macros)
          ? { macros: { ...parent.katex?.macros, ...child.katex?.macros } }
          : {}),
      },
    } : {}),
    ...((parent.fix || child.fix) ? { fix: { ...parent.fix, ...child.fix } } : {}),
  };
}

export function findConfig(startDirectory: string, explicitPath?: string): { path?: string; config: ConfigFile } {
  if (explicitPath) {
    const path = resolve(explicitPath);
    if (!existsSync(path)) throw new Error(`Configuration file not found: ${path}`);
    return { path, config: parseConfig(path) };
  }
  let directory = resolve(startDirectory);
  const found: Array<{ path: string; config: ConfigFile }> = [];
  for (;;) {
    for (const filename of [".mdmathlintrc.json", ".mdmathlintrc.jsonc"]) {
      const path = join(directory, filename);
      if (existsSync(path)) {
        const config = parseConfig(path);
        found.push({ path, config });
        if (config.root) {
          const config = found.slice().reverse().reduce((current, entry) => mergeConfig(current, entry.config), {});
          return { path: found[0].path, config };
        }
        break;
      }
    }
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  if (!found.length) return { config: {} };
  const config = found.slice().reverse().reduce((current, entry) => mergeConfig(current, entry.config), {});
  return { path: found[0].path, config };
}
