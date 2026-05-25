import type { Position, Range } from "../types.js";

export interface SourceDocument {
  path: string;
  text: string;
  lines: string[];
  lineOffsets: number[];
}

export function createDocument(text: string, path = "<text>"): SourceDocument {
  const lines = text.split(/\r?\n/);
  const lineOffsets = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") lineOffsets.push(index + 1);
  }
  return { path, text, lines, lineOffsets };
}

export function positionAt(document: SourceDocument, offset: number): Position {
  const bounded = Math.max(0, Math.min(offset, document.text.length));
  let low = 0;
  let high = document.lineOffsets.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (document.lineOffsets[mid] <= bounded) low = mid + 1;
    else high = mid - 1;
  }
  const lineIndex = Math.max(0, high);
  return {
    line: lineIndex + 1,
    column: bounded - document.lineOffsets[lineIndex] + 1,
    offset: bounded,
  };
}

export function rangeAt(document: SourceDocument, start: number, end: number): Range {
  return { start: positionAt(document, start), end: positionAt(document, end) };
}
