import type { ProfileName, RuleSetting } from "../types.js";

const portable: Record<string, RuleSetting> = {
  MDM001: "error",
  MDM002: "error",
  MDM003: "warning",
  MDM004: "warning",
  MDM005: "info",
  MDM006: "info",
  MDM007: "info",
  MDM008: "warning",
  MDM009: "warning",
  MDM010: "warning",
  MDM011: "warning",
  MDM012: "error",
  MDM013: "warning",
  MDM014: "off",
  MDM015: "off",
  MDM017: "warning",
  MDM018: "warning",
  MDM019: "warning",
  MDM020: "warning",
  MDM021: "warning",
  MDM022: "off",
  MDM023: "warning",
  MDM024: "warning",
};

const overrides: Record<ProfileName, Record<string, RuleSetting>> = {
  portable: {},
  strict: { MDM003: "error", MDM005: "warning", MDM015: "warning", MDM013: "error" },
  github: { MDM005: "info", MDM013: "off" },
  "llm-output": { MDM005: "warning", MDM015: "error", MDM013: "error", MDM022: "warning" },
  "markdown-it": { MDM013: "off", MDM014: "warning", MDM015: "warning" },
};

export function resolveRules(
  profile: ProfileName = "portable",
  custom: Record<string, RuleSetting> = {},
): Record<string, RuleSetting> {
  return { ...portable, ...overrides[profile], ...custom };
}
