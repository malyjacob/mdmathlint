# 03. 总体架构

## 核心设计原则

不要只靠正则。优雅实现应结合：

1. 原始文本 scanner：发现 parser 不会暴露的可疑 delimiter；
2. Markdown parser：判断实际会被识别成什么 AST 节点；
3. Math parser：检查公式内部 TeX 语法；
4. Rule engine：做 profile-aware 诊断；
5. Fixer：只做保守、安全、可回滚的自动修复。

## 总流程

```text
Input files/stdin
  ↓
SourceDocument
  ↓
Source scanner
  - lines
  - code ranges
  - inline code ranges
  - raw delimiter tokens
  - table/list/blockquote context
  ↓
Parser adapter
  - remark AST
  - math nodes recognized by remark-math
  ↓
Math span merger
  - parser-recognized spans
  - raw-suspect delimiter spans
  ↓
Rule engine
  - boundary rules
  - context rules
  - parser-recognition rules
  - KaTeX syntax rule
  ↓
Diagnostics
  - pretty
  - json
  - sarif later
  ↓
Optional fixes
```

## Raw Scanner 算法规格

这是整个工具最关键的模块。Raw scanner 在 parser 之前扫描原始文本，发现所有 `$` 和 `$$` token，用于后续与 parser 结果对比（MDM015）和边界规则（MDM001–MDM007）。

### 输入

`SourceDocument`（已拆分为 lines + lineOffsets）。

### 输出

`RawDollarToken[]`：

```ts
export interface RawDollarToken {
  kind: "single" | "double";         // $ 或 $$
  position: Position;                 // 第一个字符的位置
  endPosition: Position;              // 最后一个字符的位置（$ 为 1 列，$$ 为 2 列）
  escaped: boolean;                   // 前面是否有奇数个反斜杠
  inFencedCode: boolean;
  inInlineCode: boolean;
}
```

### 扫描流程（状态机描述）

```
对于每一行 line：
  1. 跳过 fenced code block 内的行（由 codeRanges 模块预先标记）
  2. 在非 fenced code block 的行内：
     a. 用正则 /(`+)(.*?)\1/g 找到所有 inline code span，标记其列范围
     b. 从左到右遍历行中的每个字符：
        - 如果当前列在 inline code span 内 → 跳过
        - 如果当前字符是 \：
            - 如果下一个字符是 $ → 这是转义 dollar，不产生 token
            - 否则 → 正常字符，继续
        - 如果当前字符是 $：
            - 如果下一个字符也是 $ → 产生一个 kind="double" 的 token
            - 否则 → 产生一个 kind="single" 的 token
```

### 关键过滤规则（减少 MDM015 误报）

以下 `$` 模式**不产生 raw token**：

| 模式 | 正则/判断 | 理由 |
|---|---|---|
| `\$` 转义 | 前有奇数个 `\` | 用户明确表示这是字面 dollar |
| Shell 变量 `$VAR` | `$[A-Za-z_][A-Za-z0-9_]*`（紧跟字母/下划线） | 非数学用途 |
| Shell `${VAR}` | `\$\{[^}]+\}` | 非数学用途 |
| Shell 位置参数 `$1`–`$9`、`$#`、`$@`、`$?` 等 | `$[0-9#@?*!$-]` | 非数学用途 |
| 代码块内 | `inFencedCode = true` | 完全不检查 |
| 行内代码内 | `inInlineCode = true` | 完全不检查 |

> **设计决策**：`$5`（货币）**仍然**产生 raw token，由 MDM006 规则在后续阶段判断是否为误报。这样保留了检测「`$5 和 $x$` 中的 `$5` 污染了后续 `$` 配对」的能力。

### 配对算法

扫描完成后，对 raw tokens 做贪心配对：

```text
输入: RawDollarToken[]（按 offset 升序）
输出: RawDollarPair[]

算法:
  stack = []
  for token in tokens:
    if token.kind == "single":
      if stack 非空 且 stack.top().kind == "single":
        pop → 产生一个 inline pair
      else:
        push token
    if token.kind == "double":
      if stack 非空 且 stack.top().kind == "double":
        pop → 产生一个 display pair
      else:
        push token

  遍历结束后，stack 中剩余的所有 token → 未闭合（MDM001/MDM002）
```

**注意**：此配对算法**不处理嵌套**（`$\text{for $x>0$}$`）。嵌套检测在 `mergeRawAndParsedSpans.ts` 中，借助 remark-math AST 中已识别的 span 来修正 raw pair 的边界。

---

## 模块目录建议

