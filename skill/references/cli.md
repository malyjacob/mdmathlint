# CLI Reference

```
mdmathlint [files...] [options]
```

Short alias: `mdml`

## Options

### Input

| Option | Description |
|---|---|
| `[files...]` | Markdown files or glob patterns |
| `--stdin` | Read Markdown from stdin |
| `--stdin-filename <name>` | Virtual filename for stdin diagnostics (default: `<stdin>`) |

### Profile & Configuration

| Option | Description |
|---|---|
| `--profile <name>` | `portable` \| `strict` \| `github` \| `llm-output` \| `markdown-it` |
| `--preset <name>` | Shortcut: `chatgpt` \| `claude` \| `deepseek` |
| `--profile-diff <a,b>` | Compare diagnostics across profiles |
| `--config <path>` | Explicit config file path |
| `--no-config` | Skip discovered configuration files |
| `--init` | Create `.mdmathlintrc.json` interactively |

### Output Format

| Option | Description |
|---|---|
| `--format <format>` | `pretty` (default) \| `json` \| `sarif` \| `llm` |
| `--color` / `--no-color` | Force or disable ANSI color in pretty output |
| `--fix-prompt` | Output natural-language fix prompt for LLM consumption |

### Auto-fix

| Option | Description |
|---|---|
| `--fix` | Apply safe fixes (spacing, blank lines, delimiter placement) |
| `--fix-dry-run` | Preview fixes as unified diff without writing |

### Performance

| Option | Description |
|---|---|
| `--fast` | Skip KaTeX parse validation — only structural checks |
| `--watch` | Re-run when input files change |

### Info

| Option | Description |
|---|---|
| `--explain <rule-id>` | Print rule description, examples, and rationale |
| `--version` | Print version number |
| `--max-warnings <n>` | Exit code 1 if warnings exceed `n` |

## Presets

`--preset` is a shortcut that sets `profile` + `rules` together:

| Preset | Profile | Extra rules |
|---|---|---|
| `chatgpt` | `github` | `MDM015: "warning"` |
| `claude` | `markdown-it` | `MDM022: "info"` |
| `deepseek` | `llm-output` | `MDM005: "warning"`, `MDM006: "off"` |

Preset applies first; config file and `--profile` can override.

## Output formats

### `pretty` (default)
Rust-style human-readable diagnostics with source frames and caret markers.

### `json`
Machine-consumable JSON with full diagnostic data (offsets, ranges).

### `sarif`
GitHub CodeQL / VS Code compatible. Use with `github/codeql-action/upload-sarif`.

### `llm`
LLM-optimized JSON:
- `pass` / `summary` — quick pass/fail
- `issues[]` — each with `severity`, `rule`, `line`, `column`, `message`, `help`, `why`, `snippet`, `examples[]`
- `fix_prompt` — natural-language fix instructions ready to feed back to LLM

## Exit codes

| Code | Meaning |
|---|---|
| 0 | No errors (warnings/info ok unless `--max-warnings 0`) |
| 1 | Errors found |
| 2 | Bad input / invalid arguments |

## Examples

```bash
# Check a single file
mdmathlint README.md --profile strict

# Batch glob
mdmathlint "docs/**/*.md" --profile github

# Stdin with LLM output format
echo "令$x$为变量。" | mdmathlint --stdin --profile llm-output --format llm

# Fix-prompt for LLM consumption
mdmathlint answer.md --fix-prompt --profile llm-output

# Profile comparison
mdmathlint answer.md --profile-diff github,llm-output

# CI quality gate
mdmathlint "output/**/*.md" --profile llm-output --max-warnings 0

# Fast structural-only check
mdmathlint "docs/**/*.md" --profile strict --fast
```
