# mdmathlint Documentation

Open `playground.html` locally for a zero-dependency browser preflight. It previews spacing and display fixes plus browser-safe P2-P4 diagnostics such as renderer-sensitive commands, undefined in-document references, and formula complexity. Full parser, KaTeX, configuration, and cross-file validation remain available through the CLI:

```bash
npx mdmathlint answer.md --profile strict
npx mdmathlint answer.md --format sarif
```

## Integrations

- Unified / remark: `import remarkMathLint from "mdmathlint/remark-lint"`.
- Pre-commit: use the `mdmathlint` hook from `.pre-commit-hooks.yaml`.
- GitHub Actions: use the repository action with `files` and `profile` inputs.
