# mdmathlint

Markdown math lint CLI with profile-aware diagnostics and conservative autofix.

## Usage

```bash
npm install
npm run build
node dist/cli.js README.md --profile strict
node dist/cli.js --stdin --profile llm-output --format json
node dist/cli.js "docs/**/*.md" --fix
```

Profiles: `portable` (default), `strict`, `github`, `llm-output`, and `markdown-it`.

Phase 2 configuration is discovered from `.mdmathlintrc.json` or `.mdmathlintrc.jsonc`:

```jsonc
{
  "profile": "strict",
  "rules": {
    "MDM005": "warning",
    "MDM015": "error"
  },
  "katex": {
    "macros": {
      "\\RR": "\\mathbb{R}"
    }
  },
  "fix": {
    "inlineSpacing": true,
    "displayOwnLine": true,
    "currencyDollar": false
  }
}
```

## Available Features

- Raw delimiter scanner plus `remark-math` parser comparison.
- KaTeX strict validation with macro support and bounded expression checks.
- Phase 2 profiles, JSONC configuration, GFM table/list/blockquote rules, and GitHub delimiter checks.
- `--fix` and `--fix-dry-run` with conflict handling and iterative re-linting.
- Pretty and JSON reporters, stdin support, glob input, and warning threshold exit codes.

## Development

```bash
npm test
npm run typecheck
npm run build
```