```text
src/
  cli.ts
  config/
    loadConfig.ts
    schema.ts
    defaultConfig.ts
  core/
    document.ts
    positions.ts
    profile.ts
  scanner/
    sourceScanner.ts
    codeRanges.ts
    delimiterScanner.ts
    blockContextScanner.ts
  parser/
    remarkAdapter.ts
    markdownItAdapter.ts       # Phase 3
  math/
    mathSpan.ts
    extractRemarkMath.ts
    mergeRawAndParsedSpans.ts
    katexCheck.ts
    safeKatexCheck.ts           # KaTeX 错误包装（try-catch + timeout）
  rules/
    index.ts
    ruleEngine.ts               # 规则执行 + 抑制链应用
    noUnclosedDelimiter.ts       # MDM001, MDM002
    displayMathOwnLine.ts        # MDM003
    displayMathBlankLines.ts     # MDM004
    inlineMathSpacing.ts         # MDM005
    possibleCurrencyDollar.ts    # MDM006
    noMathInCode.ts              # MDM007
    noDisplayMathInTable.ts      # MDM008
    listDisplayMathIndent.ts     # MDM009
    blockquoteMathMarker.ts      # MDM010
    inlineMathCrossesLine.ts     # MDM011
    katexSyntax.ts               # MDM012
    rawDelimiterNotParsed.ts     # MDM015
    suppression.ts               # 抑制链逻辑
  diagnostics/
    diagnostic.ts
    reporterPretty.ts
    reporterJson.ts
    sourceFrame.ts
  fixer/
    fix.ts
    fixPipeline.ts               # 迭代修复管线（排序、冲突检测、幂等性）
    applyFixes.ts
    conflictDetection.ts
  profiles/
    strict.ts
    github.ts
    llmOutput.ts
    markdownIt.ts
```

## 关键抽象

### SourceDocument

```ts
export interface SourceDocument {
  path: string;
  text: string;
  lines: string[];
  lineOffsets: number[];
}
```

### Position / Range

```ts
export interface Position {
  line: number;      // 1-based
  column: number;    // 1-based
  offset: number;    // 0-based
}

export interface Range {
  start: Position;
  end: Position;
}
```

### MathSpan

```ts
export interface MathSpan {
  id: string;
  kind: "inline" | "display";
  delimiter: "$" | "$$" | "\\(" | "\\[" | "math-fence" | "unknown";
  content: string;
  raw: string;
  range: Range;
  contentRange: Range;
  parserRecognized: boolean;
  context: MathContext;
}
```

### MathContext

```ts
export interface MathContext {
  inFencedCode: boolean;
  inInlineCode: boolean;
  inTable: boolean;
  inList: boolean;
  inBlockquote: boolean;
  openingLine: string;
  closingLine: string;
  previousChar?: string;
  nextChar?: string;
  lineBefore?: string;
  lineAfter?: string;
}
```

### Diagnostic

```ts
export interface Diagnostic {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  range: Range;
  help?: string;
  related?: RelatedLocation[];
  fixes?: Fix[];
}
```

### Rule

```ts
export interface Rule {
  id: string;
  meta: {
    defaultSeverity: "error" | "warning" | "info";
    fixable: boolean;
    description: string;
  };
  check(ctx: RuleContext): Diagnostic[];
}
```

## 最关键设计：raw delimiter 与 parser-recognized 分离

只看 AST 会漏掉最关键的情况：

```md
所以$$x=1$$成立。
```

如果 parser 没识别成 math，AST 里没有 math 节点。工具必须通过 raw scanner 发现可疑 `$$`，并给出：

```text
warning[MDM015]: raw math delimiter was not recognized by selected parser
```

这个能力是 `mdmathlint` 区别于普通 KaTeX wrapper 的核心。

---

## 规则依赖与排序模型

### 为什么需要

同一条文本可能触发多条规则。例如：

```md
所以$$x=1$$成立。
```

可能同时触发 MDM003（未独占行）、MDM015（未被 parser 识别）。如果两条都报告，用户得到的是重复信息。理想行为是：**只报告根因**。

### 抑制链（suppression chain）

以下规则链中，左边的规则触发时会抑制右边的规则对同一 span 的报告：

```text
MDM015 (raw 未被识别)
  → 抑制 MDM003, MDM004, MDM005（因为 parser 根本没看到 math，边界规则无意义）

MDM001/MDM002 (未闭合)
  → 抑制 MDM003, MDM004（未闭合的情况下讨论独占行/空行无意义）

MDM006 (货币疑似)
  → 抑制 MDM005（对该 dollar 的粘连诊断无意义）

MDM007 (代码块中的公式)
  → 抑制 MDM001/MDM002/MDM012（代码块中的公式语法错误不需要报告）
```

