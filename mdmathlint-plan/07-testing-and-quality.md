# 07. 测试与质量策略

## 测试分层

### Unit tests

覆盖：

- offset ↔ line/column 转换；
- code block scanner；
- delimiter scanner；
- MathSpan merger；
- 每条 rule 的最小输入输出；
- fixer range conflict detection。

### Fixture tests

目录：

```text
tests/fixtures/
  valid/
  invalid/
  profiles/
  fixes/
```

每个 fixture 包含：

```text
case.md
expected.pretty.txt
expected.json
fixed.md        # 如适用
```

### CLI tests

使用 `execa` 测试：

- glob 输入；
- stdin；
- exit code；
- `--format json`；
- `--fix-dry-run`；
- config file discovery。

## 初始 fixtures 清单

### valid（正常公式，不应报 error）

- `normal-inline-dollar.md` — 基本行内公式
- `normal-display-dollar.md` — 基本 display math
- `bracket-inline-and-display.md` — `\(...\)` 和 `\[...\]`
- `code-block-containing-dollar.md` — 代码块中无数学含义的 `$`，预期不报 error
- `heading-with-math.md` — `## $E=mc^2$`，标题中的公式
- `link-text-with-math.md` — `[$x^2$](url)`，链接文本中的公式
- `escaped-dollar.md` — `\$100 和 $x$`，转义 dollar 不干扰正常公式
- `consecutive-display-blocks.md` — 两个 `$$...$$` 间无正文，各自独立识别
- `shell-vars-in-code.md` — ```` ```sh\necho $PATH\n``` ````，代码块内的 shell 变量

### invalid（应报 error 或 warning）

- `unclosed-inline-dollar.md` — 未闭合 `$`
- `unclosed-display-dollar.md` — 未闭合 `$$`
- `display-attached-to-cjk.md` — `$$` 与中文粘连
- `display-attached-single-line.md` — `$$x=1$$` 单行 display
- `inline-attached-cjk.md` — `$a_n$` 与中文粘连
- `inline-attached-alpha.md` — `$x>0$` 与英文粘连
- `price-dollar-conflict.md` — `$5 and $x$` 货币干扰
- `katex-frac-missing-brace.md` — `\frac{1}{x` 缺括号
- `katex-unknown-command.md` — KaTeX 不识别的命令
- `empty-display-math.md` — `$$$$`，空 display
- `nested-math-delimiter.md` — `$\text{for $x>0$}$`，嵌套 dollar
- `shell-var-in-text.md` — 正文中 `$PATH` 和 `$HOME`，应被 raw scanner 过滤

### suppression（抑制链测试）

- `suppress-mdm015-over-mdm003.md` — MDM015 触发时 MDM003 被抑制
- `suppress-mdm001-over-mdm003.md` — MDM001 触发时 MDM003 被抑制
- `suppress-mdm007-over-mdm001.md` — 代码块中 MDM001 被抑制

### profiles

- `github-inline-backtick-dollar.md`
- `llm-output-dollar-warning.md`
- `strict-display-no-blank-line.md`

### fixes

- `fix-inline-cjk-spacing.md`
- `fix-display-own-line.md`
- `fix-display-blank-lines.md`
- `fix-idempotent.md` — 同一文件 `--fix` 两次结果相同

## 质量门禁

MVP 合并前：

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

建议 package scripts：

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src tests",
    "format": "prettier --write ."
  }
}
```

## Snapshot 策略

Pretty output 可以 snapshot，但 JSON 输出更适合作为稳定断言。

避免 snapshot 过大。每个 fixture 只断言：

- code
- severity
- line/column
- message 核心文本
- fix replacement，如有

## 真实世界 corpus

后续收集：

- LLM 输出坏例子；
- GitHub issue 中的 math markdown 坏例子；
- Obsidian / Docusaurus / VuePress 文档案例；
- 技术博客中的 `$5` 货币误判案例。

## 性能目标

MVP：

- 100 个中等 Markdown 文件在 1 秒级完成；
- 单文件不做多 parser simulation。

Phase 3：

- 支持缓存 parser 结果；
- profile-diff 才运行多 parser。

## Fix 幂等性测试策略

每个 fix fixture 必须包含幂等性验证：

```ts
// tests/fix-idempotent.test.ts
it("--fix is idempotent", async () => {
  // 第一次 fix
  const result1 = await lintText(fs.readFileSync("case.md", "utf-8"), { fix: true });
  // 第二次 fix（对 fix 后的结果再次 fix）
  const result2 = await lintText(result1.fixedText!, { fix: true });
  // 第二次不应再产生 fixable diagnostic
  expect(result2.fixedText).toBeNull();  // 或者与 result1.fixedText 相同
});
```

要求：每个 `fixes/` 目录下的 fixture 都通过此幂等性测试。

## 误报率度量

Phase 1 必须通过误报率基准测试：

```bash
# 收集 100 篇不含数学公式的技术文章（从 GitHub、博客等）
# 运行 mdmathlint，统计 MDM015 误报数
# 量化目标：误报数 < 5（误报率 < 5%）
```

建议在 `tests/` 下建一个 `false-positive-corpus/` 目录，放入不含数学公式但含 `$` 符号的 Markdown 文件（如讨论 shell 脚本、价格、CI 配置的文章）。这些文件预期**不产生 error 级别 diagnostic**。

## 测试覆盖矩阵

| 维度 | 覆盖要求 | 验证方式 |
|---|---|---|
| 每条 rule 的最小输入 | 至少 1 好例子 + 1 坏例子 | unit test |
| 每条 rule 的边界条件 | 至少 3 个边界 case | fixture test |
| 抑制链 | 每个抑制链 1 个 fixture | fixture test |
| Fix 幂等性 | 每个 fixable rule 1 个 fixture | unit test |
| CLI 退出码 | 0 / 1 / 2 各至少 1 个 case | CLI test |
| JSON 输出稳定性 | snapshot test | unit test |
| KaTeX 错误处理 | ParseError + 内部错误 + 超长公式 | unit test |
