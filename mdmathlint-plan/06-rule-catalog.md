# 06. 规则目录

## 严重级别原则

- `error`：高度可能导致渲染失败或误解析。
- `warning`：某些平台可渲染，但不 portable 或易误判。
- `info`：提示更稳写法。

## 规则依赖图（抑制链）

多条规则可能对同一 span 产生重复诊断。以下是抑制链——左侧规则触发时，右侧规则对同一 span 的 diagnostic 被自动过滤：

```text
MDM001/MDM002 (未闭合)
  └→ 抑制 MDM003, MDM004

MDM015 (raw 未被 parser 识别)
  └→ 抑制 MDM003, MDM004, MDM005

MDM006 (货币疑似)
  └→ 抑制 MDM005

MDM007 (代码块中的公式)
  └→ 抑制 MDM001, MDM002, MDM012

MDM016 (Shell 变量 dollar)
  └→ 抑制 MDM015（该 dollar 不产生 raw token，因此 MDM015 天然不触发）
```

### 排序优先级（从高到低）

1. MDM001, MDM002 — 未闭合是最根本的问题
2. MDM015 — raw 未被识别
3. MDM012 — KaTeX 语法错误
4. MDM016 — Shell 变量 dollar
5. MDM006 — 货币疑似
6. MDM007 — 代码块中的公式
7. MDM003, MDM004 — 边界格式
8. MDM005 — 粘连
9. MDM008–MDM011, MDM013, MDM014 — 上下文规则

---

## MVP 规则

### MDM001 unclosed-inline-dollar

检测未闭合 `$...$`。

坏例子：

```md
令 $x+1 为表达式。
```

修复：补闭合 `$` 或转义 literal `$`。

自动修复：否。

### MDM002 unclosed-display-dollar

检测未闭合 `$$...$$`。

坏例子：

```md
$$
x+1
```

自动修复：否。

### MDM003 display-delimiter-not-own-line

`$$` display delimiter 应独占一行。

坏例子：

```md
所以$$x=1$$成立。
```

好例子：

```md
所以

$$
x=1
$$

成立。
```

自动修复：是，保守模式。

### MDM004 display-math-missing-blank-lines

display math 前后建议空行。

坏例子：

```md
上一段
$$
x=1
$$
下一段
```

好例子：

```md
上一段

$$
x=1
$$

下一段
```

自动修复：是。

### MDM005 inline-math-adjacent-text

行内公式和文字粘连。

坏例子：

```md
令$a_n$为数列。
If$x>0$then...
```

好例子：

```md
令 $a_n$ 为数列。
If $x>0$ then...
```

profile：

- strict：warning/error 可配置
- llm-output：warning
- github：info/warning

自动修复：是。

### MDM006 possible-currency-dollar

疑似货币美元符号干扰 math delimiter。

#### 检测启发式（精确版）

该规则只检查**未配对成功的单个 `$`**（即 raw scanner 的配对栈中剩余的 token）。对每个未配对 `$`，依次判断：

1. **前置上下文检查**：`$` 前一个非空白字符是否为大写字母？（如 `USD$5`）→ 不是货币，跳过
2. **后置内容检查**：`$` 后的字符序列是否匹配以下任一模式：
   - `$` + 纯数字（`$5`、`$100`）→ 疑似货币
   - `$` + 数字 + 逗号 + 数字（`$1,000`）→ 疑似货币
   - `$` + 数字 + `.` + 数字（`$3.50`）→ 疑似货币
   - `$` + 数字 + 字母/符号混合（`$5x`）→ **不**是货币（可能是数学）
   - `$` + 非数字字符（`$x+1` 无闭合 `$`）→ **不**是货币（MDM001 会处理）
3. **行上下文检查**：同一行内是否还有其他 math span？如果有，`$5` 可能污染了后续 `$` 的配对 → 提高 severity

#### 坏例子

```md
The price is $5 and formula is $x+1$.
```

这里 raw scanner 可能将 `$5` 的 `$` 与 `$x+1$` 的第二个 `$` 错误配对，导致 `$x+1` 缺少开头 `$`。

#### 建议

```md
The price is \$5 and formula is $x+1$.
```

GitHub profile 中可改为：

```md
The price is <span>$</span>5 and formula is $x+1$.
```

#### 自动修复

