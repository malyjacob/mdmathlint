# MCP — Agent Operation Guide

Use when `mdmathlint` MCP server is configured. All tools return structured JSON.

## Prerequisites

The MCP server must be registered. If `mdmathlint` doesn't appear in your
available MCP tools, the user needs to add it to their MCP configuration:

```jsonc
{
  "mcpServers": {
    "mdmathlint": {
      "command": "npx",
      "args": ["-y", "mdmathlint-mcp"]
    }
  }
}
```

Once registered and reconnected, the tools become available.

---

## Tools at a Glance

| Tool | Purpose | Use When |
|---|---|---|
| `lint_markdown` | Lint text for math issues | **Every time** you generate Markdown with math |
| `fix_markdown` | Auto-fix spacing/blank lines | Quick cleanup of MDM003/004/005 |
| `list_rules` | List rules + severities | Pre-generation prevention (optional) |
| `explain_rule` | Get rule details | Need to understand a specific rule hit |

---

## Primary Workflow

```
lint_markdown(text, profile="llm-output")
  ↓
{ pass: true } → done, return content
{ pass: false } → for each issue:
    read examples[].bad / examples[].good
    fix the Markdown
    re-lint
```

---

## Quick Patterns

### One-shot lint + fix
```
fix_markdown(text, profile="llm-output")
// Returns { fixed, changed } — use fixed if changed
```

### Lint with auto-fix in one call
```
lint_markdown(text, profile="llm-output", fix: true)
// Returns { pass, fixed, changed } — use fixed if changed
```

### Fast structural-only check (skip KaTeX)
```
lint_markdown(text, profile="llm-output", fast: true)
// Faster; catches structural rules but skips MDM012/MDM024
```

### Suppress false positives with macros
```
lint_markdown(text, profile="llm-output", macros: {"\\RR": "\\mathbb{R}"})
// KaTeX won't flag \RR as unknown
```

### Custom rule overrides
```
lint_markdown(text, profile="llm-output", rules: {"MDM006": "off"})
// Disable currency false-positive rule when text has prices
```

---

## Config Interaction

**Config is the source of truth.** Before any lint call:

1. Search for `.mdmathlintrc.json`
2. If found → use its `profile` as-is. Omit the `profile` param from your call.
   Config `rules` are the baseline; your `rules` param merges on top.
3. If NOT found → fall back to `profile="llm-output"`.
4. If you need an override that contradicts config → tell the user what and
   why FIRST. Get confirmation, then apply.

---

## Common Pitfalls

- **Forgetting `profile="llm-output"`** — default is `portable`, which leaves
  MDM015 off. ALWAYS pass `profile="llm-output"` for AI-generated content.
- **Ignoring `examples` in the response** — the `bad`/`good` pairs are the
  fastest way to understand what to fix. Read them before guessing.
- **Not re-linting after fix** — always verify `pass: true` before returning.
- **Overriding user config silently** — if config exists, acknowledge it.
