# TODO

> 基于 Phase 4 审查后的增强路线图。
> 优先级：P0（当前最重要）→ P4（远期规划）。

---

## P0 — LSP：从原型到可用

- [x] `textDocument/didChange` — 增量或全量诊断，编辑器每次按键触发
- [x] `textDocument/didClose` — 文件关闭时发布空诊断数组
- [x] `textDocument/didSave` — 保存时触发 `--fix` 等效操作
- [x] 读取 workspace 中的 `.mdmathlintrc.json` 配置
- [x] VS Code 扩展（`package.json` + language server 激活配置）

---

## P1 — 诊断输出增强

- [x] **源码片段（source frame）**：pretty 输出中显示错误行的上下文和 `^^^^` 位置指示
- [x] **ANSI 颜色**：error 红色、warning 黄色、info 灰色；错误位置高亮
- [x] `--color` / `--no-color` CLI 选项
- [x] `NO_COLOR` 环境变量支持

---

## P1 — `mdmathlint --init`

- [x] 交互式初始化向导
  - 选择目标渲染环境（GitHub / markdown-it / Obsidian / LLM 输出 / 最严格）
  - 是否开启 MDM015
  - 是否配置自定义 LaTeX 宏（逐条输入）
- [x] 生成 `.mdmathlintrc.json`

---

## P2 — 规则增强

- [ ] **MDM017 嵌套定界符** — 检测 `$\text{for $x>0$}$` 中外层 `$` 被意外闭合
- [ ] **MDM018 KaTeX-vs-MathJax 兼容** — 检测使用了 MathJax 支持但 KaTeX 不支持的 TeX 原语（`\choose`、`\over`、`\atop` 等）
- [ ] **`\label` / `\ref` 一致性** — 检测引用了不存在的标签

---

## P2 — 配置文件增强

- [ ] **`root` 标记** — 配置文件支持 `"root": true`，标记为查找边界，阻止继续向上遍历。解决 monorepo 中子包意外继承祖先配置的问题
- [ ] **`--no-config` CLI 选项** — 完全跳过配置文件发现，仅使用命令行参数

---

## P2 — Watch 模式

- [ ] `mdmathlint "docs/**/*.md" --watch`
- [ ] 文件变化时自动重新检查
- [ ] 依赖 `fs.watch` 或 `chokidar`

---

## P3 — Parser Adapter 扩展

- [ ] **Pandoc adapter** — 覆盖学术写作（R Markdown、Quarto）
- [ ] **Goldmark adapter** — 覆盖 Hugo 生态
- [ ] **Obsidian adapter** — Obsidian 的 `$$` 识别规则较宽松
- [ ] 每个新 adapter 自动纳入 MDM014 多引擎对比

---

## P3 — fix diff 输出

- [ ] `--fix-dry-run` 输出 unified diff 格式，而非仅"would be modified"
- [ ] 显示具体每处修改的内容

---

## P4 — 高级语义检查

- [ ] MathJax 特定语法兼容性报告
- [ ] 公式长度 / 复杂度警告（嵌套过深、宏展开过多）
- [ ] `\label` / `\ref` 跨文件引用检查
