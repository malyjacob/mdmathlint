# 08. 待讨论问题

## ✅ 已决议

| # | 问题 | 决议 | 落地点 |
|---|---|---|---|
| 1 | 默认 profile | `portable`（折中默认），显式 `--profile` 可切换 | [README.md](README.md) |
| 2 | CJK 粘连默认级别 | `portable` 中为 `info`；`strict`/`llm-output` 中为 `warning` | [04-phased-implementation.md](04-phased-implementation.md) |
| 3 | `$$x$$` 作为 inline math | `strict`/`llm-output` → error；`github` → warning；建议用 `\(x\)` | [06-rule-catalog.md](06-rule-catalog.md) |
| 4 | `$5` 自动转义 | 默认不修，config `fix.currencyDollar: true` 开启 | [06-rule-catalog.md](06-rule-catalog.md) |
| 5 | `\(...\)` / `\[...\]` 作为 llm-output 首选 | 推荐但不强制 | [05-api-and-cli-design.md](05-api-and-cli-design.md) |
| 6 | remark-lint plugin | Phase 4 | [04-phased-implementation.md](04-phased-implementation.md) |
| 7 | MDX 支持 | Phase 3/4，MVP 不支持 | [04-phased-implementation.md](04-phased-implementation.md) |
| 8 | 是否需要联网 | 不需要，纯本地执行 | [01-problem-and-goals.md](01-problem-and-goals.md) |
| 9 | CLI 命名 | `mdmathlint` | 全局 |

---

## 🔶 仍未决议（需在 Phase 1/2 中讨论）

### Q1：Raw scanner 是否应跳过 HTML 注释中的 `$`？

```md
<!-- 价格 $5 -->
```

当前设计：raw scanner 按行扫描，如果 HTML 注释跨行可能导致不完整处理。

**建议**：Phase 1 先不处理 HTML 注释（这种场景极少）。Phase 2 加入 `htmlCommentRanges` 扫描。

### Q2：行首/行尾单独的 `$` 如何处理？

```md
$
x+1
$
```

这可能是一个跨行的 inline math，也可能是坏格式的 display math。

**建议**：如果相邻行各有一个孤立的 `$`，且中间行是数学内容 → 报告 MDM001（未闭合 inline `$`）+ 建议改为 `$$`。

### Q3：YAML frontmatter 中的 `$` 是否检查？

```md
---
title: "Price: $5"
---
```

**建议**：不检查。remark-frontmatter 可以识别 YAML 块，raw scanner 应跳过 frontmatter 区域。

### Q4：是否支持 `\begin{equation}...\end{equation}`？

LaTeX 风格的 equation 环境在部分 Markdown 渲染链中有效。

**建议**：Phase 1 不支持。如果 remark-math 识别为 math 节点，KaTeX 可以解析；如果不识别，由 MDM015 在开启时捕获。

### Q5：列表项中 display math 缩进规则

```md
1. 第一步

   $$
   x=1
   $$
```

列表项中 display math 需要缩进（通常 3 空格）才能被正确识别为列表子内容。

**建议**：Phase 2 的 MDM009 规则处理。Phase 1 不报告列表上下文。

### Q6：`$` 在 URL 中

```md
See [the docs](https://example.com/path$x$y)
```

remark 解析为 link 节点，raw scanner 可能误报 `$x$`。

**建议**：raw scanner 应接收 remark AST 的信息，跳过 link URL 内的内容。该逻辑在 `mergeRawAndParsedSpans.ts` 中实现。
