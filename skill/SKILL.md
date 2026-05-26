# mdmathlint — Agent Skill

A static analysis tool for math in Markdown. Catch formulas that **won't render** before you publish.

## When to use this tool

Invoke mdmathlint whenever you generate Markdown that contains mathematical formulas (`$...$`, `$$...$$`, `\(...\)`, `\[...\]`). Common triggers:

- **LLM output validation** — you just generated a Markdown answer with math; lint it before returning to the user
- **Documentation authoring** — writing READMEs, tech blogs, or project docs with equations
- **CI quality gate** — checking math in a batch of Markdown files
- **Cross-platform portability** — verifying formulas work on both GitHub and a custom static site

## Integration methods

Pick one based on your context:

| Method | Use when | Command / Code |
|---|---|---|
| **CLI pipe** | One-shot lint, stdin input | `echo "$text" \| mdmathlint --stdin --profile llm-output --format llm` |
| **CLI fix-prompt** | Get fix instructions for LLM | `mdmathlint file.md --fix-prompt --profile llm-output` |
| **Library API** | Programmatic use in Node.js | `import { lintText } from "mdmathlint"` |
| **MCP Server** | Agent-native tool calling | Configure `mdmathlint-mcp` in MCP settings |

## Profile selection guide

| Profile | Best for |
|---|---|
| `portable` | General purpose (default) |
| `strict` | Maximum compatibility across platforms |
| `github` | GitHub README / Issues / Wiki |
| `llm-output` | AI-generated content quality gate |
| `markdown-it` | markdown-it + texmath/dollarmath pipeline |

For LLM output validation, **always use `llm-output`** — it elevates MDM015 (unrecognized delimiters) to error level.

## Typical workflows

### Workflow 1: Self-check after generating Markdown

```
1. Generate Markdown with math
2. Run: lint_markdown(text, profile="llm-output")
3. If pass=false:
   a. Read issues[].examples for bad/good guidance
   b. Fix the Markdown
   c. Re-run lint
4. (Optional) Run fix_markdown(text) to auto-correct spacing/blank lines
```

### Workflow 2: Pre-generation prevention

```
1. Run: list_rules(profile="llm-output")
2. Note rules that apply (e.g., MDM005: add spaces around inline math)
3. Generate Markdown with these rules in mind
4. Run: lint_markdown(text) to verify
```

### Workflow 3: Batch quality gate

```bash
mdmathlint "output/**/*.md" --profile llm-output --format llm --max-warnings 0
```

## Quick rule reference

See [references/rules.md](references/rules.md) for the full 22-rule catalog. Most frequent issues:

| Rule | Detects | Fix |
|---|---|---|
| MDM001/002 | Unclosed `$` / `$$` | Close the delimiter |
| MDM003 | `$$` not on own line | Put `$$` on separate lines |
| MDM005 | Math touching CJK/Latin text | Add spaces: `$x$` → ` $x$ ` |
| MDM012 | KaTeX parse error | Correct the TeX syntax |
| MDM015 | `$` not recognized as math | Reposition delimiters |

## More details

- [rules.md](references/rules.md) — All 22 rules with examples
- [cli.md](references/cli.md) — CLI options reference
- [profiles.md](references/profiles.md) — Profile comparison matrix
- [mcp.md](references/mcp.md) — MCP Server tool definitions
