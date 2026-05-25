import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const lsp = resolve("dist/lsp.js");

function message(payload: object): string {
  const body = JSON.stringify(payload);
  return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}

describe("LSP prototype", () => {
  it("initializes and publishes lint diagnostics for an opened document", () => {
    const input = [
      message({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
      message({
        jsonrpc: "2.0",
        method: "textDocument/didOpen",
        params: { textDocument: { uri: "file:///answer.md", text: "bad $x\n" } },
      }),
    ].join("");
    const result = spawnSync(process.execPath, [lsp], { input, encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("\"textDocumentSync\":1");
    expect(result.stdout).toContain("\"MDM001\"");
  });
});
