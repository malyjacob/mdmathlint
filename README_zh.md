# mdmathlint

Markdown 数学公式的静态检查工具。在发布之前发现哪些公式**不会**被正确渲染——而不是部署之后靠肉眼检查。

```bash
# 完整名称
mdmathlint "docs/**/*.md" --profile strict

# 或使用缩写
mdml "docs/**/*.md" --profile strict
```

---

## 目录

- [这个工具解决什么问题](#这个工具解决什么问题)
- [安装](#安装)
- [快速上手](#快速上手)
- [规则详解](#规则详解)
- [Profile（渲染环境预设）](#profile渲染环境预设)
- [配置与调优](#配置与调优)
- [命令行参考](#命令行参考)
- [自动修复](#自动修复)
- [CI 集成](#ci-集成)
- [编辑器与插件](#编辑器与插件)
- [注意事项与常见误区](#注意事项与常见误区)
- [开发](#开发)

> For English, see [README.md](README.md).

---

## 这个工具解决什么问题

Markdown 数学公式的渲染失败是**静默的**。你写 `$x+1$`，push 到 GitHub，部署之后才发现一半公式渲染成了原始文本——而你在写的时候完全看不出问题。

mdmathlint 在提交前发现三类失败：

### 1. 定界符写了，但解析器不认

```markdown
所以$$x=1$$成立。
```

你的本意是 display math，但 `$$` 没有独占一行——GitHub、remark、多数解析器根本不会把它识别成公式。`$$` 被当作普通文本原样输出。**KaTeX 或 MathJax 永远不会被调用**，因为解析器压根没创建 math node。

mdmathlint 通过**原始文本扫描器**（raw scanner）发现所有 `$` / `$$`，再与 Markdown 解析器的 AST 做对比——解析器漏掉的定界符会被报告为 MDM015。

### 2. 公式被识别了，但内部语法是错的

```markdown
$$
\frac{1}{x
$$
```

KaTeX 会抛 `ParseError`。mdmathlint 捕获它，并且**把 KaTeX 给出的公式内部偏移量映射回 Markdown 文档的行列号**——你看到的不是 "position 7"，而是 `第 3 行第 5 列`。

### 3. 跨平台不一致

同一篇文档在 GitHub 能渲染，在 Obsidian 不行；在 markdown-it + dollarmath 插件链正常，在 remark-math 下报错。因为不同解析器对 `$` 的邻接规则、空行要求、`` $`...`$ `` 反引号语法支持各不相同。

mdmathlint 的 5 个 profile 对应 5 种真实渲染环境，一条命令对比差异：

```bash
mdmathlint answer.md --profile-diff github,markdown-it
```

---

## 安装

### 全局安装（推荐）

```bash
npm install -g mdmathlint
```

安装后 `mdmathlint` 命令全局可用：

```bash
mdmathlint README.md --profile strict
```

### 项目本地安装

```bash
npm install --save-dev mdmathlint
```

本地安装后通过 `npx` 调用，或在 `package.json` 的 `scripts` 中使用：

```bash
npx mdmathlint "docs/**/*.md" --profile strict
```

---

## 快速上手

不需要任何配置就能用。默认使用 `portable` profile——平衡误报与漏报：

```bash
mdmathlint README.md
```

输出示例：

```
error[MDM001]: unclosed inline math delimiter
 --> README.md:12:5
 help: Close the delimiter or escape a literal dollar sign.

warning[MDM005]: inline math should be separated from adjacent text
 --> README.md:3:2
 help: Add spaces around inline math.

1 error(s), 1 warning(s), 0 info message(s)
```

### 推荐的最小配置

在项目根目录创建 `.mdmathlintrc.json`：

```jsonc
{
  "profile": "strict",
  "rules": {
    "MDM015": "warning"
  }
}
```

这三行覆盖了 90% 的收益：
- `strict` 将所有格式化规则提升到最严格的级别
- `MDM015: "warning"` 打开核心检查——发现解析器未识别的定界符（这个规则默认关闭，详见[注意事项](#注意事项与常见误区)）

配置后直接运行，无需 `--profile` 参数：

```bash
mdmathlint "docs/**/*.md"
```

---

## 规则详解

mdmathlint 对每份文档执行**三遍检查**：（1）原始文本扫描——发现所有 `$`、`$$` 定界符；（2）Markdown 解析器——判断哪些被实际识别为 math node；（3）KaTeX 解析——检查公式内部 TeX 语法。三条管线的结果在规则引擎中交叉验证。

18 条规则分为五个类别。运行 `mdmathlint --explain <规则代号>` 可查看任意规则的完整说明、错误示例和正确示例。

### 定界符结构——"公式根本没被识别"

| 规则 | 默认级别 | 可修复 | 检测内容 |
|---|---|---|---|
| **MDM001** | error | 否 | `$` 未闭合——后续文本全部被污染 |
| **MDM002** | error | 否 | `$$` 未闭合——display math 永不终止 |
| **MDM003** | warning | **是** | `$$` 未独占一行——多数解析器拒识 |
| **MDM004** | warning | **是** | display block 前后缺少空行 |
| **MDM015** | **off** | 否 | 原文存在 `$` / `$$`，但解析器未识别为 math |
| **MDM017** | warning | 否 | 带花括号的行内公式内嵌套了 `$...$` 定界符 |

> MDM015 是这个工具区别于所有 KaTeX wrapper 的核心规则。它默认关闭——你应该手动开启。详见[注意事项](#注意事项与常见误区)。

### 公式排版——"能渲染但不够好"

| 规则 | 默认级别 | 可修复 | 检测内容 |
|---|---|---|---|
| **MDM005** | info | **是** | 行内公式与中英文粘连——`令$x$为` |
| **MDM008** | warning | 否 | `$$...$$` 出现在 GFM 表格单元格内 |
| **MDM009** | warning | 否 | 列表项中的 display math 缩进不正确 |
| **MDM010** | warning | 否 | 引用块内 display math 各行 `>` 标记不一致 |
| **MDM011** | warning | 否 | 行内公式跨行——`$x +\ny$` |

### 误报抑制——"那不是数学公式"

| 规则 | 默认级别 | 可修复 | 检测内容 |
|---|---|---|---|
| **MDM006** | info | 否 | `$5`、`$1,000`——疑似货币而非数学 |
| **MDM007** | info | 否 | Markdown 代码块内出现公式——这是有意展示源码 |

### TeX 语法——"被识别但内容是错的"

| 规则 | 默认级别 | 可修复 | 检测内容 |
|---|---|---|---|
| **MDM012** | error | 否 | KaTeX 解析失败——缺括号、未知命令、嵌套过深 |
| **MDM019** | warning | 否 | `\ref{...}` / `\eqref{...}` 指向文档中不存在的 `\label{...}` |

### 跨平台——"GitHub 能渲染，别处不行"

| 规则 | 默认级别 | 可修复 | 检测内容 |
|---|---|---|---|
| **MDM013** | warning | 否 | `` $`...`$ `` 反引号定界符——仅 GitHub / markdown-it 支持 |
| **MDM014** | off | 否 | 同一公式被 remark、markdown-it、Pandoc、Goldmark 或 Obsidian 模拟器识别结果不同 |
| **MDM018** | warning | 否 | `\choose`、`\over`、`\atop` 等渲染器敏感的 TeX 原语 |

启用 `MDM014` 后，轻量 Pandoc、Goldmark 和 Obsidian 定界符 adapter 会加入既有的 remark 与 markdown-it 对比。它们用于模拟可移植性相关的识别规则，并非嵌入完整目标渲染引擎。

### 典型错误与正确写法

**MDM003 — display 定界符未独占行：**

```markdown
❌ 所以$$x=1$$成立。
✅ 所以

$$
x=1
$$

成立。
```

**MDM005 — 行内公式与文字粘连：**

```markdown
❌ 令$x$为数列。
✅ 令 $x$ 为数列。
```

**MDM012 — KaTeX 语法错误：**

```markdown
❌ $$\frac{1}{x$$
✅ $$\frac{1}{x}$$
```

---

## Profile（渲染环境预设）

Profile 是针对真实渲染环境预调的严重级别配置。选择一个与你目标平台匹配的 profile，比逐条调整规则更高效。

### 内置 Profile

| Profile | 适用场景 | 相较 `portable` 的关键差异 |
|---|---|---|
| **`portable`** | 通用文档（默认） | 平衡策略；MDM015 关闭 |
| **`strict`** | 要求最严格的可移植性 | MDM003 → error，MDM005 → warning，MDM015 → warning |
| **`github`** | GitHub README / Issue / Wiki | MDM013 关闭（允许 `` $`...`$ ``），MDM005 → info |
| **`llm-output`** | AI 生成内容的质量闸门 | MDM015 → error，MDM005 → warning，MDM013 → error |
| **`markdown-it`** | markdown-it + texmath/dollarmath 插件链 | MDM014 开启，使用 markdown-it 识别结果做 MDM015 判断 |

### 按场景选择

| 你的情况 | 推荐 profile | 附加配置 |
|---|---|---|
| 个人技术博客，部署到 GitHub Pages | `github` | `"MDM015": "warning"` |
| 团队文档仓库，多人协作 | `strict` | `"MDM015": "warning"` |
| 校验 AI / LLM 输出的 Markdown | `llm-output` | 无需额外配置 |
| 同时发布到 GitHub 和自建站点 | `markdown-it` | `"MDM014": "warning"`，配合 `--profile-diff` |

### 逐规则覆盖

配置文件中的 `rules` 字段可以覆盖 profile 预设中任意规则的级别：

```jsonc
{
  "profile": "github",
  "rules": {
    "MDM015": "warning",    // 打开 parser 识别检查
    "MDM006": "off"         // 文档中常提到价格，关闭货币误报
  }
}
```

### 跨 Profile 对比

同一文档在不同平台下的诊断差异：

```bash
mdmathlint answer.md --profile-diff github,markdown-it

# 输出：
# answer.md
#   github: clean
#   markdown-it: error[MDM013], warning[MDM015]
```

JSON 格式便于脚本消费：

```bash
mdmathlint answer.md --profile-diff github,llm-output --format json
```

---

## 配置与调优

### 配置文件

mdmathlint 从当前目录向上查找 `.mdmathlintrc.json` 或 `.mdmathlintrc.jsonc`（支持注释和尾逗号）。祖先配置作为默认值合并，越近的配置优先；monorepo 子包可设置 `"root": true` 阻止继续继承。也可以通过 `--config <path>` 指定单一配置文件，或用 `--no-config` 忽略自动发现的配置。

可通过交互向导创建初始配置：

```bash
mdmathlint --init
```

向导会选择目标渲染环境、配置 `MDM015`，并可选记录自定义 LaTeX 宏。

### 完整配置项

```jsonc
{
  // 在 monorepo 子包中阻止继承祖先配置
  "root": true,

  // 渲染目标环境（默认 "portable"）
  "profile": "strict",

  // 逐规则覆盖严重级别
  // 可选值："off" | "info" | "warning" | "error"
  "rules": {
    "MDM015": "warning",
    "MDM006": "off",
    "MDM005": "warning"
  },

  // KaTeX 解析选项
  "katex": {
    // 严格模式："error"（默认）| "warn" | "ignore"
    // 处理非标准 TeX 方言时可降级
    "strict": "error",

    // 自定义 LaTeX 宏——避免 MDM012 误报
    "macros": {
      "\\RR": "\\mathbb{R}",
      "\\NN": "\\mathbb{N}",
      "\\argmax": "\\mathop{\\mathrm{argmax}}\\limits",
      "\\E": "\\mathbb{E}"
    }
  },

  // 自动修复行为（默认值如下）
  "fix": {
    "inlineSpacing": true,       // 行内公式两侧加空格
    "displayOwnLine": true,      // display 定界符拆到独立行
    "currencyDollar": false      // $5 → \$5（默认关闭，误转义风险高）
  }
}
```

### 场景配置示例

**场景 1：个人博客（GitHub Pages / Vercel）**

目标：发布前确保所有公式在 GitHub 渲染链下正确显示。

```jsonc
{
  "profile": "github",
  "rules": { "MDM015": "warning" }
}
```

**场景 2：AI 输出校验**

目标：LLM 生成的 Markdown 中不允许有渲染缺陷。

```jsonc
{
  "profile": "llm-output"
}
```

无需额外配置——`llm-output` profile 已将 MDM015 设为 error，MDM005 设为 warning，MDM013 设为 error。CI 中运行：

```bash
mdmathlint "output/**/*.md" --profile llm-output --max-warnings 0
```

**场景 3：团队文档仓库**

目标：统一规范，本地自动修复格式，CI 做质量闸门。

```jsonc
{
  "profile": "strict",
  "rules": {
    "MDM015": "warning",
    "MDM006": "off"
  },
  "fix": {
    "inlineSpacing": true,
    "displayOwnLine": true,
    "currencyDollar": false
  }
}
```

本地开发时运行 `mdmathlint "docs/**/*.md" --fix` 自动修复空格和空行。CI 中不带 `--fix` 运行同一配置，作为检查闸门。

**场景 4：自定义 KaTeX 宏**

如果文档使用了自定义 LaTeX 命令，不配置宏会导致大量 MDM012 误报：

```jsonc
{
  "profile": "strict",
  "rules": { "MDM015": "warning" },
  "katex": {
    "macros": {
      "\\RR": "\\mathbb{R}",
      "\\NN": "\\mathbb{N}"
    }
  }
}
```

### 严重级别与退出码

| 级别 | 含义 | 退出码影响 |
|---|---|---|
| `error` | 极可能导致渲染失败 | 使退出码为 1 |
| `warning` | 在某些平台上不能渲染或不够 portable | 退出码为 0（除非 `--max-warnings 0`） |
| `info` | 建议性的，可能是误报 | 退出码为 0 |
| `off` | 规则禁用 | — |

使用 `--max-warnings 0` 强制将 warning 也视为 CI 失败：

```bash
mdmathlint "docs/**/*.md" --max-warnings 0
```

### 抑制链

多条规则可能对同一段公式产生重复诊断。mdmathlint 内部的抑制链会自动过滤低价值的重复报警，你不需要手动处理：

```
MDM001/MDM002（未闭合）
  └─ 抑制 MDM003, MDM004       ← 未闭合的情况下讨论独占行/空行无意义

MDM015（解析器未识别）
  └─ 抑制 MDM003, MDM004, MDM005 ← 解析器都没看到 math，格式规则无意义

MDM006（疑似货币）
  └─ 抑制 MDM005               ← 非数学 dollar 不需要讨论空格

MDM007（代码块中的公式）
  └─ 抑制 MDM001, MDM002, MDM012 ← 代码块中是有意展示源码
```

举例：`所以$$x=1$$成立。` 会触发 MDM015（未被识别）和 MDM003（未独占行），但抑制链保证你只看到 MDM015——因为格式化问题是根因导致的表象。

---

## 命令行参考

```
mdmathlint [文件...] [选项]

选项：
  --init                        交互式创建 .mdmathlintrc.json
  --stdin                       从标准输入读取 Markdown
  --stdin-filename <名称>       stdin 诊断中使用的虚拟文件名
  --profile <名称>              portable|strict|github|llm-output|markdown-it
  --profile-diff <a,b>          比较两个或多个 profile 的诊断差异
  --markdown-it-simulation <名称>  texmath|dollarmath（默认 dollarmath）
  --config <路径>               显式指定配置文件路径
  --no-config                   跳过自动发现的配置文件
  --format <格式>               pretty（默认）| json | sarif
  --color / --no-color          强制启用或禁用 pretty 输出中的 ANSI 颜色
  --fix                         应用安全修复（空格、空行、定界符位置）
  --fix-dry-run                 输出 unified diff 而不写入文件
  --watch                       输入文件变化时重新检查
  --explain <规则代号>          打印规则的详细说明、示例和原因
  --max-warnings <数量>         当 warning 超过此数量时退出码为 1
```

### 管道输入

```bash
echo "令$x$为数列。" | mdmathlint --stdin --profile strict
cat draft.md | mdmathlint --stdin --stdin-filename draft.md --format json
```

### 批量检查

```bash
# glob 模式
mdmathlint "docs/**/*.md" --profile strict

# 多个文件
mdmathlint README.md CONTRIBUTING.md CHANGELOG.md --profile github

# 编辑期间持续检查匹配文件
mdmathlint "docs/**/*.md" --watch
```

### 输出格式

**pretty**（默认）——类 Rust 编译器的可读格式：

```
error[MDM001]: unclosed inline math delimiter
 --> README.md:12:5
    |
 12 | Try $x + 1
    |     ^
    |
 = help: Close the delimiter or escape a literal dollar sign.

1 error(s), 1 warning(s), 0 info message(s)
```

在交互终端中颜色会自动启用；也可以用 `--color`、`--no-color` 或 `NO_COLOR` 环境变量显式控制。

**json**——供其他工具消费：

```bash
mdmathlint README.md --format json
```

**sarif**——GitHub CodeQL / VS Code 兼容：

```bash
mdmathlint "docs/**/*.md" --profile strict --format sarif > mdmathlint.sarif
```

### 查询规则

```bash
mdmathlint --explain MDM003
```

输出包含规则名称、默认级别、是否可修复、错误示例、正确示例和原理说明。

---

## 自动修复

`--fix` 只做**安全、保守**的修复——它永远不会修改你的公式内容或猜测缺失的括号。可自动修复的规则：

| 规则 | 修复内容 |
|---|---|
| MDM003 | 将 `$$` 拆到独立行，前后添加空行 |
| MDM004 | 在 display block 前后添加空行 |
| MDM005 | 在行内公式两侧添加空格 |
| MDM006 | 在疑似货币 `$` 前添加 `\` 转义（需配置 `fix.currencyDollar: true` 开启，默认关闭） |

```bash
# 直接修改文件
mdmathlint "docs/**/*.md" --fix

# 仅预览，不写入
mdmathlint "docs/**/*.md" --fix-dry-run
```

Dry-run 输出使用 unified diff hunk（`---`、`+++`、`@@`、`-`、`+`），方便逐处审阅拟进行的修改。

修复管线保证**幂等性**——对同一文件运行两次 `--fix` 与运行一次结果相同。如果有多个 fix 的修改范围重叠，应用冲突检测并保留优先级更高的 fix。最多迭代 5 轮，超过后发出 `MDM-INTERNAL-FIX` 警告告知用户部分修复可能未完全应用。

---

## CI 集成

### GitHub Actions（可复用 Action）

```yaml
- uses: malyjacob/mdmathlint@v1
  with:
    files: "docs/**/*.md"
    profile: strict
```

### GitHub Actions（SARIF + PR 行内注释）

```yaml
- run: mdmathlint "docs/**/*.md" --profile strict --format sarif > mdmathlint.sarif
- uses: github/codeql-action/upload-sarif@v3
  if: always()
  with:
    sarif_file: mdmathlint.sarif
```

SARIF 格式会将诊断直接嵌入 GitHub PR 的 diff 界面——公式问题会显示在对应行上，类似 ESLint 的红波浪线。

### 通用 CI（任意平台）

```bash
mdmathlint "content/**/*.md" --format json --max-warnings 0
# 退出码非 0 → CI 失败
```

### pre-commit

```yaml
- repo: https://github.com/malyjacob/mdmathlint
  rev: v0.4.0
  hooks:
    - id: mdmathlint
```

---

## 编辑器与插件

### remark / unified 插件

在 unified 处理管线中以插件形式运行：

```js
import { unified } from "unified";
import remarkParse from "remark-parse";
import { VFile } from "vfile";
import remarkMathLint from "mdmathlint/remark-lint";

const processor = unified()
  .use(remarkParse)
  .use(remarkMathLint, { profile: "strict" });

const file = new VFile({ value: "令$x$为变量。" });
await processor.run(processor.parse(file), file);

file.messages.forEach((msg) => {
  // msg.ruleId → "MDM005"
  // msg.reason → "inline math should be separated from adjacent text"
  // msg.line / msg.column → 位置
  // msg.fatal → error 时为 true，warning 时为 false
});
```

### LSP（实验性）

```bash
mdmathlint-lsp
# 或使用缩写
mdml-lsp
```

通过 stdio 提供 LSP 服务，支持 `didOpen`、增量/全量 `didChange`、`didClose`，并在 `didSave` 时通过 `workspace/applyEdit` 请求安全自动修复。诊断会读取文档 workspace 中的 `.mdmathlintrc.json` / `.jsonc` 配置。最小 VS Code 客户端见 [`vscode-extension/`](vscode-extension/)。

### 浏览器 Playground

在浏览器中打开 [`docs/playground.html`](docs/playground.html)——纯静态页面，零依赖。提供了定界符位置检查（MDM003 / MDM005 的浏览器端近似），适合快速检查。完整的 KaTeX 验证和 parser 对比仍需 CLI。

---

## 注意事项与常见误区

### MDM015 为什么默认关闭

MDM015 是 mdmathlint 区别于所有 KaTeX wrapper 的核心规则——它发现"解析器根本没识别到你的公式"。但它默认 `off`，原因是：

- 任何包含字面 `$` 的非数学文本都可能触发它（如"这个服务 $5/月"）
- 需要 raw scanner 的 Shell 变量过滤、转义过滤、链接目标排除全部就绪后才能安全开启

**这些过滤已在 Phase 2 实现并验证过了。** 所以你应该手动开启它：

```jsonc
{ "rules": { "MDM015": "warning" } }
```

### 不要手动关闭被抑制链覆盖的规则

看到同一个 `$$x=1$$` 上 MDM015 和 MDM003 都触发了？别急着关掉 MDM003——抑制链已经自动过滤了 MDM003（因为 MDM015 触发时 MDM003 作为被抑制方不会出现在最终输出中）。你不需要手动 `"MDM003": "off"`。

### 货币误报处理

如果你的文档经常出现价格（`$5`、`$1,000`），MDM006 可能会产生噪音。建议方案：

```jsonc
{ "rules": { "MDM006": "off" } }
```

而非开启 `fix.currencyDollar`。因为往 `$5` 前加 `\` 变成 `\$5` 可能破坏非数学语境下的自然阅读。除非你确认文档中所有 `$` + 数字都确实是需要转义的字面 dollar，否则保持 MDM006 为 info 或直接关闭。

### KaTeX 宏必须配置

如果你使用了自定义 LaTeX 命令（领域特定的宏非常常见——数学、物理、机器学习各有各的简写），不配置 `katex.macros` 会导致 MDM012 误报。KaTeX 不认识 `\RR` → 报错 → 但你的渲染链中这个宏是可用的。解决方案是在配置中声明这些宏。

### `--fix` 不会修改公式内容

`--fix` 只调整定界符周围的空格、空行和定界符位置。它**永远不会**修改 `$...$` 或 `$$...$$` 内部的 TeX 内容。如果你有一个语法错误的公式（MDM012），`--fix` 不会尝试修复它——你需要手动修改。

### 不要混合使用 `--fix` 和 `--profile-diff`

`--fix` 是修改性操作，`--profile-diff` 是比较性操作。两者不应同时使用——`--profile-diff` 不支持 `--fix`。

### 空公式不会被错误配对

`$$$$`（四个连续的 `$`）是一种边界情况。raw scanner 会检测到相邻的 `$$` 之间没有内容，拒绝将其配对为一个空 display block，而是报告 MDM002（未闭合）。这避免了将字面美元符号序列误判为数学公式。

---

## 开发

```bash
git clone https://github.com/malyjacob/mdmathlint
cd mdmathlint
npm install
npm run build
npm test
npm run typecheck
npm run benchmark -- "mdmathlint-plan/**/*.md"
```

项目采用 TypeScript + ESM。`npm run build` 编译到 `dist/`。`npm run prepare`（在 `npm publish` 时自动触发）确保发布时 `dist/` 是最新的。
