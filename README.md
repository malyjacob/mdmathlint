# mdmathlint

A static analysis tool for math in Markdown. Catch formulas that **won't render** before you publish — instead of eyeballing it after deployment.

```bash
# full name
mdmathlint "docs/**/*.md" --profile strict

# or the short alias
mdml "docs/**/*.md" --profile strict
```

---

## Table of Contents

- [What problem does this solve](#what-problem-does-this-solve)
- [Install](#install)
- [Quick start](#quick-start)
- [Rule reference](#rule-reference)
- [Profiles](#profiles)
- [Configuration](#configuration)
- [CLI reference](#cli-reference)
- [Auto-fix](#auto-fix)
- [CI integration](#ci-integration)
- [Editor plugins](#editor-plugins)
- [Caveats and common mistakes](#caveats-and-common-mistakes)
- [Development](#development)

> 中文用户请阅读 [README_zh.md](README_zh.md)。

---

## What problem does this solve

Markdown math rendering fails **silently**. You write `$x+1$` in your README, push to GitHub, and only discover after deployment that half your formulas render as raw text — with no indication that anything is wrong while you're writing.

mdmathlint catches three categories of failure before you commit:

### 1. Delimiters exist, but the parser doesn't recognize them

```markdown
So $$x=1$$ holds.
```

You intended display math, but `$$` isn't on its own line. GitHub, remark, and most parsers won't recognize it as a math node. The `$$` renders as literal text. **KaTeX or MathJax is never invoked**, because the parser never created a math node.

mdmathlint's **raw scanner** discovers every `$` and `$$` in the source, then cross-checks against the parser's AST. Delimiters the parser missed are reported as MDM015.

### 2. The formula is recognized, but the TeX is broken

```markdown
$$
\frac{1}{x
$$
```

KaTeX throws a `ParseError`. mdmathlint catches it and **maps KaTeX's internal offset back to the Markdown line:column** — you see `line 3, column 5` instead of "position 7".

### 3. Cross-platform inconsistency

The same document renders fine on GitHub but breaks in Obsidian. Works with markdown-it + dollarmath but fails under remark-math. Different parsers disagree on `$` adjacency rules, blank-line requirements, and `` $`...`$ `` backtick syntax.

mdmathlint's 5 profiles map to 5 real rendering environments. Compare them with one command:

```bash
mdmathlint answer.md --profile-diff github,markdown-it
```

---

## Install

### Global (recommended)

```bash
npm install -g mdmathlint
```

The `mdmathlint` command is then available everywhere:

```bash
mdmathlint README.md --profile strict
```

### Project-local

```bash
npm install --save-dev mdmathlint
```

Use via `npx` or in `package.json` scripts:

```bash
npx mdmathlint "docs/**/*.md" --profile strict
```

---

## Quick start

No configuration needed. The default `portable` profile balances false positives and false negatives:

```bash
mdmathlint README.md
```

Example output:

```
error[MDM001]: unclosed inline math delimiter
 --> README.md:12:5
 help: Close the delimiter or escape a literal dollar sign.

warning[MDM005]: inline math should be separated from adjacent text
 --> README.md:3:2
 help: Add spaces around inline math.

1 error(s), 1 warning(s), 0 info message(s)
```

### Recommended minimal config

Create a `.mdmathlintrc.json` in your project root:

```jsonc
{
  "profile": "strict",
  "rules": {
    "MDM015": "warning"
  }
}
```

These three lines cover 90% of the value:
- `strict` elevates all formatting rules to their strictest levels
- `MDM015: "warning"` enables the core check — delimiters the parser didn't recognize (this rule is off by default; see [Caveats](#caveats-and-common-mistakes))

After that, no `--profile` flag needed:

```bash
mdmathlint "docs/**/*.md"
```

---

## Rule reference

mdmathlint performs **three passes** over every document: (1) raw source scan — finds every `$` / `$$`; (2) Markdown parser — determines which are actual math nodes; (3) KaTeX parser — validates TeX syntax inside formulas. The three pipelines cross-validate in the rule engine.

15 rules organized into five categories. Run `mdmathlint --explain <rule-id>` for full details on any rule, including bad and good examples.

### Delimiter structure — "the formula was never recognized"

| Rule | Default | Fixable | Detects |
|---|---|---|---|
| **MDM001** | error | no | Unclosed `$` — corrupts the rest of the document |
| **MDM002** | error | no | Unclosed `$$` — display math never terminates |
| **MDM003** | warning | **yes** | `$$` not on its own line — most parsers reject it |
| **MDM004** | warning | **yes** | Display block missing surrounding blank lines |
| **MDM015** | **off** | no | Raw `$` / `$$` exists but the parser didn't recognize it |

> MDM015 is the single rule that distinguishes mdmathlint from every KaTeX wrapper. It ships off by default — you should turn it on. See [Caveats](#caveats-and-common-mistakes).

### Formula formatting — "it renders, but looks wrong"

| Rule | Default | Fixable | Detects |
|---|---|---|---|
| **MDM005** | info | **yes** | Inline math touching CJK or Latin text — `令$x$为` |
| **MDM008** | warning | no | `$$...$$` inside a GFM table cell |
| **MDM009** | warning | no | Display math in a list item with wrong indentation |
| **MDM010** | warning | no | Blockquote display math with inconsistent `>` markers |
| **MDM011** | warning | no | Inline math crossing a line boundary — `$x +\ny$` |

### False-positive mitigation — "that's not math at all"

| Rule | Default | Fixable | Detects |
|---|---|---|---|
| **MDM006** | info | no | `$5`, `$1,000` — likely currency, not math |
| **MDM007** | info | no | `$x$` inside a Markdown code example — intentionally visible |

### TeX syntax — "recognized, but the content is invalid"

| Rule | Default | Fixable | Detects |
|---|---|---|---|
| **MDM012** | error | no | KaTeX `ParseError` — missing brace, unknown command, bad nesting |

### Cross-platform — "works on GitHub, breaks elsewhere"

| Rule | Default | Fixable | Detects |
|---|---|---|---|
| **MDM013** | warning | no | `` $`...`$ `` backtick delimiters — only GitHub / markdown-it support them |
| **MDM014** | off | no | Same formula recognized differently by remark vs texmath vs dollarmath |

### Before / after

**MDM003** — display delimiter not on its own line:

```markdown
❌ So $$x=1$$ holds.
✅ So

$$
x=1
$$

holds.
```

**MDM005** — inline math touching text:

```markdown
❌ Let$x$be a variable.
✅ Let $x$ be a variable.
```

**MDM012** — KaTeX parse error:

```markdown
❌ $$\frac{1}{x$$
✅ $$\frac{1}{x}$$
```

---

## Profiles

Profiles are pre-tuned severity maps for real rendering environments. Choose the one that matches your target platform rather than tweaking individual rules.

### Built-in profiles

| Profile | Best for | Key differences from `portable` |
|---|---|---|
| **`portable`** | General use (default) | Balanced; MDM015 off |
| **`strict`** | Maximum portability | MDM003 → error, MDM005 → warning, MDM015 → warning |
| **`github`** | GitHub README / Issues / Wiki | MDM013 off (allows `` $`...`$ ``), MDM005 → info |
| **`llm-output`** | AI-generated content quality gate | MDM015 → error, MDM005 → warning, MDM013 → error |
| **`markdown-it`** | markdown-it + texmath/dollarmath | MDM014 on, uses markdown-it recognition for MDM015 |

### Choosing by use case

| Your situation | Recommended profile | Extra config |
|---|---|---|
| Personal blog, deployed to GitHub Pages | `github` | `"MDM015": "warning"` |
| Team docs repo, multiple contributors | `strict` | `"MDM015": "warning"` |
| Validating AI / LLM output | `llm-output` | None needed |
| Publishing to GitHub and a custom site | `markdown-it` | `"MDM014": "warning"` + use `--profile-diff` |

### Per-rule overrides

The `rules` field overrides any rule's severity regardless of profile:

```jsonc
{
  "profile": "github",
  "rules": {
    "MDM015": "warning",    // enable parser-recognition check
    "MDM006": "off"         // your docs mention prices often
  }
}
```

### Cross-profile comparison

See how the same document fares under different rendering chains:

```bash
mdmathlint answer.md --profile-diff github,markdown-it

# Output:
# answer.md
#   github: clean
#   markdown-it: error[MDM013], warning[MDM015]
```

JSON format for scripting:

```bash
mdmathlint answer.md --profile-diff github,llm-output --format json
```

---

## Configuration

mdmathlint auto-discovers `.mdmathlintrc.json` or `.mdmathlintrc.jsonc` (supports comments and trailing commas) by walking up from the current directory. Use `--config <path>` to specify a path explicitly.

### Full schema

```jsonc
{
  // Target rendering environment (default "portable")
  "profile": "strict",

  // Per-rule severity overrides
  // Values: "off" | "info" | "warning" | "error"
  "rules": {
    "MDM015": "warning",
    "MDM006": "off",
    "MDM005": "warning"
  },

  // KaTeX parse options
  "katex": {
    // Strict mode: "error" (default) | "warn" | "ignore"
    // Downgrade when processing non-standard TeX dialects
    "strict": "error",

    // Custom LaTeX macros — prevents false MDM012 positives
    "macros": {
      "\\RR": "\\mathbb{R}",
      "\\NN": "\\mathbb{N}",
      "\\argmax": "\\mathop{\\mathrm{argmax}}\\limits",
      "\\E": "\\mathbb{E}"
    }
  },

  // Auto-fix behavior (defaults shown)
  "fix": {
    "inlineSpacing": true,       // add spaces around inline math
    "displayOwnLine": true,      // split display delimiters to own lines
    "currencyDollar": false      // escape $5 → \$5 (off by default — high risk)
  }
}
```

### Per-scenario configs

**Personal blog (GitHub Pages / Vercel):**

Goal: ensure all formulas render under the GitHub rendering chain.

```jsonc
{
  "profile": "github",
  "rules": { "MDM015": "warning" }
}
```

**AI output validation:**

Goal: LLM-generated Markdown must have zero rendering defects.

```jsonc
{
  "profile": "llm-output"
}
```

No extra config needed — the `llm-output` profile already sets MDM015 to error, MDM005 to warning, and MDM013 to error. Run in CI with:

```bash
mdmathlint "output/**/*.md" --profile llm-output --max-warnings 0
```

**Team docs repository:**

Goal: consistent formatting, auto-fix locally, quality gate in CI.

```jsonc
{
  "profile": "strict",
  "rules": {
    "MDM015": "warning",
    "MDM006": "off"
  },
  "fix": {
    "inlineSpacing": true,
    "displayOwnLine": true,
    "currencyDollar": false
  }
}
```

Run `mdmathlint "docs/**/*.md" --fix` locally to auto-correct spacing and blank lines. CI runs the same config without `--fix` as a quality gate.

**Custom KaTeX macros:**

If your documents use custom LaTeX commands, missing macros cause false MDM012 positives:

```jsonc
{
  "profile": "strict",
  "rules": { "MDM015": "warning" },
  "katex": {
    "macros": {
      "\\RR": "\\mathbb{R}",
      "\\NN": "\\mathbb{N}"
    }
  }
}
```

### Severity levels and exit codes

| Level | Meaning | Exit code impact |
|---|---|---|
| `error` | Likely causes broken rendering | Exit 1 |
| `warning` | Not portable across all platforms | Exit 0 (unless `--max-warnings 0`) |
| `info` | Advisory; may be a false positive | Exit 0 |
| `off` | Rule disabled | — |

Force warnings to fail CI:

```bash
mdmathlint "docs/**/*.md" --max-warnings 0
```

### Suppression chains

Multiple rules can fire on the same formula span. mdmathlint's internal suppression chain filters out redundant diagnostics — you don't need to manually disable anything:

```
MDM001/MDM002 (unclosed)
  └─ suppresses MDM003, MDM004       ← formatting is irrelevant if unclosed

MDM015 (parser didn't recognize)
  └─ suppresses MDM003, MDM004, MDM005 ← formatting rules are meaningless

MDM006 (likely currency)
  └─ suppresses MDM005               ← non-math dollar doesn't need spacing

MDM007 (in code block)
  └─ suppresses MDM001, MDM002, MDM012 ← intentionally visible source code
```

Example: `So $$x=1$$ holds.` triggers both MDM015 (not recognized) and MDM003 (not on own line), but the suppression chain ensures you only see MDM015 — the formatting issue is a symptom, not the root cause.

---

## CLI reference

```
mdmathlint [files...] [options]

Options:
  --stdin                       read Markdown from stdin
  --stdin-filename <name>       virtual filename for stdin diagnostics
  --profile <name>              portable|strict|github|llm-output|markdown-it
  --profile-diff <a,b>          compare diagnostics across two or more profiles
  --markdown-it-simulation <name>  texmath|dollarmath (default dollarmath)
  --config <path>               explicit config file path
  --format <format>             pretty (default) | json | sarif
  --fix                         apply safe fixes (spacing, blank lines, delimiter placement)
  --fix-dry-run                 preview fixes without writing files
  --explain <rule-id>           print a rule's description, examples, and rationale
  --max-warnings <n>            exit code 1 if warnings exceed n
```

### Piped input

```bash
echo "Let $x$ be a variable." | mdmathlint --stdin --profile strict
cat draft.md | mdmathlint --stdin --stdin-filename draft.md --format json
```

### Batch checking

```bash
# glob patterns
mdmathlint "docs/**/*.md" --profile strict

# multiple files
mdmathlint README.md CONTRIBUTING.md CHANGELOG.md --profile github
```

### Output formats

**pretty** (default) — Rust-style human-readable diagnostics:

```
error[MDM001]: unclosed inline math delimiter
 --> README.md:12:5
 help: Close the delimiter or escape a literal dollar sign.

1 error(s), 1 warning(s), 0 info message(s)
```

**json** — machine-consumable:

```bash
mdmathlint README.md --format json
```

**sarif** — GitHub CodeQL / VS Code compatible:

```bash
mdmathlint "docs/**/*.md" --profile strict --format sarif > mdmathlint.sarif
```

### Looking up rules

```bash
mdmathlint --explain MDM003
```

Prints the rule name, default severity, whether it's fixable, bad/good examples, and the rationale.

---

## Auto-fix

`--fix` only applies **safe, conservative** fixes — it will never modify your formula content or guess missing braces. Fixable rules:

| Rule | What it fixes |
|---|---|
| MDM003 | Splits `$$` delimiters to their own lines with surrounding blank lines |
| MDM004 | Adds blank lines before and after display blocks |
| MDM005 | Adds spaces on both sides of inline math |
| MDM006 | Escapes currency `$` as `\$` (requires `fix.currencyDollar: true` — off by default) |

```bash
# modify files in place
mdmathlint "docs/**/*.md" --fix

# preview only, no writes
mdmathlint "docs/**/*.md" --fix-dry-run
```

The fix pipeline guarantees **idempotency** — running `--fix` twice produces the same result as running it once. Overlapping fixes trigger conflict detection; the higher-priority fix wins. At most 5 iterations; if it doesn't stabilize, an `MDM-INTERNAL-FIX` warning is emitted.

---

## CI integration

### GitHub Actions (reusable action)

```yaml
- uses: malyjacob/mdmathlint@v1
  with:
    files: "docs/**/*.md"
    profile: strict
```

### GitHub Actions (SARIF + PR annotations)

```yaml
- run: mdmathlint "docs/**/*.md" --profile strict --format sarif > mdmathlint.sarif
- uses: github/codeql-action/upload-sarif@v3
  if: always()
  with:
    sarif_file: mdmathlint.sarif
```

SARIF output embeds diagnostics directly in GitHub PR diffs — formula issues appear inline on the affected line, like ESLint squiggles.

### Generic CI (any platform)

```bash
mdmathlint "content/**/*.md" --format json --max-warnings 0
# non-zero exit → CI fails
```

### pre-commit

```yaml
- repo: https://github.com/malyjacob/mdmathlint
  rev: v0.4.0
  hooks:
    - id: mdmathlint
```

---

## Editor plugins

### remark / unified plugin

Run mdmathlint as part of a unified processing pipeline:

```js
import { unified } from "unified";
import remarkParse from "remark-parse";
import { VFile } from "vfile";
import remarkMathLint from "mdmathlint/remark-lint";

const processor = unified()
  .use(remarkParse)
  .use(remarkMathLint, { profile: "strict" });

const file = new VFile({ value: "Let $x$ be a variable." });
await processor.run(processor.parse(file), file);

file.messages.forEach((msg) => {
  // msg.ruleId → "MDM005"
  // msg.reason → "inline math should be separated from adjacent text"
  // msg.line / msg.column → position
  // msg.fatal → true for errors, false for warnings
});
```

### LSP (experimental)

```bash
mdmathlint-lsp
# or the short alias
mdml-lsp
```

Provides LSP over stdio. Supports `textDocument/didOpen`. Configure your editor's LSP client to launch this binary for `.md` files. Currently a prototype — incremental updates (`didChange`) are not yet supported.

### Browser playground

Open [`docs/playground.html`](docs/playground.html) in any browser — a static page with zero dependencies. Provides delimiter placement checks (browser-side approximations of MDM003 and MDM005). Full KaTeX validation and parser comparison require the CLI.

---

## Caveats and common mistakes

### Why MDM015 is off by default

MDM015 is the rule that separates mdmathlint from every KaTeX wrapper — it finds "the parser never recognized your formula at all." It ships `off` because:

- Any non-math text with a literal `$` can trigger it (e.g. "this service costs $5/month")
- It needs the raw scanner's shell-variable filtering, escape handling, and link-destination exclusion all working before it's safe to enable

**Those filters were implemented and verified in Phase 2.** You should turn MDM015 on:

```jsonc
{ "rules": { "MDM015": "warning" } }
```

### Don't manually disable rules the suppression chain handles

See both MDM015 and MDM003 firing on the same `$$x=1$$`? Don't disable MDM003 — the suppression chain already filters it out. You'll only see MDM015 in the final output because the formatting issue is a symptom, not the root cause.

### Currency false positives

If your docs frequently mention prices (`$5`, `$1,000`), MDM006 can be noisy. Recommended approach:

```jsonc
{ "rules": { "MDM006": "off" } }
```

Don't enable `fix.currencyDollar` unless you're certain every `$` + digits combination in your docs should be escaped. Prepending `\` to `$5` → `\$5` can break readability in non-math contexts.

### Configure your KaTeX macros

If your documents use custom LaTeX commands (common in math, physics, and ML writing), missing macros produce false MDM012 positives. KaTeX doesn't know `\RR` → your rendering chain might. Declare them in config.

### `--fix` never touches formula content

`--fix` only adjusts whitespace and delimiter placement around formulas. It will **never** modify the TeX inside `$...$` or `$$...$$`. A syntactically broken formula (MDM012) must be fixed by hand.

### Don't combine `--fix` with `--profile-diff`

`--fix` is a mutating operation; `--profile-diff` is a comparison operation. They're not designed to work together — `--profile-diff` ignores `--fix`.

### Empty delimiters are handled correctly

`$$$$` (four consecutive dollar signs) is an edge case. The raw scanner detects adjacent `$$` tokens with no content between them and refuses to pair them as an empty display block, reporting MDM002 (unclosed) instead. This prevents literal dollar-sign sequences from being mistaken for math.

---

## Development

```bash
git clone https://github.com/malyjacob/mdmathlint
cd mdmathlint
npm install
npm run build
npm test
npm run typecheck
npm run benchmark -- "mdmathlint-plan/**/*.md"
```

TypeScript + ESM. `npm run build` compiles to `dist/`. `npm run prepare` (triggered automatically by `npm publish`) ensures `dist/` is current at publish time.
