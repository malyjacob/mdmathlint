import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const lsp = resolve("dist/lsp.js");

function message(payload: object): string {
  const body = JSON.stringify(payload);
  return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}

function run(messages: object[]): Array<Record<string, unknown>> {
  const result = spawnSync(process.execPath, [lsp], {
    input: messages.map(message).join(""),
    encoding: "utf8",
  });
  expect(result.status).toBe(0);
  const payloads: Array<Record<string, unknown>> = [];
  let output = Buffer.from(result.stdout, "utf8");
  while (output.length) {
    const separator = output.indexOf("\r\n\r\n");
    if (separator === -1) break;
    const length = Number.parseInt(output.subarray(0, separator).toString("ascii").match(/Content-Length:\s*(\d+)/i)?.[1] ?? "", 10);
    const start = separator + 4;
    payloads.push(JSON.parse(output.subarray(start, start + length).toString("utf8")) as Record<string, unknown>);
    output = output.subarray(start + length);
  }
  return payloads;
}

function diagnostics(payload: Record<string, unknown>): Array<Record<string, unknown>> {
  return (payload.params as { diagnostics: Array<Record<string, unknown>> }).diagnostics;
}

describe("LSP server", () => {
  it("advertises incremental document synchronization and save support", () => {
    const payloads = run([{ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }]);
    expect(payloads[0].result).toEqual({
      capabilities: { textDocumentSync: { openClose: true, change: 2, save: { includeText: true } } },
    });
  });

  it("updates diagnostics after incremental edits and clears them on close", () => {
    const uri = "file:///answer.md";
    const payloads = run([
      { jsonrpc: "2.0", method: "textDocument/didOpen", params: { textDocument: { uri, text: "bad $x\n", version: 1 } } },
      {
        jsonrpc: "2.0",
        method: "textDocument/didChange",
        params: {
          textDocument: { uri, version: 2 },
          contentChanges: [{ range: { start: { line: 0, character: 6 }, end: { line: 0, character: 6 } }, text: "$" }],
        },
      },
      { jsonrpc: "2.0", method: "textDocument/didClose", params: { textDocument: { uri } } },
    ]);
    expect(diagnostics(payloads[0]).map((item) => item.code)).toContain("MDM001");
    expect(diagnostics(payloads[1])).toEqual([]);
    expect(diagnostics(payloads[2])).toEqual([]);
  });

  it("loads workspace config for diagnostics", () => {
    const directory = mkdtempSync(join(tmpdir(), "mdmathlint-lsp-config-"));
    const path = join(directory, "answer.md");
    writeFileSync(join(directory, ".mdmathlintrc.json"), JSON.stringify({ profile: "strict" }));
    const uri = pathToFileURL(path).href;
    const payloads = run([
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { rootUri: pathToFileURL(directory).href } },
      { jsonrpc: "2.0", method: "textDocument/didOpen", params: { textDocument: { uri, text: "令$x$为变量。\n" } } },
    ]);
    expect(diagnostics(payloads[1])).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "MDM005", severity: 2 }),
    ]));
  });

  it("requests safe fixes when a document is saved", () => {
    const uri = "file:///answer.md";
    const payloads = run([
      { jsonrpc: "2.0", method: "textDocument/didOpen", params: { textDocument: { uri, text: "令$x$为变量。\n" } } },
      { jsonrpc: "2.0", method: "textDocument/didSave", params: { textDocument: { uri }, text: "令$x$为变量。\n" } },
    ]);
    const applyEdit = payloads.find((payload) => payload.method === "workspace/applyEdit") as {
      params: { edit: { changes: Record<string, Array<{ newText: string }>> } };
    };
    expect(applyEdit.params.edit.changes[uri][0].newText).toBe("令 $x$ 为变量。\n");
    expect(diagnostics(payloads.at(-1)!)).toEqual([]);
  });
});
