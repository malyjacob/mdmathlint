import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { lintText } from "../src/index.js";

describe("false positive corpus", () => {
  for (const file of ["shell-and-ci.md", "pricing.md"]) {
    it(`${file} produces no errors in strict mode`, async () => {
      const path = resolve("tests/false-positive-corpus", file);
      const result = await lintText(await readFile(path, "utf8"), { filePath: path, profile: "strict" });
      expect(result.stats.errorCount).toBe(0);
    });
  }
});
