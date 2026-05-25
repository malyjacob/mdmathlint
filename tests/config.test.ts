import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
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

  it("accepts root boundary configuration in nested workspaces", () => {
    const directory = mkdtempSync(join(tmpdir(), "mdmathlint-root-"));
    const nested = join(directory, "packages", "docs");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(directory, ".mdmathlintrc.json"), JSON.stringify({ profile: "github", rules: { MDM005: "off" } }));
    writeFileSync(join(directory, "packages", ".mdmathlintrc.json"), JSON.stringify({ root: true, profile: "strict" }));
    const loaded = findConfig(nested);
    expect(loaded.config.root).toBe(true);
    expect(loaded.config.profile).toBe("strict");
    expect(loaded.config.rules?.MDM005).toBeUndefined();
  });

  it("merges ancestor defaults unless a child config is a root boundary", () => {
    const directory = mkdtempSync(join(tmpdir(), "mdmathlint-merge-"));
    const nested = join(directory, "docs");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(directory, ".mdmathlintrc.json"), JSON.stringify({ rules: { MDM005: "off" } }));
    writeFileSync(join(nested, ".mdmathlintrc.json"), JSON.stringify({ profile: "strict" }));
    const loaded = findConfig(nested);
    expect(loaded.config.profile).toBe("strict");
    expect(loaded.config.rules?.MDM005).toBe("off");
  });
});
