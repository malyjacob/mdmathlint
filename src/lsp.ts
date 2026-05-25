#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { findConfig, lintText, type LintOptions } from "./index.js";
import type { Diagnostic } from "./types.js";

interface LspPosition {
  line: number;
  character: number;
}

interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

interface TextDocument {
  uri: string;
  text?: string;
  version?: number;
}

interface ContentChange {
  range?: LspRange;
  text: string;
}

interface LspRequest {
  id?: number | string;
  method?: string;
  params?: {
    rootUri?: string | null;
    workspaceFolders?: Array<{ uri: string }>;
    textDocument?: TextDocument;
    contentChanges?: ContentChange[];
    text?: string;
  };
}

interface OpenDocument {
  text: string;
  version?: number;
}

const documents = new Map<string, OpenDocument>();
let workspaceDirectories: string[] = [];
let outgoingRequestId = 1;

function message(payload: object): string {
  const body = JSON.stringify(payload);
  return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}

function response(id: number | string | undefined, result: unknown): string {
  return message({ jsonrpc: "2.0", id: id ?? null, result });
}

function notification(method: string, params: object): string {
  return message({ jsonrpc: "2.0", method, params });
}

function filePathFromUri(uri: string): string | undefined {
  if (!uri.startsWith("file:")) return undefined;
  try {
    return fileURLToPath(uri);
  } catch {
    return undefined;
  }
}

function offsetAt(text: string, position: LspPosition): number {
  const lines = text.split(/\r?\n/);
  const line = Math.max(0, Math.min(position.line, lines.length - 1));
  let offset = 0;
  for (let index = 0; index < line; index += 1) offset += lines[index].length + 1;
  return offset + Math.max(0, Math.min(position.character, lines[line]?.length ?? 0));
}

function endPosition(text: string): LspPosition {
  const lines = text.split(/\r?\n/);
  return { line: lines.length - 1, character: lines.at(-1)?.length ?? 0 };
}

function applyChanges(text: string, changes: ContentChange[]): string {
  return changes.reduce((current, change) => {
    if (!change.range) return change.text;
    const start = offsetAt(current, change.range.start);
    const end = offsetAt(current, change.range.end);
    return `${current.slice(0, start)}${change.text}${current.slice(end)}`;
  }, text);
}

function configStartDirectory(uri: string): string {
  const filePath = filePathFromUri(uri);
  if (filePath) return dirname(filePath);
  return workspaceDirectories[0] ?? process.cwd();
}

function lintOptions(uri: string, fix = false): LintOptions {
  const { config } = findConfig(configStartDirectory(uri));
  return {
    filePath: filePathFromUri(uri) ?? uri,
    profile: config.profile ?? "portable",
    rules: config.rules,
    katex: config.katex,
    fixOptions: config.fix,
    fix,
  };
}

function asLspDiagnostic(diagnostic: Diagnostic) {
  return {
    range: {
      start: { line: diagnostic.range.start.line - 1, character: diagnostic.range.start.column - 1 },
      end: { line: diagnostic.range.end.line - 1, character: diagnostic.range.end.column - 1 },
    },
    severity: diagnostic.severity === "error" ? 1 : diagnostic.severity === "warning" ? 2 : 3,
    code: diagnostic.code,
    source: "mdmathlint",
    message: diagnostic.message,
  };
}

async function diagnosticsFor(uri: string, text: string, fix = false) {
  return lintText(text, lintOptions(uri, fix));
}

function publish(uri: string, diagnostics: Diagnostic[]): string {
  return notification("textDocument/publishDiagnostics", {
    uri,
    diagnostics: diagnostics.map(asLspDiagnostic),
  });
}

async function documentText(uri: string): Promise<string | undefined> {
  const open = documents.get(uri)?.text;
  if (open !== undefined) return open;
  const filePath = filePathFromUri(uri);
  if (!filePath) return undefined;
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}

