#!/usr/bin/env node
import { lintText } from "./index.js";

interface LspRequest {
  id?: number | string;
  method: string;
  params?: {
    textDocument?: { uri?: string; text?: string };
  };
}

function response(id: number | string | undefined, result: unknown): string {
  const body = JSON.stringify({ jsonrpc: "2.0", id: id ?? null, result });
  return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}

async function handle(request: LspRequest): Promise<string | undefined> {
  if (request.method === "initialize") {
    return response(request.id, { capabilities: { textDocumentSync: 1 } });
  }
  if (request.method === "shutdown") return response(request.id, null);
  if (request.method === "textDocument/didOpen" && request.params?.textDocument?.text !== undefined) {
    const uri = request.params.textDocument.uri ?? "<lsp>";
    const result = await lintText(request.params.textDocument.text, { filePath: uri });
    const diagnostics = result.diagnostics.map((diagnostic) => ({
      range: {
        start: { line: diagnostic.range.start.line - 1, character: diagnostic.range.start.column - 1 },
        end: { line: diagnostic.range.end.line - 1, character: diagnostic.range.end.column - 1 },
      },
      severity: diagnostic.severity === "error" ? 1 : diagnostic.severity === "warning" ? 2 : 3,
      code: diagnostic.code,
      source: "mdmathlint",
      message: diagnostic.message,
    }));
    const body = JSON.stringify({
      jsonrpc: "2.0",
      method: "textDocument/publishDiagnostics",
      params: { uri, diagnostics },
    });
    return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
  }
  return request.id === undefined ? undefined : response(request.id, null);
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
  void drain();
});

async function drain(): Promise<void> {
  for (;;) {
    const separator = input.indexOf("\r\n\r\n");
    if (separator === -1) return;
    const header = input.slice(0, separator);
    const length = Number.parseInt(header.match(/Content-Length:\s*(\d+)/i)?.[1] ?? "", 10);
    if (!Number.isInteger(length)) {
      input = "";
      return;
    }
    const bodyStart = separator + 4;
    if (input.length < bodyStart + length) return;
    const body = input.slice(bodyStart, bodyStart + length);
    input = input.slice(bodyStart + length);
    const output = await handle(JSON.parse(body) as LspRequest);
    if (output) process.stdout.write(output);
  }
}
