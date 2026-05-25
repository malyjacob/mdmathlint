import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDocument } from "../src/core/document.js";
import { lintFiles, lintText, profileDiffText } from "../src/index.js";
import { parsePlatformMath } from "../src/parser/platformAdapters.js";
import { scanSource } from "../src/scanner/sourceScanner.js";

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

  it("recognizes formulas in headings and link text", async () => {
    const heading = await lintText("# $E=mc^2$ is a heading\n");
    const link = await lintText("Read [$x^2$](https://example.com).\n");
    expect(heading.diagnostics).toEqual([]);
    expect(link.diagnostics).toEqual([]);
  });

  it("ignores dollars protected by HTML comments", async () => {
    const result = await lintText("<!-- Price $5 and $x$ -->\n");
    expect(result.diagnostics).toEqual([]);
  });

  it("ignores dollar identifiers inside link destinations and shell variables", async () => {
    const result = await lintText("Install $PACKAGE; see [docs](https://example.com?$filter=x).\n");
    expect(result.diagnostics).toEqual([]);
  });

  it("treats an adjacent empty display delimiter as unclosed", async () => {
    const result = await lintText("$$$$\n");
    expect(codes(result)).toContain("MDM002");
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

  it("reports missing separation for consecutive display blocks", async () => {
    const result = await lintText("$$\nx\n$$\n$$\ny\n$$\n");
    expect(codes(result)).toContain("MDM004");
  });

  it("does not treat an ordinary pipe expression as a table cell", async () => {
    const result = await lintText("Conditional: left | right\n\n$$\nx\n$$\n");
    expect(codes(result)).not.toContain("MDM008");
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

describe("currency detection", () => {
  it("only inspects unmatched single dollar tokens", async () => {
    const literal = await lintText("The price is $5.\n");
    const pairedMath = await lintText("The value is $5$.\n");
    expect(codes(literal)).toContain("MDM006");
    expect(codes(pairedMath)).not.toContain("MDM006");
  });
});

describe("phase 3 parser simulation", () => {
  it("uses markdown-it recognition for the markdown-it profile", async () => {
    const result = await lintText("所以$$x=1$$成立。\n", {
      profile: "markdown-it",
      markdownItSimulation: "dollarmath",
    });
    expect(codes(result)).not.toContain("MDM015");
    expect(codes(result)).toContain("MDM014");
  });

  it("validates formulae recognized only by markdown-it", async () => {
    const result = await lintText("所以$$\\notACommand$$成立。\n", {
      profile: "markdown-it",
      markdownItSimulation: "dollarmath",
    });
    expect(codes(result)).toContain("MDM012");
  });

  it("compares diagnostics between profiles", async () => {
    const result = await profileDiffText("Try $`x+1`$ here.\n", ["github", "llm-output"]);
    expect(result.profiles.github?.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain("MDM013");
    expect(result.profiles["llm-output"]?.diagnostics.map((diagnostic) => diagnostic.code)).toContain("MDM013");
  });
});

describe("P2 semantic math rules", () => {
  it("reports nested dollar delimiters inside a braced inline formula", async () => {
    const result = await lintText("$\\text{for $x>0$}$\n");
    expect(codes(result)).toContain("MDM017");
  });

  it("reports non-portable MathJax-style TeX primitives", async () => {
    const result = await lintText("$$\na \\over b\n$$\n");
    expect(codes(result)).toContain("MDM018");
  });

  it("reports references whose labels are not defined in the document", async () => {
    const defined = await lintText("$$\nx=1\\label{eq:x}\n$$\n\nSee $\\ref{eq:x}$.\n");
    const missing = await lintText("See $\\ref{eq:missing}$.\n");
    expect(codes(defined)).not.toContain("MDM019");
    expect(codes(missing)).toContain("MDM019");
  });
});

describe("P3 platform parser adapters", () => {
  it("models platform differences for attached display delimiters", () => {
    const document = createDocument("Before $$x=1$$ after.\n");
    const pairs = scanSource(document).pairs;
    expect(parsePlatformMath(document, pairs, "pandoc")).toHaveLength(1);
    expect(parsePlatformMath(document, pairs, "obsidian")).toHaveLength(1);
    expect(parsePlatformMath(document, pairs, "goldmark")).toHaveLength(0);
  });

  it("includes the extended adapter matrix in MDM014 comparisons", async () => {
    const result = await lintText("Use $x$ here.\n", { rules: { MDM014: "warning" } });
    expect(codes(result)).toContain("MDM014");
  });
});

describe("P4 advanced semantic checks", () => {
  it("reports MathJax-specific extension commands", async () => {
    const result = await lintText("$\\require{physics} x$\n");
    expect(codes(result)).toContain("MDM020");
  });

  it("reports long, deeply nested, or macro-heavy formulas", async () => {
    const long = await lintText(`$${"x+".repeat(210)}x$\n`);
    const nested = await lintText(`$x+${"{".repeat(13)}y${"}".repeat(13)}$\n`);
    const macros = await lintText(`$${"\\RR ".repeat(21)}$`, { katex: { macros: { "\\RR": "\\mathbb{R}" } } });
    expect(codes(long)).toContain("MDM021");
    expect(codes(nested)).toContain("MDM021");
    expect(codes(macros)).toContain("MDM021");
  });

  it("resolves labels across a batch of Markdown files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mdmathlint-cross-ref-"));
    const definition = join(directory, "definition.md");
    const reference = join(directory, "reference.md");
    await writeFile(definition, "$$\nx=1\\label{eq:x}\n$$\n");
    await writeFile(reference, "See $\\ref{eq:x}$ and $\\ref{eq:missing}$.\n");
    const results = await lintFiles([definition, reference]);
    const unresolved = results.flatMap((item) => item.diagnostics.filter((diagnostic) => diagnostic.code === "MDM019"));
    expect(unresolved.map((diagnostic) => diagnostic.message)).toEqual(["reference to undefined label \"eq:missing\""]);
  });
});
