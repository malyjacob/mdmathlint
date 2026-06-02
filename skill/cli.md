# CLI — Agent Operation Guide

Use when MCP server is NOT available. All commands via shell.

## Availability Check

```bash
which mdmathlint || npx mdmathlint --version
```

If neither works: `npm install -g mdmathlint` or prefix commands with `npx`.

---

## Primary Workflow

```bash
echo "$text" | mdmathlint --stdin --profile llm-output
  → exit 0: done
  → exit 1: read bad/good examples in output → fix → re-lint
```

`--format llm` is now the default — omit it.

---

## Scenario Reference

### 1. Lint a string from stdin
```bash
echo "$text" | mdmathlint --stdin --profile llm-output
```

### 2. Lint a file you just wrote
```bash
mdmathlint answer.md --profile llm-output
```

### 3. Lint + auto-fix in place
```bash
mdmathlint answer.md --fix --profile llm-output
```
Only safe fixes applied (spacing, blank lines, delimiter placement).
Formula content is never modified.

### 4. Preview fixes without writing
```bash
mdmathlint answer.md --fix-dry-run --profile llm-output
```
Outputs a unified diff — confirm before applying.

### 5. Get LLM-consumable fix instructions
```bash
mdmathlint answer.md --fix-prompt --profile llm-output
```
Outputs natural-language fix instructions (plain text, not JSON).
Use when you want a prompt to feed back to yourself for regeneration.

### 6. Fast structural-only check
```bash
mdmathlint answer.md --profile llm-output --fast
```
Skips KaTeX validation (MDM012/MDM024) — much faster.

### 7. Batch CI quality gate
```bash
mdmathlint "output/**/*.md" --profile llm-output --max-warnings 0
```

### 8. Explain a specific rule
```bash
mdmathlint --explain MDM024
```

---

## Common Pitfalls

- **`--stdin` and `--watch` are mutually exclusive** — don't combine.
- **`--fix` and `--fix-prompt` are mutually exclusive** — pick one.
- **Default format is `llm`** — you don't need `--format llm` anymore.
- **Always pass `--profile llm-output`** — default is `portable`, not `llm-output`.
- **Stdin vs file**: `mdmathlint file.md` reads a file; `echo "..." | mdmathlint --stdin`
  reads from pipe. Don't mix them up.

---

## Config Interaction

**Config is the source of truth.** Before running any command:

1. Search for `.mdmathlintrc.json`
2. If found → omit `--profile`; config's profile is the effective default.
   Config `rules` are the baseline; your params merge on top.
   To bypass config entirely: `--no-config`.
3. If NOT found → fall back to `--profile llm-output`.
4. If you need `--profile` that contradicts config → tell the user what and
   why FIRST. Get confirmation, then apply.
