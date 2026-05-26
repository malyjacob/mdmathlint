import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const mcp = resolve("dist/mcp.js");

function message(payload: object): string {
  const body = JSON.stringify(payload);
  return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}

function run(messages: object[]): Array<Record<string, unknown>> {
  const result = spawnSync(process.execPath, [mcp], {
    input: messages.map(message).join(""),
    encoding: "utf8",
  });
  expect(result.status).toBe(0);
  const payloads: Array<Record<string, unknown>> = [];
  let output = Buffer.from(result.stdout, "utf8");
  while (output.length) {
    const separator = output.indexOf("\r\n\r\n");
    if (separator === -1) break;
    const length = Number.parseInt(
      output.subarray(0, separator).toString("ascii").match(/Content-Length:\s*(\d+)/i)?.[1] ?? "",
      10,
    );
    const start = separator + 4;
    payloads.push(JSON.parse(output.subarray(start, start + length).toString("utf8")) as Record<string, unknown>);
    output = output.subarray(start + length);
  }
  return payloads;
}

function contentText(payload: Record<string, unknown>): string {
  const content = (payload.result as { content: Array<{ text: string }> }).content;
  return content[0]?.text ?? "";
}

function contentJson(payload: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(contentText(payload)) as Record<string, unknown>;
}

describe("MCP server", () => {
  it("advertises protocol version, tools capability, and server info on initialize", () => {
    const payloads = run([
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0" } } },
    ]);
    expect(payloads[0].result).toMatchObject({
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "mdmathlint", version: "1.1.0" },
    });
  });

  it("responds to ping", () => {
    const payloads = run([
      { jsonrpc: "2.0", id: 1, method: "ping" },
    ]);
    expect(payloads[0].result).toEqual({});
    expect(payloads[0].error).toBeUndefined();
  });

  it("returns exactly 4 tools from tools/list", () => {
    const payloads = run([
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
    ]);
    const tools = (payloads[0].result as { tools: Array<{ name: string; inputSchema: Record<string, unknown> }> }).tools;
    expect(tools).toHaveLength(4);
    const names = tools.map((t) => t.name);
    expect(names).toContain("lint_markdown");
    expect(names).toContain("fix_markdown");
    expect(names).toContain("explain_rule");
    expect(names).toContain("list_rules");
  });

  it("each tool has required inputSchema fields", () => {
    const payloads = run([
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
    ]);
    const tools = (payloads[0].result as { tools: Array<{ name: string; inputSchema: { type: string; required?: string[]; properties: Record<string, unknown> } }> }).tools;
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.properties).toBeDefined();
      if (tool.name === "list_rules") continue; // no required fields
      expect(tool.inputSchema.required).toBeDefined();
    }
  });

  it("list_rules returns 20 rules with profile-aware severities", () => {
    const payloads = run([
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_rules", arguments: { profile: "llm-output" } } },
    ]);
    const rules = contentJson(payloads[0]) as unknown as Array<Record<string, unknown>>;
    expect(rules.length).toBeGreaterThanOrEqual(20);

    // llm-output profile: MDM015 → error, MDM013 → error, MDM005 → warning
    const mdm015 = rules.find((r) => r.id === "MDM015");
    expect(mdm015?.severity).toBe("error");

    const mdm013 = rules.find((r) => r.id === "MDM013");
    expect(mdm013?.severity).toBe("error");

    const mdm005 = rules.find((r) => r.id === "MDM005");
    expect(mdm005?.severity).toBe("warning");

    const mdm023 = rules.find((r) => r.id === "MDM023");
    expect(mdm023?.severity).toBe("warning");

    // each rule has required fields
    for (const rule of rules) {
      expect(rule.id).toBeDefined();
      expect(rule.name).toBeDefined();
      expect(rule.severity).toBeDefined();
      expect(typeof rule.fixable).toBe("boolean");
      expect(rule.summary).toBeDefined();
    }
  });

  it("explain_rule returns full metadata with examples", () => {
    const payloads = run([
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "explain_rule", arguments: { rule_id: "MDM003" } } },
    ]);
    const info = contentJson(payloads[0]);
    expect(info.id).toBe("MDM003");
    expect(info.name).toBe("display-delimiter-not-own-line");
    expect(info.severity).toBe("warning");
    expect(info.fixable).toBe(true);
    expect(info.summary).toBeDefined();
    expect(info.why).toBeDefined();
    expect(Array.isArray(info.examples)).toBe(true);
    expect((info.examples as Array<unknown>).length).toBeGreaterThan(0);
  });

  it("explain_rule returns error for unknown rule", () => {
    const payloads = run([
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "explain_rule", arguments: { rule_id: "MDM999" } } },
    ]);
    expect(payloads[0].error).toBeDefined();
    expect((payloads[0].error as { message: string }).message).toContain("Unknown rule");
  });

  it("lint_markdown detects issues and returns llm-formatted output", () => {
    const payloads = run([
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "lint_markdown", arguments: { text: "令$x$为变量。", profile: "llm-output" } } },
    ]);
    const result = contentJson(payloads[0]);
    expect(result.pass).toBe(true); // only warnings, no errors
    expect(result.summary.warnings).toBeGreaterThanOrEqual(1);
    expect(result.summary.errors).toBe(0);
    expect(Array.isArray(result.files)).toBe(true);
    expect(result.files[0].issues.length).toBeGreaterThanOrEqual(1);

    const ruleIds = result.files[0].issues.map((i: { rule: string }) => i.rule);
    expect(ruleIds).toContain("MDM005");
    expect(ruleIds).toContain("MDM022");

    const mdm005 = result.files[0].issues.find((i: { rule: string }) => i.rule === "MDM005");
    expect(mdm005.severity).toBe("warning");
    expect(typeof mdm005.line).toBe("number");
    expect(typeof mdm005.column).toBe("number");
    expect(mdm005.snippet).toBeDefined();
    expect(Array.isArray(mdm005.examples)).toBe(true);
    expect(mdm005.examples.length).toBeGreaterThan(0);

    const mdm022 = result.files[0].issues.find((i: { rule: string }) => i.rule === "MDM022");
    expect(mdm022.severity).toBe("info");

    expect(typeof result.fix_prompt).toBe("string");
    expect(result.fix_prompt.length).toBeGreaterThan(0);
  });

  it("lint_markdown detects errors (pass=false)", () => {
    const payloads = run([
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "lint_markdown", arguments: { text: "$$x=1$$", profile: "llm-output" } } },
    ]);
    const result = contentJson(payloads[0]);
    expect(result.pass).toBe(false);
    expect(result.summary.errors).toBeGreaterThanOrEqual(1);
  });

  it("fix_markdown applies spacing fix and reports changed=true", () => {
    const payloads = run([
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "fix_markdown", arguments: { text: "令$x$为变量。", profile: "llm-output" } } },
    ]);
    const result = contentJson(payloads[0]);
    expect(result.changed).toBe(true);
    expect(result.fixed).toBe("令 $x$ 为变量。");
    expect(result.original).toBe("令$x$为变量。");
    expect(result.diagnostics).toBeGreaterThanOrEqual(0);
  });

  it("fix_markdown reports changed=false when no issues", () => {
    const payloads = run([
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "fix_markdown", arguments: { text: "Hello world.", profile: "portable" } } },
    ]);
    const result = contentJson(payloads[0]);
    expect(result.changed).toBe(false);
    expect(result.fixed).toBe("Hello world.");
  });

  it("returns method-not-found error for unknown method", () => {
    const payloads = run([
      { jsonrpc: "2.0", id: 1, method: "unknown/method" },
    ]);
    expect(payloads[0].error).toBeDefined();
    expect((payloads[0].error as { code: number }).code).toBe(-32601);
  });

  it("lint_markdown detects mixed delimiter styles as MDM023", () => {
    const payloads = run([
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "lint_markdown", arguments: { text: "$x+1$ and \\(y+2\\)\n" } } },
    ]);
    const result = contentJson(payloads[0]);
    const ruleIds = result.files[0].issues.map((i: { rule: string }) => i.rule);
    expect(ruleIds).toContain("MDM023");
  });

  it("lint_markdown flags unknown LaTeX commands as MDM024", () => {
    const payloads = run([
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "lint_markdown", arguments: { text: "$$\n\\differential{x}\n$$\n" } } },
    ]);
    const result = contentJson(payloads[0]);
    const ruleIds = result.files[0].issues.map((i: { rule: string }) => i.rule);
    expect(ruleIds).toContain("MDM024");
  });

  it("lint_markdown fast mode skips KaTeX validation but keeps structural checks", () => {
    const payloads = run([
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "lint_markdown", arguments: { text: "unclosed $x\n$$\n\\frac{1}{x\n$$\n", fast: true } } },
    ]);
    const result = contentJson(payloads[0]);
    const ruleIds = result.files[0].issues.map((i: { rule: string }) => i.rule);
    expect(ruleIds).toContain("MDM001");  // structural — always
    expect(ruleIds).not.toContain("MDM012");  // KaTeX — skipped
  });

  it("lint_markdown respects per-call rule overrides", () => {
    const payloads = run([
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "lint_markdown", arguments: { text: "令$x$为变量。The price is $5.\n", rules: { "MDM005": "off", "MDM006": "off" } } } },
    ]);
    const result = contentJson(payloads[0]);
    const ruleIds = result.files[0].issues.map((i: { rule: string }) => i.rule);
    expect(ruleIds).not.toContain("MDM005");  // turned off per rules
    expect(ruleIds).not.toContain("MDM006");  // turned off per rules
  });

  it("lint_markdown with macros suppresses MDM024 for known commands", () => {
    const payloads = run([
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "lint_markdown", arguments: { text: "$$\n\\RR\n$$\n", macros: { "\\RR": "\\mathbb{R}" } } } },
    ]);
    const result = contentJson(payloads[0]);
    const ruleIds = result.files[0].issues.map((i: { rule: string }) => i.rule);
    expect(ruleIds).not.toContain("MDM024");  // \RR is known via macros
  });

  it("lint_markdown with fix=true returns fixed text and changed flag", () => {
    const payloads = run([
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "lint_markdown", arguments: { text: "令$x$为变量。\n", profile: "llm-output", fix: true } } },
    ]);
    const result = contentJson(payloads[0]);
    expect(result.fixed).toBe("令 $x$ 为变量。\n");
    expect(result.changed).toBe(true);
    // still has issues (MDM022 info about delimiter style preference)
    expect(Array.isArray(result.files?.[0]?.issues)).toBe(true);
  });
});
