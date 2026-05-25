# mdmathlint

Markdown math lint CLI with profile-aware diagnostics and conservative autofix.

## Install

```bash
npm install --save-dev mdmathlint
npx mdmathlint README.md --profile strict
```

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
- Phase 4 ecosystem integrations: `mdmathlint/remark-lint`, a pre-commit hook, a reusable composite Action, false-positive corpus checks, and a browser playground in `docs/playground.html`.

## remark

```js
import { unified } from "unified";
import remarkParse from "remark-parse";
import { VFile } from "vfile";
import remarkMathLint from "mdmathlint/remark-lint";

const processor = unified().use(remarkParse).use(remarkMathLint, { profile: "strict" });
const file = new VFile({ value: "令$x$为数列。" });
await processor.run(processor.parse(file), file);
console.log(file.messages);
```

## GitHub Action

```yaml
- uses: malyjacob/mdmathlint@v1
  with:
    files: "docs/**/*.md"
    profile: strict
```

## Pre-commit

```yaml
- repo: https://github.com/malyjacob/mdmathlint
  rev: v0.4.0
  hooks:
    - id: mdmathlint
```

## Development

```bash
npm test
npm run typecheck
npm run build
npm run benchmark -- "mdmathlint-plan/**/*.md"
```
