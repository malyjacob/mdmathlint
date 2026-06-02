# Configuration File Reference

mdmathlint discovers `.mdmathlintrc.json` (or `.mdmathlintrc.jsonc`) by walking
up from the current directory. The nearest config wins; settings from parent
configs are merged upward unless `"root": true` stops the search.

---

## All Configuration Keys

### `profile`

| Type | Default | Values |
|---|---|---|
| `string` | `"portable"` | `"portable"` \| `"strict"` \| `"github"` \| `"llm-output"` \| `"markdown-it"` |

The effective profile. All rule severities are derived from this base.
Per-rule `rules` overrides are applied on top.

### `rules`

| Type | Default | Values |
|---|---|---|
| `object` | `{}` | `{ "MDM0XX": "off" \| "info" \| "warning" \| "error", ... }` |

Per-rule severity overrides. Keys are rule IDs (e.g. `"MDM006"`), values are
the desired severity. Rules omitted from this map use their profile default.

### `root`

| Type | Default |
|---|---|
| `boolean` | `false` |

When `true`, stops upward config file discovery at this directory. Use in
monorepos to isolate config scopes.

### `katex`

| Type | Default |
|---|---|
| `object` | `{}` |

KaTeX validation options:

| Sub-key | Type | Default | Description |
|---|---|---|---|
| `strict` | `string` | `"error"` | KaTeX error handling: `"error"` (report as lint error), `"warn"` (report as warning), `"ignore"` (skip KaTeX errors) |
| `macros` | `object` | `{}` | Custom LaTeX macro definitions, e.g. `{ "\\RR": "\\mathbb{R}" }`. Suppresses MDM024 for these commands. |

### `fix`

| Type | Default |
|---|---|
| `object` | `{}` |

Auto-fix behavior tuning:

| Sub-key | Type | Default | Description |
|---|---|---|---|
| `inlineSpacing` | `boolean` | `true` | Auto-add spaces around inline math (`$x$` → ` $x$ `) |
| `displayOwnLine` | `boolean` | `true` | Auto-place `$$` on its own line |
| `currencyDollar` | `boolean` | `false` | When `true`, treat `$5` as a locked math span (do not flag) |

### `fast`

| Type | Default |
|---|---|
| `boolean` | `false` |

When `true`, skips KaTeX parse validation entirely. Only structural checks
run (MDM001–MDM011, MDM013–MDM018). Much faster; useful in watch mode CI.

---

## Scenario Templates

Copy these into `.mdmathlintrc.json` as starting points.

### GitHub Pages / README

```jsonc
{
  "profile": "github",
  "rules": {
    "MDM015": "warning"
  }
}
```

Best for repos rendered on github.com. `github` profile trusts GitHub's parser
but enables MDM015 to catch unrecognized delimiters.

### Strict Team Docs

```jsonc
{
  "profile": "strict",
  "rules": {
    "MDM015": "warning"
  }
}
```

Maximum portability. Display math delimiters must be on their own line, inline
math must be spaced, backtick math is banned.

### LLM Agent Output Validation

```jsonc
{
  "profile": "llm-output",
  "katex": {
    "macros": {
      "\\RR": "\\mathbb{R}",
      "\\NN": "\\mathbb{N}",
      "\\ZZ": "\\mathbb{Z}"
    }
  }
}
```

Tuned for AI-generated content. MDM015 at error level, MDM005 at warning,
MDM013 at error. Define domain-specific macros in `katex.macros` to avoid
MDM024 false positives on your custom commands.

### Mixed GitHub + Custom Site

```jsonc
{
  "profile": "markdown-it",
  "rules": {
    "MDM014": "warning"
  }
}
```

markdown-it with texmath/dollarmath plugin. Enables MDM014 (parser diff check)
to catch formulas that render differently on GitHub vs your site.

### Monorepo (scoped config)

```jsonc
{
  "root": true,
  "profile": "strict"
}
```

Stops upward config discovery. Use in a subdirectory to isolate lint rules
from parent project settings.

### Fast CI Pipeline

```jsonc
{
  "profile": "llm-output",
  "fast": true
}
```

Structural checks only — no KaTeX. Good for pre-commit hooks and CI where
speed matters more than TeX correctness validation.

---

## Config + CLI/MCP Interaction

| Scenario | What happens |
|---|---|
| No config, no flags | `portable` profile, all rule defaults |
| Config exists, no flags | Config's `profile` + `rules` are used |
| Config exists, `--profile X` passed | CLI: flag OVERRIDES config profile. MCP: param OVERRIDES config profile |
| Config exists, `--no-config` passed | Config is ignored entirely (CLI only) |
| Config `rules` + MCP `rules` param | Merged: config is baseline, param overrides on top |
| Multi-level configs (parent + child) | Child overrides parent; `root: true` stops upward merge |
