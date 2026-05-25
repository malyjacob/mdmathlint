# mdmathlint

Markdown math lint CLI with profile-aware diagnostics and conservative autofix.

## Usage

```bash
npm install
npm run build
node dist/cli.js README.md --profile strict
node dist/cli.js --stdin --profile llm-output --format json
node dist/cli.js "docs/**/*.md" --fix
node dist/cli.js README.md --format sarif
node dist/cli.js README.md --profile-diff github,llm-output
node dist/cli.js --explain MDM003
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
- Internal recovery diagnostics, such as `MDM-INTERNAL-FIX`, may be emitted if automatic fixes do not stabilize within the iteration limit.
- Phase 3 markdown-it simulations (`texmath` and `dollarmath`), optional `MDM014` parser disagreement diagnostics, and profile comparison output.
- SARIF reporting, rule explanations, a GitHub Actions SARIF workflow, an experimental stdio LSP entry point, and a benchmark runner.

## Development

```bash
npm test
npm run typecheck
npm run build
npm run benchmark -- "mdmathlint-plan/**/*.md"
```