### 实现方式

在每个 Rule 的 `check()` 返回结果之前，由 `RuleEngine` 做一次后处理：

```ts
function applySuppression(diagnostics: Diagnostic[]): Diagnostic[] {
  // 按优先级排序
  // 遍历：如果一条 diag 的 range 被更高优先级的 diag 覆盖，则过滤掉
}
```

### 排序优先级（从高到低）

1. MDM001, MDM002（未闭合 — 最根本）
2. MDM015（raw 未被识别）
3. MDM012（KaTeX 语法错误）
4. MDM006（货币疑似）
5. MDM007（代码块中的公式）
6. MDM003, MDM004（边界格式）
7. MDM005（粘连）
8. MDM008–MDM011, MDM013, MDM014（上下文规则）

---

## KaTeX 错误处理策略

### 问题

`katex.renderToString()` 在 `throwOnError: true` + `strict: "error"` 模式下会抛出异常。以下场景可能导致崩溃而非优雅诊断：

- 极度嵌套（`\frac{\frac{\frac{...}{...}}{...}}{...}` 1000 层）
- KaTeX 内部 bug
- 超大宏展开

### 方案

**包装函数** `safeKatexCheck`：

```ts
export function safeKatexCheck(
  math: string,
  options: KatexOptions
): KatexCheckResult {
  try {
    const html = katex.renderToString(math, {
      throwOnError: true,
      strict: "error",
      displayMode: options.displayMode,
      macros: options.macros ?? {},
      maxSize: 500,          // KaTeX 内置：拒绝 >500 字符的表达式
      maxExpand: 1000,       // KaTeX 内置：宏展开上限
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof katex.ParseError) {
      return {
        ok: false,
        error: {
          message: e.message,
          position: e.position,   // KaTeX 给出的公式内部偏移
        },
      };
    }
    // 非 ParseError（如 OOM、内部错误）
    return {
      ok: false,
      error: {
        message: `KaTeX internal error: ${String(e)}`,
        position: undefined,
      },
      internalError: true,
    };
  }
}
```

### 结果映射

| KaTeX 结果 | 工具行为 |
|---|---|
| 解析成功 | 不产生 diagnostic |
| `ParseError` | 产生 MDM012 error，消息中包含 KaTeX 错误信息，`position` 映射到 Markdown 行列 |
| 内部错误 | 产生 MDM012 warning，消息 "Could not verify TeX syntax: internal error" |
| 表达式过大（maxSize） | 产生 MDM012 warning，提示表达式过长 |

### 性能安全边界

```ts
const MAX_MATH_LENGTH = 2000;  // 单个公式字符数上限，超过则跳过 KaTeX 检查
```

超过此上限的公式直接跳过 KaTeX 检查，产生一条 info 级别的 diagnostic："Formula too long for syntax validation"。

---

## Fix 应用管线

### 设计目标

- fix 之间不冲突
- 同一文件运行两次 `--fix` 的结果与运行一次相同（**幂等性**）
- fix 是保守的：宁可不修，不可修错

### 一次 fix 的完整流程

```text
1. 收集所有 rules 产生的 fixes
     ↓
2. Fix 排序（按 offset 从后往前，避免位置漂移）
     ↓
3. 冲突检测（两个 fix 的 range 有重叠 → 丢弃重叠者）
     ↓
4. Apply fixes（从后往前修改文本）
     ↓
5. 生成新 SourceDocument
     ↓
6. 重新 lint（检查是否因 fix 引入了新问题）
     ↓
7. 如果仍有 fixable diagnostics → 回到步骤 1（最多迭代 5 次）
```

### Fix 冲突检测规则

```ts
function hasConflict(a: Fix, b: Fix): boolean {
  // 两个 fix 的 range 有重叠 → 冲突
  return a.range.start.offset <= b.range.end.offset &&
         b.range.start.offset <= a.range.end.offset;
}
```

冲突解决策略：保留先产生的 fix（通常是更根本的规则的 fix），丢弃后者。

### 迭代终止条件

最多迭代 **5 次**。超过 5 次仍未稳定 → 输出 warning 告知用户"部分修复可能未完全应用"，但仍写入当前结果。

### 幂等性保障

fix 管线保证幂等性的方式是：每条 fix 在应用后，其 `replacement` 文本不应引入新的 diagnostics。测试策略见 [07-testing-and-quality.md](07-testing-and-quality.md)。
