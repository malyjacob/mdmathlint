# False Positive Protocol

Detailed guide for handling lint results that are likely incorrect.

## What is a False Positive?

A false positive occurs when mdmathlint reports an issue, but the flagged
content is actually valid and would render correctly. The rule's heuristic
fired on something that looks like a problem but isn't.

## Common False Positive Scenarios

| Rule | Typical Trigger | Why It's Often Wrong |
|---|---|---|
| **MDM006** | `$3.50`, `$1,000` | Currency amounts, not math |
| **MDM006** | `$M>`, `$PATH` | Shell variables (fixed for `$M>` in v1.1.1) |
| **MDM007** | `` `$x$` `` in code span | Intentionally showing math syntax, not actual math |
| **MDM015** | `$` in prose like "cost $5" | Dollar sign in regular text |
| **MDM024** | Domain-specific LaTeX macros | `\RR`, `\NN` defined in user's preamble but unknown to KaTeX |

## Decision Flow

```
Lint returns an issue
  ↓
Is the flagged content actually math?
  ├─ NO (it's currency / shell var / code example) → FALSE POSITIVE
  └─ YES → Is the math actually correct?
            ├─ YES but rule still fires → FALSE POSITIVE
            └─ NO → REAL ISSUE → fix it
```

## Confidence Threshold

Only invoke the false positive protocol when you have **high confidence**.
You must be able to articulate WHY it's wrong. If unsure, treat it as a real
issue and fix it.

### High confidence (invoke protocol)
- `$5.00` flagged as unclosed math — clearly a price
- `$PATH` flagged — shell variable in a code block
- `\newcommand{\RR}{\mathbb{R}}` ... `\RR` flagged as unknown — user defined it

### Low confidence (do NOT invoke protocol)
- "The spacing might be intentional?" — add spaces, it's safer
- "Maybe this KaTeX error is actually fine?" — fix it

## Report Template

When you determine a false positive, report to the user:

```
I found a likely false positive:

  Rule:     MDM0XX
  Snippet:  "[the flagged text]"
  Reason:   [1-2 sentences why it's not a real issue]

I've [ignored this / worked around it with rules override].

Would you like me to file an issue at
https://github.com/malyjacob/mdmathlint/issues
so the maintainer can improve the detection?
```

## Issue Template

File at: https://github.com/malyjacob/mdmathlint/issues/new

If the user agrees, prepare an issue with this structure:

```
Title: False positive: MDM0XX triggers on "[brief description]"

**mdmathlint version:** [version]
**Profile:** [profile used]
**Rule:** MDM0XX

**Input Markdown:**
```markdown
[exact text that triggers the false positive]
```

**Expected behavior:**
No issue should be reported because [reason].

**Actual behavior:**
MDM0XX fires with severity [error/warning/info].

**Why this matters:**
[Real-world scenario where this causes friction]
```

## Workarounds

While waiting for a fix:

| Approach | How | Scope |
|---|---|---|
| Rule override | `rules: {"MDM0XX": "off"}` in MCP or `.mdmathlintrc.json` | Disables rule entirely |
| Macro definition | `macros: {"\\XX": "\\mathbb{X}"}` in MCP call | Suppresses MDM024 for specific commands |
| `--no-config` + flags | CLI: bypass config, set rules via flags | One-shot override |
