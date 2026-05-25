import katex from "katex";
import type { KatexOptions } from "../types.js";

export const MAX_MATH_LENGTH = 2000;

export type KatexCheckResult =
  | { ok: true }
  | { ok: false; message: string; position?: number; internalError?: boolean; tooLong?: boolean };

export function safeKatexCheck(math: string, displayMode: boolean, options: KatexOptions = {}): KatexCheckResult {
  if (math.length > MAX_MATH_LENGTH) {
    return { ok: false, message: "Formula too long for syntax validation", tooLong: true };
  }
  try {
    katex.renderToString(math, {
      throwOnError: true,
      strict: options.strict ?? "error",
      displayMode,
      macros: options.macros ?? {},
      maxSize: 500,
      maxExpand: 1000,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof katex.ParseError) {
      return { ok: false, message: error.message, position: error.position };
    }
    return { ok: false, message: `Could not verify TeX syntax: ${String(error)}`, internalError: true };
  }
}
