# 05. API 与 CLI 设计规范

## CLI 设计

### 基本命令

```bash
mdmathlint README.md
mdmathlint docs/**/*.md
mdmathlint --stdin
mdmathlint answer.md --profile llm-output
mdmathlint answer.md --format json
mdmathlint answer.md --fix
mdmathlint answer.md --fix-dry-run
```

### 退出码

默认：

- `0`：无 error；warning 不导致失败
- `1`：存在 error
- `2`：CLI 参数错误、配置错误、文件读取错误

可选：

```bash
mdmathlint . --max-warnings 0
```

当 warning 数超过阈值时返回 `1`。

## CLI 参数

```text
Usage: mdmathlint [options] [files...]

Options:
  --stdin                         read Markdown from stdin
  --stdin-filename <name>          virtual filename for stdin diagnostics
  --profile <name>                 strict|github|llm-output|markdown-it
  --config <path>                  config file path
  --format <format>                pretty|json|sarif
  --fix                           apply safe fixes
  --fix-dry-run                   show fixes without writing
  --max-warnings <n>               fail if warnings exceed n
  --no-color                      disable colored output
  --explain <rule-id>              print rule explanation
```

## 配置文件

文件名：

```text
.mdmathlintrc
.mdmathlintrc.json
.mdmathlintrc.jsonc
mdmathlint.config.js      # Phase 3
```

示例：

```json
{
  "profile": "llm-output",
  "rules": {
    "MDM003": "error",
    "MDM004": "warning",
    "MDM005": "warning",
    "MDM006": "error"
  },
  "katex": {
    "strict": "error",
    "macros": {
      "\\RR": "\\mathbb{R}",
      "\\NN": "\\mathbb{N}"
    }
  },
  "fix": {
    "inlineSpacing": true,
    "displayOwnLine": true,
    "currencyDollar": false
  }
}
```

## Library API

### lintText

```ts
export async function lintText(
  text: string,
  options?: LintOptions
): Promise<LintResult>;
```

### lintFiles

```ts
export async function lintFiles(
  files: string[],
  options?: LintOptions
): Promise<LintResult[]>;
```

### 类型

```ts
export interface LintOptions {
  filePath?: string;
  profile?: ProfileName;
  rules?: Record<string, RuleSeverity | "off">;
  katex?: KatexOptions;
  fix?: boolean;
}

export interface LintResult {
  filePath: string;
  diagnostics: Diagnostic[];
  fixedText?: string;
  stats: {
    errorCount: number;
    warningCount: number;
    infoCount: number;
  };
}
```

## JSON 输出格式

```json
{
  "version": "0.1.0",
  "files": [
    {
      "path": "answer.md",
      "diagnostics": [
        {
          "code": "MDM003",
          "severity": "error",
          "message": "display math delimiter should be on its own line",
          "range": {
            "start": { "line": 12, "column": 3, "offset": 128 },
            "end": { "line": 12, "column": 5, "offset": 130 }
          },
          "help": "Place $$ on separate lines with blank lines around display math.",
          "fixes": [
            {
              "title": "split display math into its own block",
              "range": { "start": { "offset": 120 }, "end": { "offset": 140 } },
              "replacement": "..."
            }
          ]
        }
      ]
    }
  ],
  "summary": {
    "errorCount": 1,
    "warningCount": 0,
    "infoCount": 0
  }
}
```

## `--explain` 输出示例

```bash
$ mdmathlint --explain MDM003
```

```text
Rule: MDM003 — display-delimiter-not-own-line
Severity: warning (default)
Fixable: yes

Summary:
Display math delimiters ($$) should each be on their own line, with
the math content on separate lines between them.

Bad:
  所以$$x=1$$成立。

Good:
  所以

  $$
  x=1
  $$

  成立。

Why:
  When $$ is attached to surrounding text, some Markdown renderers
  (especially those based on simple regex matching) fail to
  recognize the math block. Placing $$ on separate lines ensures
  compatibility with all major renderers.

See also: MDM004 (display math missing blank lines)
```

## 配置与 Profile 组合

### Profile 模型：base + overrides

用户配置不只是一个 profile 选择，而是一个**组合**：

```text
最终 severity = profile 预设 → 用户 config.rules 覆盖 → CLI --rule 覆盖
```

示例：以 `github` 为基础，但对 LLM 输出场景强制开启 MDM015：

```json
{
  "profile": "github",
  "rules": {
    "MDM015": "error"
  }
}
```

这意味着用户不必在 "选择哪个 profile" 和 "自定义每条规则" 之间二选一。`profile` 字段提供默认值，`rules` 字段提供逐条覆盖。

### 配置发现顺序

1. CLI `--config <path>` 指定的文件
2. 当前目录的 `.mdmathlintrc.json` / `.mdmathlintrc.jsonc`
3. 向上遍历父目录，找到第一个 `.mdmathlintrc.json`
4. 若都没找到，使用 `portable` profile 默认值

---

## API 稳定性规范

- Rule ID 一旦发布，不轻易重命名。
- JSON 输出字段只增不删。
- Fix 必须可通过 range + replacement 表达。
- Diagnostic 必须带 code、severity、message、range。
- Profile 行为变化必须写 changelog。
