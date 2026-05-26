import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const cli = resolve("dist/cli.js");

async function waitForOutput(read: () => string, expected: string): Promise<void> {
  const deadline = Date.now() + 5000;
  while (!read().includes(expected)) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for output containing ${expected}`);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  }
}

describe("CLI", () => {
  it("lints stdin as JSON with a profile", async () => {
    const stdout = execFileSync(process.execPath, [cli, "--stdin", "--profile", "strict", "--format", "json"], {
      input: "令$x$为数列。\n",
      encoding: "utf8",
    });
    expect(stdout).toContain("\"version\": \"1.1.0\"");
    expect(stdout).toContain("\"MDM005\"");
  });

  it("applies safe fixes to a markdown file", async () => {
    const directory = mkdtempSync(join(tmpdir(), "mdmathlint-cli-"));
    const path = join(directory, "case.md");
    writeFileSync(path, "令$x$为变量。\n");
    execFileSync(process.execPath, [cli, path, "--fix"]);
    expect(readFileSync(path, "utf8")).toBe("令 $x$ 为变量。\n");
  });

  it("previews fixes as a unified diff without rewriting a markdown file", () => {
    const directory = mkdtempSync(join(tmpdir(), "mdmathlint-preview-"));
    const path = join(directory, "case.md");
    writeFileSync(path, "令$x$为变量。\n");
    const output = execFileSync(process.execPath, [cli, path, "--fix-dry-run"], { encoding: "utf8" });
    expect(output).toContain(`--- a/${path}`);
    expect(output).toContain(`+++ b/${path}`);
    expect(output).toContain("-令$x$为变量。");
    expect(output).toContain("+令 $x$ 为变量。");
    expect(output).not.toContain("would be modified");
    expect(readFileSync(path, "utf8")).toBe("令$x$为变量。\n");
  });

  it("returns code 1 for errors and code 2 for bad inputs", async () => {
    expect(() => execFileSync(process.execPath, [cli, "--stdin"], { input: "bad $x\n" }))
      .toThrow(expect.objectContaining({ status: 1 }));
    expect(() => execFileSync(process.execPath, [cli]))
      .toThrow(expect.objectContaining({ status: 2 }));
  });

  it("emits SARIF diagnostics", () => {
    const output = execFileSync(process.execPath, [cli, "--stdin", "--profile", "strict", "--format", "sarif"], {
      input: "令$x$为变量。\n",
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    expect(output).toContain("\"version\": \"2.1.0\"");
    expect(output).toContain("\"ruleId\": \"MDM005\"");
  });

  it("explains a rule without input files", () => {
    const output = execFileSync(process.execPath, [cli, "--explain", "MDM003"], { encoding: "utf8" });
    expect(output).toContain("display-delimiter-not-own-line");
    expect(output).toContain("Fixable: yes");
  });

  it("outputs profile differences", () => {
    const result = spawnSync(process.execPath, [cli, "--stdin", "--profile-diff", "github,llm-output", "--format", "json"], {
      input: "Try $`x+1`$ here.\n",
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("\"profiles\"");
    expect(result.stdout).toContain("\"MDM013\"");
  });

  it("shows a source frame in pretty diagnostics", () => {
    const output = execFileSync(process.execPath, [cli, "--stdin", "--profile", "strict", "--no-color"], {
      input: "令$x$为变量。\n",
      encoding: "utf8",
    });
    expect(output).toContain("warning[MDM005]");
    expect(output).toContain("1 | 令$x$为变量。");
    expect(output).toContain("|  ^^^");
  });

  it("supports ANSI color controls and NO_COLOR", () => {
    const colored = execFileSync(process.execPath, [cli, "--stdin", "--profile", "strict", "--color"], {
      input: "令$x$为变量。\n",
      encoding: "utf8",
    });
    const noColor = execFileSync(process.execPath, [cli, "--stdin", "--profile", "strict"], {
      input: "令$x$为变量。\n",
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    });
    expect(colored).toContain("\u001b[33mwarning[MDM005]\u001b[0m");
    expect(colored).toContain("\u001b[33m ^^^\u001b[0m");
    expect(noColor).not.toContain("\u001b[");
  });

  it("initializes a configuration interactively", () => {
    const directory = mkdtempSync(join(tmpdir(), "mdmathlint-init-"));
    const output = execFileSync(process.execPath, [cli, "--init"], {
      cwd: directory,
      input: "2\ny\ny\n\\RR\n\\mathbb{R}\n\n",
      encoding: "utf8",
    });
    const config = JSON.parse(readFileSync(join(directory, ".mdmathlintrc.json"), "utf8"));
    expect(config).toEqual({
      profile: "markdown-it",
      rules: { MDM015: "warning" },
      katex: { macros: { "\\RR": "\\mathbb{R}" } },
    });
    expect(output).toContain("Created");
  });

  it("does not overwrite an existing configuration during initialization", () => {
    const directory = mkdtempSync(join(tmpdir(), "mdmathlint-init-existing-"));
    const path = join(directory, ".mdmathlintrc.json");
    writeFileSync(path, "{\"profile\":\"github\"}\n");
    const result = spawnSync(process.execPath, [cli, "--init"], {
      cwd: directory,
      input: "5\nn\nn\n",
      encoding: "utf8",
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Configuration file already exists");
    expect(readFileSync(path, "utf8")).toBe("{\"profile\":\"github\"}\n");
  });

  it("can skip discovered configuration files", () => {
    const directory = mkdtempSync(join(tmpdir(), "mdmathlint-no-config-"));
    writeFileSync(join(directory, ".mdmathlintrc.json"), JSON.stringify({ rules: { MDM005: "off" } }));
    const inherited = execFileSync(process.execPath, [cli, "--stdin", "--format", "json"], {
      cwd: directory,
      input: "令$x$为变量。\n",
      encoding: "utf8",
    });
    const isolated = execFileSync(process.execPath, [cli, "--stdin", "--no-config", "--format", "json"], {
      cwd: directory,
      input: "令$x$为变量。\n",
      encoding: "utf8",
    });
    expect(inherited).not.toContain("\"MDM005\"");
    expect(isolated).toContain("\"MDM005\"");
  });

  it("rechecks changed Markdown files in watch mode", async () => {
    const directory = mkdtempSync(join(tmpdir(), "mdmathlint-watch-"));
    const path = join(directory, "watch.md");
    writeFileSync(path, "Good $x$.\n");
    const child = spawn(process.execPath, [cli, path, "--watch", "--no-color"], {
      cwd: directory,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    try {
      await waitForOutput(() => stdout, "0 error(s)");
      writeFileSync(path, "bad $x\n");
      await waitForOutput(() => stdout, "MDM001");
    } finally {
      child.kill();
    }
  });

  it("resolves references against labels in another input file", () => {
    const directory = mkdtempSync(join(tmpdir(), "mdmathlint-cross-ref-"));
    const definition = join(directory, "definition.md");
    const reference = join(directory, "reference.md");
    writeFileSync(definition, "$$\nx=1\\label{eq:x}\n$$\n");
    writeFileSync(reference, "See $\\ref{eq:x}$.\n");
    const result = spawnSync(process.execPath, [cli, definition, reference, "--format", "json"], { encoding: "utf8" });
    expect(result.stdout).not.toContain("\"MDM019\"");
  });

  it("outputs llm format with structured JSON including pass, issues, examples, and fix_prompt", () => {
    const stdout = execFileSync(process.execPath, [cli, "--stdin", "--format", "llm"], {
      input: "令$x$为变量。\n",
      encoding: "utf8",
    });
    const parsed = JSON.parse(stdout) as Record<string, unknown>;

    // top-level structure
    expect(typeof parsed.pass).toBe("boolean");
    expect(parsed.summary).toBeDefined();
    expect(Array.isArray(parsed.files)).toBe(true);
    expect(typeof parsed.fix_prompt).toBe("string");
    expect((parsed.fix_prompt as string).length).toBeGreaterThan(0);

    // files[0].issues
    const file = (parsed.files as Array<Record<string, unknown>>)[0];
    const issue = (file.issues as Array<Record<string, unknown>>)[0];
    expect(issue.severity).toBeDefined();
    expect(typeof issue.rule).toBe("string");
    expect(typeof issue.line).toBe("number");
    expect(typeof issue.column).toBe("number");
    expect(typeof issue.message).toBe("string");
    expect(typeof issue.snippet).toBe("string");
    expect(Array.isArray(issue.examples)).toBe(true);
    expect(typeof issue.why).toBe("string");
  });

  it("reports pass=false in llm format when errors are present", () => {
    const result = spawnSync(process.execPath, [cli, "--stdin", "--format", "llm", "--profile", "llm-output"], {
      input: "unclosed $x\n",
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(parsed.pass).toBe(false);
    expect((parsed.summary as Record<string, number>).errors).toBeGreaterThanOrEqual(1);
  });

  it("outputs fix-prompt as plain text with regenerate instructions and bad/good examples", () => {
    const stdout = execFileSync(process.execPath, [cli, "--stdin", "--fix-prompt", "--profile", "llm-output"], {
      input: "令$x$为变量。\n",
      encoding: "utf8",
    });
    // should be plain text, not JSON
    expect(() => JSON.parse(stdout)).toThrow();
    expect(stdout).toContain("Regenerate it with these fixes");
    expect(stdout).toContain("MDM005");
    expect(stdout).toContain("Bad:");
    expect(stdout).toContain("Good:");
    expect(stdout).toContain("--- Original Markdown ---");
  });

  it("rejects mutually exclusive --fix-prompt with --format llm", () => {
    expect(() =>
      execFileSync(process.execPath, [cli, "--stdin", "--fix-prompt", "--format", "llm"], {
        input: "test\n",
        encoding: "utf8",
      }),
    ).toThrow(expect.objectContaining({ status: 2 }));
  });

  it("rejects mutually exclusive --fix-prompt with --fix", () => {
    expect(() =>
      execFileSync(process.execPath, [cli, "--stdin", "--fix-prompt", "--fix"], {
        input: "test\n",
        encoding: "utf8",
      }),
    ).toThrow(expect.objectContaining({ status: 2 }));
  });

  it("flags mixed dollar and bracket delimiter styles as MDM023", () => {
    const stdout = execFileSync(process.execPath, [cli, "--stdin", "--format", "json"], {
      input: "$x+1$ and \\(y+2\\)\n",
      encoding: "utf8",
    });
    expect(stdout).toContain("\"MDM023\"");
  });

  it("flags unknown LaTeX commands as MDM024", () => {
    const result = spawnSync(process.execPath, [cli, "--stdin", "--format", "json"], {
      input: "$$\n\\differential{x}\n$$\n",
      encoding: "utf8",
    });
    expect(result.stdout).toContain("\"MDM024\"");
  });

  it("skips KaTeX validation in --fast mode but still catches structural issues", () => {
    const fast = spawnSync(process.execPath, [cli, "--stdin", "--fast", "--format", "json"], {
      input: "unclosed $x\n$$\n\\frac{1}{x\n$$\n",
      encoding: "utf8",
    });
    expect(fast.stdout).toContain("\"MDM001\"");  // structural — always fires
    expect(fast.stdout).not.toContain("\"MDM012\"");  // KaTeX — skipped
  });

  it("runs KaTeX validation without --fast", () => {
    const full = spawnSync(process.execPath, [cli, "--stdin", "--format", "json"], {
      input: "$$\n\\frac{1}{x\n$$\n",
      encoding: "utf8",
    });
    expect(full.stdout).toContain("\"MDM012\"");  // KaTeX — runs
  });

  it("applies deepseek preset (llm-output + relaxed currency)", () => {
    const result = spawnSync(process.execPath, [cli, "--stdin", "--preset", "deepseek", "--format", "json"], {
      input: "令$x$为变量。The price is $5.\n",
      encoding: "utf8",
    });
    expect(result.stdout).toContain("\"MDM005\"");  // CJK spacing still on
    expect(result.stdout).not.toContain("\"MDM006\"");  // currency off per preset
  });

  it("applies chatgpt preset and detects unrecognized delimiters", () => {
    const result = spawnSync(process.execPath, [cli, "--stdin", "--preset", "chatgpt", "--format", "json"], {
      input: "所以$$x=1$$成立。\n",
      encoding: "utf8",
    });
    expect(result.stdout).toContain("\"MDM015\"");  // raw delimiter check on
  });
});