async function handle(request: LspRequest): Promise<string[]> {
  if (!request.method) return [];
  if (request.method === "initialize") {
    workspaceDirectories = (request.params?.workspaceFolders ?? [])
      .map((folder) => filePathFromUri(folder.uri))
      .filter((directory): directory is string => Boolean(directory));
    const root = request.params?.rootUri ? filePathFromUri(request.params.rootUri) : undefined;
    if (root && workspaceDirectories.length === 0) workspaceDirectories = [root];
    return [response(request.id, {
      capabilities: {
        textDocumentSync: { openClose: true, change: 2, save: { includeText: true } },
      },
    })];
  }
  if (request.method === "shutdown") return [response(request.id, null)];
  if (request.method === "exit") return [];

  const textDocument = request.params?.textDocument;
  if (!textDocument?.uri) return request.id === undefined ? [] : [response(request.id, null)];
  const uri = textDocument.uri;

  if (request.method === "textDocument/didOpen" && textDocument.text !== undefined) {
    documents.set(uri, { text: textDocument.text, version: textDocument.version });
    const result = await diagnosticsFor(uri, textDocument.text);
    return [publish(uri, result.diagnostics)];
  }
  if (request.method === "textDocument/didChange") {
    const original = documents.get(uri)?.text ?? "";
    const text = applyChanges(original, request.params?.contentChanges ?? []);
    documents.set(uri, { text, version: textDocument.version });
    const result = await diagnosticsFor(uri, text);
    return [publish(uri, result.diagnostics)];
  }
  if (request.method === "textDocument/didClose") {
    documents.delete(uri);
    return [publish(uri, [])];
  }
  if (request.method === "textDocument/didSave") {
    const text = request.params?.text ?? await documentText(uri);
    if (text === undefined) return [];
    documents.set(uri, { text, version: documents.get(uri)?.version });
    const result = await diagnosticsFor(uri, text, true);
    const outputs: string[] = [];
    if (result.fixedText !== undefined && result.fixedText !== text) {
      documents.set(uri, { text: result.fixedText, version: documents.get(uri)?.version });
      outputs.push(message({
        jsonrpc: "2.0",
        id: outgoingRequestId++,
        method: "workspace/applyEdit",
        params: {
          label: "mdmathlint auto-fix",
          edit: {
            changes: {
              [uri]: [{
                range: { start: { line: 0, character: 0 }, end: endPosition(text) },
                newText: result.fixedText,
              }],
            },
          },
        },
      }));
    }
    outputs.push(publish(uri, result.diagnostics));
    return outputs;
  }
  return request.id === undefined ? [] : [response(request.id, null)];
}

let input = Buffer.alloc(0);
let processing = Promise.resolve();
process.stdin.on("data", (chunk: Buffer) => {
  input = Buffer.concat([input, chunk]);
  processing = processing.then(drain).catch((error: unknown) => {
    process.stderr.write(`mdmathlint-lsp: ${error instanceof Error ? error.message : String(error)}\n`);
  });
});

async function drain(): Promise<void> {
  for (;;) {
    const separator = input.indexOf("\r\n\r\n");
    if (separator === -1) return;
    const header = input.subarray(0, separator).toString("ascii");
    const length = Number.parseInt(header.match(/Content-Length:\s*(\d+)/i)?.[1] ?? "", 10);
    if (!Number.isInteger(length)) {
      input = Buffer.alloc(0);
      return;
    }
    const bodyStart = separator + 4;
    if (input.length < bodyStart + length) return;
    const body = input.subarray(bodyStart, bodyStart + length).toString("utf8");
    input = input.subarray(bodyStart + length);
    const outputs = await handle(JSON.parse(body) as LspRequest);
    outputs.forEach((output) => process.stdout.write(output));
  }
}

process.stdin.on("end", () => {
  const keepAlive = setInterval(() => undefined, 1000);
  processing = processing
    .then(drain)
    .catch((error: unknown) => {
      process.stderr.write(`mdmathlint-lsp: ${error instanceof Error ? error.message : String(error)}\n`);
    })
    .finally(() => clearInterval(keepAlive));
});
