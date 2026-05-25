# mdmathlint 规划书

> 目标：把 Markdown 数学公式渲染问题，从“肉眼检查 + 前端预览碰运气”，变成类似编译器的 CLI 诊断、规则化修复和 CI 质量闸门。

## 一句话定义

`mdmathlint` 是一个面向 Markdown / LLM 输出 / 技术文档的数学公式 lint CLI：

- 检查公式**是否会被 Markdown 渲染链正确识别**；
- 检查识别出来的 TeX / LaTeX 片段**是否能被 KaTeX/MathJax 正确解析**；
- 对高频边界问题给出行列、原因、帮助信息和保守自动修复。

## 文档导航

- [01-problem-and-goals.md](01-problem-and-goals.md)：需求、痛点、非目标
- [02-language-and-dependencies.md](02-language-and-dependencies.md)：语言方案与依赖选择
- [03-architecture.md](03-architecture.md)：总体架构与模块边界
- [04-phased-implementation.md](04-phased-implementation.md)：分阶段实现计划
- [05-api-and-cli-design.md](05-api-and-cli-design.md)：CLI、库 API、配置文件、输出格式设计
- [06-rule-catalog.md](06-rule-catalog.md)：规则编号、严重级别、修复策略
- [07-testing-and-quality.md](07-testing-and-quality.md)：测试策略、fixtures、质量门禁
- [08-open-questions.md](08-open-questions.md)：待讨论设计问题

## 推荐初始路线

先做 TypeScript CLI MVP，而不是 Rust 或纯正则工具：

```text
TypeScript CLI
+ source scanner
+ remark/unified parser
+ remark-math
+ KaTeX strict parse
+ profile-aware rule engine
+ Rust-style diagnostics
+ conservative autofix
```

## 默认行为（portable profile）

CLI 默认使用 `portable` profile，这是一个在所有平台都安全的折中配置：

| 规则 | 默认严重级别 | 理由 |
|---|---|---|
| MDM001 未闭合 inline `$` | error | 必然导致渲染失败 |
| MDM002 未闭合 display `$$` | error | 必然导致渲染失败 |
| MDM003 display delimiter 未独占行 | warning | 部分渲染器可处理 |
| MDM004 display math 缺少空行 | warning | 多数平台可渲染，不够 portable |
| MDM005 inline math 与文本粘连 | info | 多数渲染器可处理 |
| MDM006 疑似货币美元符号 | info | 误报风险高 |
| MDM007 代码块中的公式 | info | 通常是故意的（文档中的示例） |
| MDM012 KaTeX 语法错误 | error | 解析失败是确定的 |
| MDM015 raw delimiter 未被 parser 识别 | off | 过于嘈杂，需按需开启 |

通过 `--profile` 可切换到 `strict`、`github`、`llm-output` 等预设，也可在配置文件中逐规则覆盖。

## 初版覆盖目标

第一阶段优先解决 70% 高频痛点：

1. `$` / `$$` 未闭合；
2. `$$` 与正文粘连；
3. display math 没有独占行或缺少空行；
4. 行内公式与中英文粘连；
5. `$5` 等货币符号误判；
6. 代码块中的公式不会渲染；
7. KaTeX 公式内部语法错误。

第二阶段扩展到 90%：表格、列表、引用块、profile、`--fix`。

第三阶段扩展到 95%+：多 parser 对比、GitHub/Obsidian/Docusaurus profile、SARIF、LSP/VS Code。

## CI 集成示例

### GitHub Action（Phase 3 正式提供）

```yaml
# .github/workflows/math-lint.yml
name: Math Lint
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: mdmathlint/action@v1       # 未来提供
        with:
          files: 'docs/**/*.md'
          profile: github
```

### pre-commit hook（Phase 4 正式提供）

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/mdmathlint/mdmathlint
    rev: v0.1.0
    hooks:
      - id: mdmathlint
        args: ['--profile', 'strict']
```

### 手动 CI 脚本（MVP 即可用）

```bash
#!/bin/sh
# ci/math-lint.sh
npx mdmathlint docs/**/*.md --format json --max-warnings 0
# 退出码非 0 时 CI 自动失败
```
