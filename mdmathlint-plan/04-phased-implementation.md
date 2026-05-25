# 04. 分阶段实现计划

## Phase 0：Spike 验证

目标：验证核心架构可行。

输入 fixtures：

```md
令$a_n$为数列。
```

```md
所以$$x=1$$成立。
```

```md
The price is $5 and formula is $x+1$.
```

````md
```md
$$
x+1
$$
```
````

```md
$$
\frac{1}{x
$$
```

验收：能输出行列、规则编号和帮助信息。

## Phase 1：MVP，解决 70% 高频痛点

### 功能

- CLI：`mdmathlint <files...>`
- 支持 `--stdin`
- 支持 `--stdin-filename <name>`
- 支持 `--format pretty|json`
- 支持 `.md` 文件和 glob
- Source scanner：行列、代码块、inline code、delimiter tokens（含 Shell 变量过滤）
- remark parser + remark-math + remark-gfm + remark-frontmatter
- Raw scanner + parser merger（MDM015 核心逻辑）
- KaTeX strict parse（含 `safeKatexCheck` 错误包装）
- 规则抑制链（详见 [03-architecture.md](03-architecture.md)）
- 基础 pretty reporter + JSON reporter
- **默认 `portable` profile**（见下方规则表）

### 规则（含默认严重级别）

| 规则 | 默认级别 | fixable | 说明 |
|---|---|---|---|
| MDM001 未闭合 inline `$` | error | 否 | |
| MDM002 未闭合 display `$$` | error | 否 | |
| MDM003 display delimiter 未独占行 | warning | 是 | 保守模式 |
| MDM004 display math 缺少空行 | warning | 是 | |
| MDM005 inline math 与 CJK/英文粘连 | info | 是 | |
| MDM006 疑似货币美元符号 | info | 否 | suggest-only |
| MDM007 代码块中的公式 | info | 否 | |
| MDM012 KaTeX syntax error | error | 否 | |
| MDM015 raw delimiter 未被 parser 识别 | **off** | 否 | 需按需开启，误报率高 |

> **注意**：MDM015 默认关闭。在 `strict` profile 中为 warning，在 `llm-output` profile 中为 error。用户可通过配置文件手动开启。

### Phase 1 核心实现要点

**Raw scanner 必须实现：**
- Shell 变量过滤（`$PATH`、`${VAR}`、`$1` 等不产生 token）
- 转义 `\$` 过滤
- 代码块/行内代码范围标记
- 贪心配对算法

**KaTeX 检查必须实现：**
- `safeKatexCheck` 包装（try-catch 所有 KaTeX 异常）
- 单公式长度上限 2000 字符，超过则跳过并报 info
- `ParseError` → MDM012 error，内含公式内部偏移 → Markdown 行列映射

**抑制链必须实现：**
- MDM015 → 抑制 MDM003/004/005
- MDM001/002 → 抑制 MDM003/004
- MDM006 → 抑制 MDM005
- MDM007 → 抑制 MDM001/002/012

### 验收

- 50+ fixture cases；
- **8 个关键边界场景**（标题内公式、链接文本、嵌套 math、转义 dollar、连续 display block、空 display math、代码块内 `$`、markdown 代码块）全部有测试覆盖；
- 正常文档无 error；误报率 < 5%（100 篇不含数学的技术文章，MDM015 误报 < 5 条）；
- JSON 输出稳定（字段只增不删）；
- 退出码：有 error 为 1，只有 warning/info 为 0；支持 `--max-warnings 0` 强制 warning 也失败。

## Phase 2：实用版，解决 90% 问题

### Profile 预设定义

| Profile | 适用场景 | 关键差异（相较 portable） |
|---|---|---|
| `strict` | 要求最严格的可移植性 | MDM005→warning, MDM015→warning, MDM003→error |
| `github` | GitHub README/issue/wiki | MDM005→info, MDM013 允许 `` $`...`$ `` |
| `llm-output` | AI 输出质量闸门 | MDM005→warning, MDM015→error, 建议 `\(...\)` 替代 `$...$` |
| `markdown-it` | markdown-it + texmath/dollarmath 插件链 | MDM013 允许该插件链支持的特定写法 |

> Profile 本质是一个预定义 severity map，用户可通过配置文件的 `rules` 字段逐条覆盖。

### 新增功能

- `--profile strict|github|llm-output|markdown-it`
- `.mdmathlintrc.json` / `.mdmathlintrc.jsonc`
- 规则开关和 severity override
- `--fix` / `--fix-dry-run`（含 fix 迭代管线：排序、冲突检测、重新 lint、最多 5 轮迭代）
- GFM table 识别
- list / blockquote 上下文规则
- KaTeX macros 配置

### 新增规则

- MDM008：display math inside table
- MDM009：list display math indentation
- MDM010：blockquote math marker mismatch
- MDM011：inline math 跨行或跨段落
- MDM013：profile 不支持的 delimiter
- MDM014：parser disagreement，Phase 2 可先留作实验

### 验收

- 100+ fixtures；
- `--fix` 不引入语义明显破坏；
- strict/github/llm-output 三套 profile 行为稳定。

## Phase 3：产品级，解决 95%+

### 新增功能

- markdown-it adapter
- `markdown-it-texmath` / `markdown-it-dollarmath` simulation
- `--profile-diff github,llm-output`
- SARIF 输出
- GitHub Action 示例
- LSP / VS Code 插件原型
- `--explain MDM003`
- benchmark 和大仓库性能优化

### 高级诊断

- 同一文档在 GitHub 可渲染但在 llm-output profile 不推荐；
- `$5` 在某 parser 中污染后续 `$x$` 配对；
- ``$`...`$`` 对 GitHub 合法但对通用 markdown-it profile 不 portable。

## Phase 4：生态化

- 发布 npm 包；
- 提供 remark-lint plugin；
- 提供 pre-commit hook；
- 提供 GitHub Action；
- 收集真实坏例子形成 corpus；
- 文档站和 playground。
