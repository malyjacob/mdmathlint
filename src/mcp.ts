#!/usr/bin/env node
import { lintText, type LintOptions, type ProfileName, type RuleSetting } from "./index.js";
import { getRuleInfo } from "./rules/catalog.js";
import { rulesMetadata } from "./rules/rules-metadata.js";
import { resolveRules } from "./core/profiles.js";
import { reportLlm } from "./diagnostics/reporters.js";
import { VERSION } from "./version.js";
import { rpcError, rpcResponse, startRpcServer, type JsonRpcRequest } from "./transport/jsonRpcStdio.js";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_NAME = "mdmathlint";
const SERVER_VERSION = VERSION;

const ALLOWED_PROFILES: ProfileName[] = ["portable", "strict", "github", "llm-output", "markdown-it"];

function isProfile(value: unknown): value is ProfileName {
  return typeof value === "string" && (ALLOWED_PROFILES as string[]).includes(value);
}

// ── Tool definitions ──────────────────────────────────────────────

const toolDefinitions = [
  {
    name: "lint_markdown",
    description:
      "Check Markdown for math rendering issues. Returns issues with severity, line/column location, explanations, bad/good examples, and a fix_prompt for LLM self-correction.",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: {
          type: "string",
          description: "Markdown content to lint",
        },
        profile: {
          type: "string",
          enum: ALLOWED_PROFILES,
          description: "Target rendering environment (default: portable)",
        },
        rules: {
          type: "object",
          description: 'Per-rule severity overrides, e.g. {"MDM006":"off","MDM015":"warning"}',
        },
        macros: {
          type: "object",
          description: 'Custom LaTeX macros to suppress MDM012/MDM024 false positives, e.g. {"\\\\RR":"\\\\mathbb{R}"}',
        },
        fast: {
          type: "boolean",
          description: "Skip KaTeX parse validation, only run structural checks (default: false)",
        },
        fix: {
          type: "boolean",
          description: "Also apply safe auto-fixes and return the fixed Markdown in the response",
        },
        filePath: {
          type: "string",
          description: "Virtual filename for diagnostic location reporting (optional)",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "fix_markdown",
    description:
      "Apply safe auto-fixes to Markdown math formatting (spacing, blank lines, delimiter placement). Will NOT modify formula content — only whitespace and delimiter position.",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: {
          type: "string",
          description: "Markdown content to fix",
        },
        profile: {
          type: "string",
          enum: ALLOWED_PROFILES,
          description: "Target rendering environment (default: portable)",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "explain_rule",
    description:
      "Get full explanation for a math lint rule: what it checks, default severity, whether auto-fix is supported, why it matters, and bad/good examples.",
    inputSchema: {
      type: "object" as const,
      properties: {
        rule_id: {
          type: "string",
          description: "Rule code, e.g. MDM003, MDM015, MDM012",
        },
      },
      required: ["rule_id"],
    },
  },
  {
    name: "list_rules",
    description:
      "List all available math lint rules with their IDs, names, default severity for the chosen profile, fixable flag, and one-line summary.",
    inputSchema: {
      type: "object" as const,
      properties: {
        profile: {
          type: "string",
          enum: ALLOWED_PROFILES,
          description: "Show rules with this profile's effective severities (default: portable)",
        },
      },
    },
  },
];

// ── Tool handlers ─────────────────────────────────────────────────

async function lintTool(args: Record<string, unknown>): Promise<unknown> {
  const text = typeof args.text === "string" ? args.text : "";
  const profile = isProfile(args.profile) ? args.profile : "portable";
  const filePath = typeof args.filePath === "string" ? args.filePath : "<mcp>";
  const fast = args.fast === true;
  const applyFix = args.fix === true;
  const rules = args.rules && typeof args.rules === "object" ? args.rules as Record<string, RuleSetting> : undefined;
  const macros = args.macros && typeof args.macros === "object" ? args.macros as Record<string, string> : undefined;

  const options: LintOptions = {
    profile,
    filePath,
    fast,
    rules,
    katex: macros ? { macros } : undefined,
  };

  if (applyFix) {
    const fixedResult = await lintText(text, { ...options, fix: true });
    const lintResult = await lintText(fixedResult.fixedText ?? text, options);
    const output = JSON.parse(reportLlm([lintResult])) as Record<string, unknown>;
    return {
      ...output,
      fixed: fixedResult.fixedText ?? text,
      changed: fixedResult.fixedText !== undefined && fixedResult.fixedText !== text,
    };
  }

  const result = await lintText(text, options);
  return JSON.parse(reportLlm([result]));
}

async function fixTool(args: Record<string, unknown>): Promise<unknown> {
  const text = typeof args.text === "string" ? args.text : "";
  const profile = isProfile(args.profile) ? args.profile : "portable";

  const result = await lintText(text, { profile, filePath: "<mcp>", fix: true });

  return {
    fixed: result.fixedText ?? text,
    changed: result.fixedText !== undefined && result.fixedText !== text,
    original: text,
    diagnostics: result.diagnostics.length,
  };
}

function explainTool(args: Record<string, unknown>): unknown {
  const ruleId = typeof args.rule_id === "string" ? args.rule_id.trim() : "";
  if (!ruleId) throw new Error("rule_id is required");

  const info = getRuleInfo(ruleId);
  if (!info) throw new Error(`Unknown rule: ${ruleId}`);

  return {
    id: ruleId.toUpperCase(),
    name: info.name,
    severity: info.defaultSeverity,
    fixable: info.fixable,
    summary: info.summary,
    why: info.why,
    examples: info.examples,
  };
}

function listRulesTool(args: Record<string, unknown>): unknown {
  const profile = isProfile(args.profile) ? args.profile : "portable";
  const settings = resolveRules(profile);
  return Object.entries(rulesMetadata).map(([id, info]) => ({
    id,
    name: info.name,
    severity: settings[id] ?? info.defaultSeverity,
    fixable: info.fixable,
    summary: info.summary,
  }));
}

// ── MCP protocol handler ──────────────────────────────────────────

async function handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "lint_markdown": return lintTool(args);
    case "fix_markdown":  return fixTool(args);
    case "explain_rule":  return explainTool(args);
    case "list_rules":    return listRulesTool(args);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

function textContent(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

async function handle(request: JsonRpcRequest): Promise<string[]> {
  const method = request.method;

  // --- initialize ---
  if (method === "initialize") {
    return [rpcResponse(request.id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
    })];
  }

  // --- notifications/initialized ---
  if (method === "notifications/initialized") {
    return []; // no response
  }

  // --- tools/list ---
  if (method === "tools/list") {
    return [rpcResponse(request.id, { tools: toolDefinitions })];
  }

  // --- tools/call ---
  if (method === "tools/call") {
    const params = request.params as { name?: string; arguments?: Record<string, unknown> } | undefined;
    const name = params?.name;
    const args = params?.arguments ?? {};

    if (!name) {
      return [rpcError(request.id, -32602, "Missing tool name")];
    }

    try {
      const result = await handleToolCall(name, args);
      return [rpcResponse(request.id, textContent(JSON.stringify(result, null, 2)))];
    } catch (error: unknown) {
      return [rpcError(request.id, -32000, error instanceof Error ? error.message : String(error))];
    }
  }

  // --- ping ---
  if (method === "ping") {
    return [rpcResponse(request.id, {})];
  }

  // --- unknown ---
  return request.id === undefined ? [] : [rpcError(request.id, -32601, `Method not found: ${method}`)];
}

startRpcServer(handle);
