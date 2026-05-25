# 02. 语言方案与依赖选择

## 推荐语言：TypeScript / Node.js

### 选择理由

TypeScript 是第一版最优解：

- `remark` / `unified` / `markdown-it` / `KaTeX` 都在 JS 生态内成熟存在；
- CLI、npm 分发、VS Code 插件复用都方便；
- AST、source position、VFile diagnostic 生态可直接利用；
- 后续可以拆成 CLI + library + remark-lint plugin。

## 不建议第一版使用 Rust 的原因

Rust 很适合 CLI，但第一版不推荐：

- Markdown math 生态不如 JS 完整；
- KaTeX/MathJax 原生不在 Rust 生态；
- 若调用 Node/WASM，复杂度反而上升；
- 早期核心风险在规则设计和 parser 行为，不在性能。

后续可考虑 Rust 重写 scanner / reporter，但不作为 MVP。

## 核心依赖

### Markdown / AST

```json
{
  "unified": "latest",
  "remark-parse": "latest",
  "remark-math": "latest",
  "remark-gfm": "latest",
  "remark-frontmatter": "latest",
  "unist-util-visit": "latest",
  "vfile": "latest",
  "vfile-message": "latest"
}
```

### Math parse

```json
{
  "katex": "latest"
}
```

KaTeX 用于内部公式检查：

```ts
katex.renderToString(math, {
  throwOnError: true,
  strict: "error",
  displayMode: span.kind === "display",
  macros: config.katex.macros
})
```

### CLI / 文件 / 输出

```json
{
  "commander": "latest",
  "fast-glob": "latest",
  "picocolors": "latest",
  "jsonc-parser": "latest"
}
```

### 测试

```json
{
  "vitest": "latest",
  "execa": "latest",
  "strip-ansi": "latest"
}
```

## 可选依赖

第二阶段加入：

```json
{
  "markdown-it": "latest",
  "markdown-it-texmath": "latest",
  "markdown-it-dollarmath": "latest"
}
```

用途：模拟实际 markdown-it 渲染链，检测 parser disagreement。

## 包形态

MVP 阶段保持单 `src/` 目录的简单结构，不做 monorepo 拆分。Phase 3 后再考虑拆为 `packages/core` + `packages/cli` + `packages/remark-lint-plugin` + `packages/vscode-extension`。

```text
mdmathlint/
  package.json
  tsconfig.json
  src/
  tests/
```

## 并发模型

MVP（Phase 1）采用**单线程顺序处理**：remark 解析和 KaTeX 检查都在主线程同步执行。原因：

- 简化错误处理和 source map（行列号转换不需要跨线程传递）；
- 对于 < 100 个中等文件的典型场景，顺序处理足以在 1 秒内完成。

Phase 3 如果需要处理大仓库（1000+ 文件），可引入 `worker_threads` 池做多文件并行，每个 worker 独立执行 `lintText`。但 **KaTeX 调用本身不适合 worker 化**，因为 `katex.renderToString` 是同步的且不阻塞事件循环（纯 CPU），worker 化的收益仅在多文件层面。
