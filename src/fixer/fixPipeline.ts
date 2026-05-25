import type { Diagnostic, Fix } from "../types.js";

const priority: Record<string, number> = { MDM003: 0, MDM004: 1, MDM005: 2, MDM006: 3 };

function conflicts(left: Fix, right: Fix): boolean {
  if (left.range.start.offset === left.range.end.offset && right.range.start.offset === right.range.end.offset) {
    return left.range.start.offset === right.range.start.offset;
  }
  return left.range.start.offset < right.range.end.offset && right.range.start.offset < left.range.end.offset;
}

export function collectFixes(diagnostics: Diagnostic[]): Fix[] {
  const candidates = diagnostics
    .flatMap((diagnostic) => diagnostic.fixes ?? [])
    .sort((left, right) => {
      const byRule = (priority[left.code ?? ""] ?? 99) - (priority[right.code ?? ""] ?? 99);
      return byRule || right.range.start.offset - left.range.start.offset;
    });
  const selected: Fix[] = [];
  candidates.forEach((fix) => {
    if (!selected.some((existing) => conflicts(existing, fix))) selected.push(fix);
  });
  return selected.sort((left, right) => right.range.start.offset - left.range.start.offset);
}

export function applyFixes(text: string, fixes: Fix[]): string {
  return fixes.reduce(
    (result, fix) => `${result.slice(0, fix.range.start.offset)}${fix.replacement}${result.slice(fix.range.end.offset)}`,
    text,
  );
}
