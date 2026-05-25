# mdmathlint Documentation

Open `playground.html` locally for a small delimiter-placement preview. Full validation remains available through the CLI:

```bash
npx mdmathlint answer.md --profile strict
npx mdmathlint answer.md --format sarif
```

## Integrations

- Unified / remark: `import remarkMathLint from "mdmathlint/remark-lint"`.
- Pre-commit: use the `mdmathlint` hook from `.pre-commit-hooks.yaml`.
- GitHub Actions: use the repository action with `files` and `profile` inputs.
