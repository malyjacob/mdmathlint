# Rule Reference

22 rules organized into five categories.

## Delimiter structure — "formula never recognized"

| Rule | Default | Fixable | Detects |
|---|---|---|---|
| **MDM001** | error | no | Unclosed `$` — corrupts the rest of the document |
| **MDM002** | error | no | Unclosed `$$` — display math never terminates |
| **MDM003** | warning | yes | `$$` not on its own line — most parsers reject it |
| **MDM004** | warning | yes | Display block missing surrounding blank lines |
| **MDM015** | off | no | Raw `$` / `$$` exists but parser didn't recognize it |
| **MDM017** | warning | no | Nested `$...$` delimiters inside braced inline math |

## Formula formatting — "renders but looks wrong"

| Rule | Default | Fixable | Detects |
|---|---|---|---|
| **MDM005** | info | yes | Inline math touching CJK or Latin text |
| **MDM008** | warning | no | `$$...$$` inside a GFM table cell |
| **MDM009** | warning | no | Display math in list with wrong indentation |
| **MDM010** | warning | no | Blockquote display math with inconsistent `>` markers |
| **MDM011** | warning | no | Inline math crossing a line boundary |

## False-positive mitigation — "that's not math"

| Rule | Default | Fixable | Detects |
|---|---|---|---|
| **MDM006** | info | no | `$5`, `$1,000` — likely currency, not math |
| **MDM007** | info | no | `$x$` inside a Markdown code example |

## TeX syntax — "recognized but content is invalid"

| Rule | Default | Fixable | Detects |
|---|---|---|---|
| **MDM012** | error | no | KaTeX `ParseError` — missing brace, unknown command |
| **MDM019** | warning | no | `\ref{...}` without matching `\label{...}` |
| **MDM021** | warning | no | Over 400 chars, nested >12 brace levels, or macro >20 uses |
| **MDM024** | warning | no | Unknown LaTeX command — possible LLM hallucination |

## Cross-platform — "works on GitHub, breaks elsewhere"

| Rule | Default | Fixable | Detects |
|---|---|---|---|
| **MDM013** | warning | no | `` $`...`$ `` backtick delimiters — GitHub/markdown-it only |
| **MDM014** | off | no | Same formula recognized differently across parsers |
| **MDM018** | warning | no | TeX primitives `\choose`, `\over`, `\atop` — inconsistent support |
| **MDM020** | warning | no | MathJax-specific `\require`, `\bbox`, `\cssId`, `\class` |

## Style — "LLM-optimized preferences"

| Rule | Default | Fixable | Detects |
|---|---|---|---|
| **MDM022** | off | no | Prefer `\(...\)` / `\[...\]` over `$...$` / `$$...$$` |
| **MDM023** | warning | no | Mixed dollar and bracket delimiter styles in same document |

## Profile severity overrides

Key differences from `portable`:

| Rule | portable | strict | github | llm-output | markdown-it |
|---|---|---|---|---|---|
| MDM003 | warning | **error** | warning | warning | warning |
| MDM005 | info | **warning** | info | **warning** | info |
| MDM013 | warning | **error** | off | **error** | off |
| MDM015 | off | **warning** | off | **error** | **warning** |
| MDM022 | off | off | off | **info** | off |

## LLM-optimized rules

Three rules added specifically for LLM output validation:

- **MDM022** (`llm-output` → info): Suggests `\(...\)` / `\[...\]` — avoids `$5` ambiguity, no adjacency rules
- **MDM023** (all → warning): Mixed `$` and `\(` styles cause inconsistent recognition
- **MDM024** (all → warning): Detects made-up LaTeX commands (`\differential`, `\vect`) via KaTeX validation
