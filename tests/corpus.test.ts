import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { lintText } from "../src/index.js";

describe("false positive corpus", () => {
  for (const file of ["shell-and-ci.md", "pricing.md", "math-identifiers.md"]) {
    it(`${file} produces no errors in strict mode`, async () => {
      const path = resolve("tests/false-positive-corpus", file);
      const result = await lintText(await readFile(path, "utf8"), { filePath: path, profile: "strict" });
      expect(result.stats.errorCount).toBe(0);
    });
  }

  // Underscore identifiers only degrade into warnings here, because a stray dollar
  // pairs up with a later line, so this fixture needs the stricter assertion.
  it("math-identifiers.md has no diagnostics at all in strict mode", async () => {
    const path = resolve("tests/false-positive-corpus", "math-identifiers.md");
    const result = await lintText(await readFile(path, "utf8"), { filePath: path, profile: "strict" });
    expect(result.diagnostics).toEqual([]);
  });
});
