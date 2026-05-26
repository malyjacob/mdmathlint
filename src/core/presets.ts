import type { ProfileName, RuleSetting } from "../types.js";

export interface Preset {
  profile: ProfileName;
  rules: Record<string, RuleSetting>;
}

export const presets: Record<string, Preset> = {
  chatgpt: {
    profile: "github",
    rules: { MDM015: "warning" },
  },
  claude: {
    profile: "markdown-it",
    rules: { MDM022: "info" },
  },
  deepseek: {
    profile: "llm-output",
    rules: { MDM005: "warning", MDM006: "off" },
  },
};

export function resolvePreset(name: string): Preset | undefined {
  return presets[name.toLowerCase()];
}
