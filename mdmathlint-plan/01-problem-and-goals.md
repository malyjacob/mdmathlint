# 01. 需求、问题与目标

## 背景

Markdown 数学公式失败通常不是单纯的 LaTeX 语法错误。大量真实问题来自公式外部上下文：

```md
所以$$x=1$$成立。
```

公式 `x=1` 本身正确，但 `$$` 与正文粘连，可能导致不同平台渲染失败或行为不一致。

### 核心挑战：区分「数学 $」和「字面 $」

`$` 符号在 Markdown 中有多种用途，raw scanner 必须区分：

| `$` 类型 | 示例 | 处理方式 |
|---|---|---|
| 数学 inline delimiter | `$x+1$` | 识别为 math span |
| 数学 display delimiter | `$$x+1$$` | 识别为 display math |
| 货币金额 | `$5`、`$100`、`$1,000` | 报告 MDM006，不建议自动修复 |
| 美元后缀 | `100$` | 同上 |
| Shell 变量 | `$PATH`、`$HOME`、`${VAR}` | raw scanner 需跳过 |
| Shell 位置参数 | `$1`、`$#`、`$@` | raw scanner 需跳过 |
| 转义 dollar | `\$100` | 合法的字面 dollar |
| GitHub 特殊写法 | `$`...`$`（backtick 包裹） | GitHub profile 可识别为 math |
| HTML 实体替代 | `<span>$</span>100` | GitHub 推荐的 literal dollar 写法 |
| 代码块/行内代码中的 `$` | `` `$x$` `` | 不检查 |

如果 raw scanner 不能准确区分这些场景，工具将产生大量误报（MDM015），严重损害可用性。

## 核心需求

构建一个 CLI 工具，在发布、提交、发送 LLM 输出前检查 Markdown 数学公式：

```bash
mdmathlint README.md
mdmathlint docs/**/*.md
mdmathlint --stdin --profile llm-output
mdmathlint answer.md --fix
```

输出应像编译器：

```text
error[MDM003]: display math delimiter should be on its own line
 --> answer.md:12:3
  |
12 | 所以$$x=1$$成立。
  |   ^^ `$$` is attached to text
  |
help: place display math on separate lines
```

## 高频痛点排序

### P0：必须优先解决

1. 未闭合 delimiter：`$`, `$$`, `\(`, `\[`
2. `$$` 与正文粘连
3. display math 起止 delimiter 未独占行
4. display math 前后缺少空行
5. 行内 `$...$` 与 CJK/英文/数字粘连
6. `$5`、`100$` 等货币/数值误判
7. fenced code / inline code 中的公式不会被渲染
8. KaTeX 解析错误：括号、`\frac`、上下标、未知命令

### P1：第二阶段解决

1. GFM table 内 display math
2. list item 中 display math 缩进
3. blockquote 中 display math 的 `>` 标记一致性
4. GitHub 特殊写法：``$`...`$``、```math
5. 配置文件、profile、规则开关
6. 保守 `--fix`

### P2：产品化解决

1. markdown-it 与 remark 解析差异
2. Obsidian / Docusaurus / VitePress / GitHub profile
3. SARIF 输出
4. LSP / VS Code 插件
5. `--profile-diff`

## 非目标

初期不做：

- 完整 LaTeX 文档 lint；这是 `chktex` / `latexmk` 的领域。
- 自动修复复杂 TeX 语义错误。
- 自研完整 Markdown parser。
- 保证所有平台完全一致渲染；工具只提供 profile 化诊断。

## 成功标准

MVP 成功标准：

- 对 20 个以上高频坏例子给出正确行列与诊断；
- 对正常 Markdown 数学文档误报率可接受；**量化目标：在 100 篇不含数学公式的技术文章中，MDM015 误报数 < 5（即误报率 < 5%）**；
- 支持 stdin，便于作为 LLM 输出质量闸门；
- 支持 JSON 输出，便于集成上游系统；
- KaTeX 内部错误能定位到公式所在 Markdown 位置；
- 对 50+ fixture case 的回归测试全部通过。

### 关键边界场景（MVP 必须覆盖）

以下场景虽不一定是高频痛点，但处理不当会导致严重的误报或漏报，MVP 阶段必须有测试覆盖：

| 场景 | 示例 | 预期行为 |
|---|---|---|
| 标题内的公式 | `## $E=mc^2$` | 正确识别，不报 MDM003/004 |
| 链接文本中的公式 | `[$x^2$](url)` | 正确识别 math span |
| 嵌套 math | `$\text{for $x>0$}$` | 外层 `$...$` 应配对外层，内层不触发 MDM001 |
| 转义 dollar | `\$100 和 $x$` | `\$` 不参与配对，`$x$` 正常识别 |
| 连续 display block | `$$\nA\n$$\n\n$$\nB\n$$` | 两个独立的 display block，不合并 |
| 空 display math | `$$$$` | 视为未闭合 `$$`（MDM002） |
| 代码块内包含 `$` | ```` ```sh\necho $PATH\n``` ```` | 不报告任何 math 相关诊断 |
| markdown 代码块内展示公式语法 | ```` ```md\n$x+1$\n``` ```` | 报告 MDM007（info），不报告 MDM001 |
