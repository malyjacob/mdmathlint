import { describe, expect, it } from "vitest";
import { lintText } from "../src/index.js";

function codes(result: Awaited<ReturnType<typeof lintText>>): string[] {
  return result.diagnostics.map((diagnostic) => diagnostic.code);
}

describe("core lint rules", () => {
  it("recognizes normal math while filtering shell variables and escaped dollars", async () => {
    const result = await lintText("Use $PATH and \\$5, then $x+1$.\n");
    expect(codes(result)).toEqual([]);
  });

  it("reports unclosed delimiters and KaTeX failures", async () => {
    const unclosed = await lintText("broken $x + 1\n");
    const katex = await lintText("$$\n\\frac{1}{x\n$$\n");
    const bracketUnclosed = await lintText("broken \\(x + 1\n");
    const bracketKatex = await lintText("\\[\\frac{1}{x\\]\n");
    expect(codes(unclosed)).toContain("MDM001");
    expect(codes(katex)).toContain("MDM012");
    expect(codes(bracketUnclosed)).toContain("MDM001");
    expect(codes(bracketKatex)).toContain("MDM012");
  });

  it("turns parser disagreement on by profile and suppresses display formatting", async () => {
    const result = await lintText("所以$$x=1$$成立。\n", { profile: "llm-output" });
    expect(codes(result)).toContain("MDM015");
    expect(codes(result)).not.toContain("MDM003");
  });

  it("reports markdown math examples in fenced code without parsing them", async () => {
    const result = await lintText("```md\n$x+1$\n```\n");
    expect(codes(result)).toContain("MDM007");
    expect(codes(result)).not.toContain("MDM001");
  });
});

describe("phase 2 profiles and context rules", () => {
  it("supports github backtick math only in compatible profiles", async () => {
    const strict = await lintText("Try $`x+1`$ here.\n", { profile: "strict" });
    const github = await lintText("Try $`x+1`$ here.\n", { profile: "github" });
    expect(codes(strict)).toContain("MDM013");
    expect(codes(github)).not.toContain("MDM013");
  });

  it("detects display math in table, list and malformed blockquote context", async () => {
    const table = await lintText("| value |\n| --- |\n| $$x$$ |\n");
    const list = await lintText("- item\n\n$$\nx\n$$\n");
    const quote = await lintText("> $$\nx\n> $$\n");
    expect(codes(table)).toContain("MDM008");
    expect(codes(list)).toContain("MDM009");
    expect(codes(quote)).toContain("MDM010");
  });

  it("detects inline math crossing lines", async () => {
    const result = await lintText("An expression $x +\ny$ continues.\n");
    expect(codes(result)).toContain("MDM011");
  });
});

describe("fix pipeline", () => {
  it("applies safe fixes and is idempotent", async () => {
    const original = "令$x$为变量。\n";
    const first = await lintText(original, { fix: true });
    const second = await lintText(first.fixedText!, { fix: true });
    expect(first.fixedText).toBe("令 $x$ 为变量。\n");
    expect(second.fixedText).toBeUndefined();
    expect(second.diagnostics).toEqual([]);
  });

  it("uses configured KaTeX macros", async () => {
    const withoutMacro = await lintText("$\\RR$");
    const withMacro = await lintText("$\\RR$", { katex: { macros: { "\\RR": "\\mathbb{R}" } } });
    expect(codes(withoutMacro)).toContain("MDM012");
    expect(codes(withMacro)).not.toContain("MDM012");
  });
});
