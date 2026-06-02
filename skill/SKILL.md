# mdmathlint — Agent Skill

Catch Markdown math formulas that **won't render** before returning content to the user.

All generated content containing `$...$`, `$$...$$`, `\(...\)`, or `\[...\]` must be linted.

---

## 🔴 Step 0 — Availability Check

**mdmathlint must be reachable before you proceed.**

```
1. MCP server "mdmathlint" registered? → YES: use MCP (read mcp.md). Skip rest.
2. CLI available?  which mdmathlint || npx mdmathlint --version
   → OK: use CLI (read cli.md)
   → FAIL: SKILL UNAVAILABLE. Tell user:
           "mdmathlint is not installed. To enable this skill:
            • npm install -g mdmathlint
            • Or register MCP: npx mdmathlint-mcp"
```

If neither path works, STOP. Do not continue with this skill.

---

## 🔴 Step 1 — Read Project Configuration

**Search for `.mdmathlintrc.json` in the project root and parent directories.**

```
Found?
  ├─ YES → USER CONFIG IS THE SOURCE OF TRUTH.
  │        Use its profile and rules as-is. The config represents the user's
  │        deliberate choices — do NOT override with skill defaults.
  │        If the config's profile is weaker than llm-output (e.g. github),
  │        that's intentional — respect it silently.
  │
  │        Only override when you have a concrete, task-blocking reason:
  │        → Explain what you want to change and WHY
  │        → Get user confirmation BEFORE applying the override
  │
  └─ NO  → Fall back to profile="llm-output" (this skill's recommendation).
```

Example: config says `"profile": "github"`. You normally prefer `llm-output`.
→ Use `github`. Say nothing — the user chose it knowingly.
→ Only if you detect an actual problem: "Your config uses github profile which
  keeps MDM015 off. I'm seeing unrecognized delimiters that would be caught
  under llm-output. Override for this session?"

---

## 🔴 Step 2 — Post-Generation Lint Loop (PRIMARY WORKFLOW)

```
1. Generate Markdown with math
2. Lint it
3. pass=true  → return content to user ✓
   pass=false → read issues[].examples (bad/good pairs)
              → fix the Markdown
              → re-lint (go to step 2)
```

### MCP path

```
lint_markdown(text, profile="llm-output")
  → if pass: done
  → if not: read issues[].examples[].bad / .good → fix → re-lint

Optional shortcut: fix_markdown(text) for spacing/blank-line auto-fixes
One-shot: lint_markdown(text, profile="llm-output", fix: true)
```

### CLI path

```bash
echo "$text" | mdmathlint --stdin --profile llm-output
  → exit 0: done
  → exit 1: read bad/good examples → fix → re-lint

Optional shortcut: mdmathlint file.md --fix --profile llm-output
```

### Profile: prefer `llm-output`, respect config

The `llm-output` profile is tuned for AI-generated content — elevates MDM015
to error, MDM005 to warning, MDM013 to error. Use it UNLESS the project config
specifies a different profile (see Step 1 — config is the source of truth).

---

## 🔴 Step 3 — False Positive Protocol

Some lint hits are **false positives** — content is correct but a rule fires anyway.
Common triggers: MDM006 (currency `$5.00`), MDM007 (code examples with `$x$`).

### High confidence → report + ask

```
1. Ignore or work around the specific issue
2. Report to user in this format:
   "lint flagged [RULE] on [SNIPPET], but I'm confident this is a false
    positive because [REASON]. I've [ignored/worked around] it."
3. Ask: "Should I file an issue so the maintainer can fix this?"
```

### Low confidence → treat as real

If you can't articulate exactly why it's wrong, fix it normally. Don't invoke the protocol.

> **Detailed protocol + issue template:** [references/false-positives.md](references/false-positives.md)

---

## 🟡 High-Frequency Rules (Top 5)

Agents trigger these most often. Check these first when lint fails.

| Rule | Symptom | Fix |
|---|---|---|
| **MDM005** | Math touching text: `令$x$为` | Add spaces: `令 $x$ 为` |
| **MDM015** | `$...$` exists but parser missed it | Add blank lines around display math, or spaces around inline |
| **MDM012** | KaTeX parse error | Correct the TeX syntax |
| **MDM024** | Unknown LaTeX command (likely hallucination) | Use a real command or `\newcommand` |
| **MDM001** | Unclosed `$` — corrupts rest of doc | Find and close the missing `$` |

Full catalog: [references/rules.md](references/rules.md)

---

## 🟡 Sub-Skill Index

| Path | Read when |
|---|---|
| [mcp.md](mcp.md) | MCP server is available — tool usage patterns |
| [cli.md](cli.md) | CLI fallback — scenario-based commands |

## ⚪ Reference Index

| Path | Content |
|---|---|
| [references/rules.md](references/rules.md) | Complete 22-rule catalog |
| [references/profiles.md](references/profiles.md) | Profile comparison matrix |
| [references/mcp.md](references/mcp.md) | MCP tool reference (full signatures) |
| [references/cli.md](references/cli.md) | CLI option reference (full flags) |
| [references/config.md](references/config.md) | Configuration file reference + scenario templates |
| [references/false-positives.md](references/false-positives.md) | False positive protocol + issue template |