默认 **false**（风险高）。用户可通过配置 `fix.currencyDollar: true` 开启，修复策略为在 `$` 前添加 `\` 转义。

### MDM007 math-delimiter-in-code

代码块或 inline code 中的公式不会渲染。

坏例子：

````md
```md
$$
x+1
$$
```
````

严重级别：info/warning。

自动修复：否。

### MDM012 katex-parse-error

KaTeX 解析公式内部失败。

坏例子：

```md
$$
\frac{1}{x
$$
```

自动修复：否，只给 suggestion。

### MDM015 raw-delimiter-not-parsed

原文存在可疑 delimiter，但当前 parser 未识别为 math。这是工具的核心区分性规则——它发现 parser "漏掉"的公式。

#### 默认关闭的原因

该规则默认 `off`。在 `strict` profile 中为 `warning`，在 `llm-output` profile 中为 `error`。因为：

- 任何包含 `$` 的非数学文本（如"这个服务 $5/月"）都可能触发
- 需要 raw scanner 具备良好的 Shell 变量、转义字符过滤后才能安全开启

#### 坏例子

```md
所以$$x=1$$成立。
```

如果 remark-math 没识别（因为 `$$` 与正文粘连），raw scanner 能发现 `$$` 存在 → 报告 MDM015。

#### 局部抑制

用户可通过 Markdown 注释在特定行禁用 MDM015：

```md
<!-- mdmathlint-disable MDM015 -->
这个服务 $5/月，设置 $PATH。
<!-- mdmathlint-enable MDM015 -->
```

或单行抑制：

```md
这个服务 $5/月。  <!-- mdmathlint-disable-line MDM015 -->
```

#### 实现方式

比对 raw scanner 产生的 `RawDollarPair[]` 和 parser 产生的 `MathSpan[]`。如果一个 raw pair 的 range 没有被任何 parser-recognized span 覆盖，且其 `kind` 在当前 profile 中是支持的 delimiter → 产生 MDM015 diagnostic。

自动修复：视具体上下文（通常不自动修复）。

### MDM016 shell-variable-dollar

`$` 后紧跟 Shell 变量名或特殊参数——这不是数学公式。

#### 说明

这条规则是 raw scanner 的**内置过滤逻辑**，不以 diagnostic 形式报告给用户。它在 token 生成阶段直接跳过以下模式：

| 模式 | 正则 | 示例 |
|---|---|---|
| 环境变量 | `$[A-Za-z_][A-Za-z0-9_]*` | `$PATH`、`$HOME`、`$my_var` |
| 大括号变量 | `\$\{[^}]+\}` | `${PATH}`、`${MY_VAR:-default}` |
| 位置参数 | `$[0-9]` | `$1`、`$9` |
| 特殊参数 | `$[#@?*!$-]` | `$#`、`$@`、`$?`、`$!`、`$-` |

#### 为什么不做成用户可见的 diagnostic

- Shell 变量在技术文档中极其常见（尤其是 CI、部署、脚本相关的 `.md`）
- 做成 diagnostic 会产生大量噪音
- raw scanner 级别的过滤更彻底：这些 `$` 根本不进入后续的规则检查管线

### MDM017 nested-math-delimiter

行内 math 内部不应再出现未转义的 `$` 配对。

#### 坏例子

```md
$\text{for $x>0$}$
```

#### 好例子

```md
$\text{for } x>0$
```

或使用 `\text{for \$x>0\$}`（但大多数渲染器不支持在 `\text` 内转义）。

#### 检测方式

借助 remark-math AST：已识别的 inlineMath 节点的 `value` 中不应再出现完整的 `$...$` 配对。如果出现，说明外层 math 的闭合边界可能不正确。

#### 严重级别

`warning`。大多数 KaTeX/MathJax 可以处理，但可能产生非预期的渲染结果。

#### 自动修复

否。

---

## Phase 2 规则

### MDM008 display-math-inside-table

表格中不推荐 display math。

### MDM009 list-display-math-indentation

列表项中的 display math 缩进不正确。

### MDM010 blockquote-math-marker

blockquote 内 display math 每行 `>` 标记不一致。

### MDM011 inline-math-crosses-line-or-paragraph

行内公式跨行或跨段。

### MDM013 unsupported-delimiter-for-profile

当前 profile 不支持该 delimiter。

### MDM014 parser-disagreement

不同 parser/profile 对同一段文本识别结果不同。

## Fix 分类

### safe fix

- inline math 两侧加空格；
- display delimiter 独占行；
- display block 前后加空行。

### suggest-only

- 表格中的 display math；
- list / blockquote 复杂重排；
- GitHub `<span>$</span>` 替换；
- TeX 内部结构修复。

### never auto-fix by default

- 删除公式；
- 猜测缺失大括号位置；
- 改变公式语义。

## Fix 排序

`--fix` 模式下，多个 fix 按以下规则排序后从后往前应用（避免位置漂移）：

1. **先修根本问题，再修格式**：MDM003/MDM004（边界格式）的 fix 在 MDM005（粘连）之前应用
2. **按 offset 从后往前**：同一优先级内，offset 大的先修，保证行列号不变
3. **冲突丢弃**：两个 fix 的 range 重叠，保留先计算出的那个（通常是更根本规则的 fix）

具体执行顺序：

```text
1. MDM003 (display delimiter 独占行)
2. MDM004 (display 前后空行)
3. MDM005 (inline 两侧加空格)
```

MDM006（货币转义）的 fix 排在最后，因为它在 `$` 前插入 `\` 可能影响其他规则的 range 计算。且默认不开启。
