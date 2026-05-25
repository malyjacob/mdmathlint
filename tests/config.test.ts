import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findConfig } from "../src/index.js";

describe("config loading", () => {
  it("loads jsonc profile and severity overrides", () => {
    const directory = mkdtempSync(join(tmpdir(), "mdmathlint-"));
    writeFileSync(join(directory, ".mdmathlintrc.jsonc"), `{
      // Phase 2 configuration
      "profile": "strict",
      "rules": { "MDM005": "off" },
    }`);
    const loaded = findConfig(directory);
    expect(loaded.config.profile).toBe("strict");
    expect(loaded.config.rules?.MDM005).toBe("off");
  });
});
