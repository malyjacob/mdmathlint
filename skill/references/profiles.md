# Profiles

Profiles are pre-tuned severity maps for real rendering environments.

## Quick selection

| Your situation | Profile | Extra config |
|---|---|---|
| General purpose | `portable` | `"MDM015": "warning"` |
| Personal blog (GitHub Pages) | `github` | `"MDM015": "warning"` |
| Team docs repo | `strict` | `"MDM015": "warning"` |
| **AI/LLM output validation** | `llm-output` | None needed |
| GitHub + custom site | `markdown-it` | `"MDM014": "warning"` |

## Detailed comparison

### `portable` (default)
Balanced — minimizes both false positives and false negatives.
- MDM015: off (too noisy for general use)
- MDM005: info (many renderers handle it)

### `strict`
Maximum portability — elevates formatting rules.
- MDM003: error (display delimiter not on own line)
- MDM005: warning (inline math must be spaced)
- MDM013: error (no backtick delimiters)
- MDM015: warning (flag unrecognized delimiters)

### `github`
Matches GitHub's rendering pipeline.
- MDM013: off (backtick math is supported)
- MDM005: info (GitHub handles adjacency well)

### `llm-output`
**Best for AI-generated content.** Maximum strictness for LLM output quality.
- MDM015: error (unrecognized delimiters MUST be fixed)
- MDM013: error (no platform-specific syntax)
- MDM005: warning (always space math from text)
- MDM022: info (suggest bracket delimiters for robustness)

### `markdown-it`
markdown-it + texmath/dollarmath plugin chain.
- MDM013: off (backtick supported)
- MDM014: warning (parser disagreement check on)
- MDM015: warning (uses markdown-it recognition)

## Per-rule overrides

Any profile can be customized in `.mdmathlintrc.json`:

```jsonc
{
  "profile": "github",
  "rules": {
    "MDM015": "warning",  // enable unrecognized delimiter check
    "MDM006": "off"       // your docs mention prices often
  }
}
```

## Severity levels

| Level | Meaning | Exit code |
|---|---|---|
| `error` | Likely causes broken rendering | Exit 1 |
| `warning` | Not portable across all platforms | Exit 0 (unless `--max-warnings 0`) |
| `info` | Advisory; may be a false positive | Exit 0 |
| `off` | Rule disabled | — |
