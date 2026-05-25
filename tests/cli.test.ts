import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const cli = resolve("dist/cli.js");

describe("CLI", () => {
  it("lints stdin as JSON with a profile", async () => {
    const stdout = execFileSync(process.execPath, [cli, "--stdin", "--profile", "strict", "--format", "json"], {
      input: "令$x$为数列。\n",
      encoding: "utf8",
    });
    expect(stdout).toContain("\"MDM005\"");
  });

  it("applies safe fixes to a markdown file", async () => {
    const directory = mkdtempSync(join(tmpdir(), "mdmathlint-cli-"));
    const path = join(directory, "case.md");
    writeFileSync(path, "令$x$为变量。\n");
    execFileSync(process.execPath, [cli, path, "--fix"]);
    expect(readFileSync(path, "utf8")).toBe("令 $x$ 为变量。\n");
  });

  it("previews fixes without rewriting a markdown file", () => {
    const directory = mkdtempSync(join(tmpdir(), "mdmathlint-preview-"));
    const path = join(directory, "case.md");
    writeFileSync(path, "令$x$为变量。\n");
    const output = execFileSync(process.execPath, [cli, path, "--fix-dry-run"], { encoding: "utf8" });
    expect(output).toContain("would be modified");
    expect(readFileSync(path, "utf8")).toBe("令$x$为变量。\n");
  });

  it("returns code 1 for errors and code 2 for bad inputs", async () => {
    expect(() => execFileSync(process.execPath, [cli, "--stdin"], { input: "bad $x\n" }))
      .toThrow(expect.objectContaining({ status: 1 }));
    expect(() => execFileSync(process.execPath, [cli]))
      .toThrow(expect.objectContaining({ status: 2 }));
  });
});
