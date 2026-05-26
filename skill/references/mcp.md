# MCP Server

mdmathlint provides an MCP-compatible server (`mdmathlint-mcp`) that exposes math linting as agent-callable tools.

## Configuration

Add to your MCP client settings (Claude Desktop, Cursor, etc.):

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

Or if globally installed:

```jsonc
{
  "mcpServers": {
    "mdmathlint": {
      "command": "mdmathlint-mcp"
    }
  }
}
```

## Tools

### `lint_markdown`

Check Markdown for math rendering issues. Supports full configuration control.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `text` | string | yes | Markdown content to lint |
| `profile` | string | no | `portable` \| `strict` \| `github` \| `llm-output` \| `markdown-it` |
| `rules` | object | no | Per-rule severity overrides, e.g. `{"MDM006":"off"}` |
| `macros` | object | no | Custom LaTeX macros to suppress false MDM012/MDM024, e.g. `{"\\RR":"\\mathbb{R}"}` |
| `fast` | boolean | no | Skip KaTeX validation (structural only) |
| `fix` | boolean | no | Also apply safe auto-fixes and return `fixed` text |
| `filePath` | string | no | Virtual filename for location reporting |

Returns: JSON with `pass`, `summary`, `issues[]` (each with `severity`, `rule`, `line`, `column`, `snippet`, `examples[]`, `why`).

When `fix: true`, also returns `fixed` (corrected Markdown string) and `changed` (boolean).

### `fix_markdown`

Apply safe auto-fixes (spacing, blank lines, delimiter placement). Never modifies formula content.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `text` | string | yes | Markdown content to fix |
| `profile` | string | no | Target rendering environment |

Returns: `{ fixed, changed, original, diagnostics }`

### `explain_rule`

Get full details for a specific lint rule.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `rule_id` | string | yes | Rule code, e.g. `MDM003`, `MDM024` |

Returns: `{ id, name, severity, fixable, summary, why, examples[] }`

### `list_rules`

List all available rules with severity for a given profile.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `profile` | string | no | Show effective severities for this profile |

Returns: Array of `{ id, name, severity, fixable, summary }`

## Example: Agent self-check workflow

```
1. Agent generates Markdown with formula $E=mc^2$
2. Agent calls lint_markdown(text, profile="llm-output")
3. Response: { pass: false, issues: [{ rule: "MDM005", examples: [...] }] }
4. Agent sees bad="令$x$为" / good="令 $x$ 为" — understands the fix
5. Agent regenerates with spaces: $E=mc^2$ → $E=mc^2$ already fine
   (or calls fix_markdown(text) for auto-correction)
6. Re-lints: pass: true ✓
```

## Example: Pre-generation prevention

```
1. Agent calls list_rules(profile="llm-output")
2. Agent sees MDM005: "Inline math should be separated from prose"
3. Agent generates Markdown with spaces around inline math from the start
4. Agent calls lint_markdown(text) — clean on first pass
```
