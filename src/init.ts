import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { createInterface } from "node:readline";
import type { ConfigFile, ProfileName } from "./types.js";

interface Target {
  label: string;
  profile: ProfileName;
}

const targets: Record<string, Target> = {
  "1": { label: "GitHub", profile: "github" },
  "2": { label: "markdown-it", profile: "markdown-it" },
  "3": { label: "Obsidian (portable baseline)", profile: "portable" },
  "4": { label: "LLM output", profile: "llm-output" },
  "5": { label: "strict", profile: "strict" },
};

function yes(answer: string): boolean {
  return /^(?:y|yes)$/i.test(answer.trim());
}

export async function initializeConfig(directory = process.cwd()): Promise<string> {
  const input = createInterface({ input: process.stdin, terminal: false });
  const answers = input[Symbol.asyncIterator]();
  const ask = async (prompt: string): Promise<string> => {
    process.stdout.write(prompt);
    const response = await answers.next();
    return response.done ? "" : response.value.trim();
  };

  process.stdout.write("Create .mdmathlintrc.json\n");
  process.stdout.write("  1) GitHub\n  2) markdown-it\n  3) Obsidian (portable baseline)\n  4) LLM output\n  5) strict\n");
  let choice = await ask("Target rendering environment [1-5]: ");
  while (!targets[choice]) choice = await ask("Please choose 1, 2, 3, 4, or 5: ");
  const target = targets[choice];
  const enableRawDelimiterCheck = yes(await ask("Enable MDM015 raw delimiter checks? [y/N]: "));
  const config: ConfigFile = {
    profile: target.profile,
    rules: {
      MDM015: enableRawDelimiterCheck && target.profile === "llm-output" ? "error" : enableRawDelimiterCheck ? "warning" : "off",
    },
  };

  if (yes(await ask("Configure custom LaTeX macros? [y/N]: "))) {
    const macros: Record<string, string> = {};
    for (;;) {
      const name = await ask("Macro name (blank to finish, e.g. \\RR): ");
      if (!name) break;
      macros[name] = await ask(`Expansion for ${name}: `);
    }
    if (Object.keys(macros).length) config.katex = { macros };
  }
  input.close();

  const path = resolve(directory, ".mdmathlintrc.json");
  try {
    await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
      throw new Error(`Configuration file already exists: ${path}`);
    }
    throw error;
  }
  process.stdout.write(`Created ${path} for ${target.label}.\n`);
  return path;
}
