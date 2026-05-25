export type Severity = "error" | "warning" | "info";
export type RuleSetting = Severity | "off";
export type ProfileName = "portable" | "strict" | "github" | "llm-output" | "markdown-it";
export type MarkdownItSimulation = "texmath" | "dollarmath";

export interface Position {
  line: number;
  column: number;
  offset: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Fix {
  title: string;
  range: Range;
  replacement: string;
  code?: string;
}

export interface Diagnostic {
  code: string;
  severity: Severity;
  message: string;
  range: Range;
  help?: string;
  fixes?: Fix[];
  spanId?: string;
}

export interface KatexOptions {
  strict?: "error" | "warn" | "ignore";
  macros?: Record<string, string>;
}

export interface FixOptions {
  inlineSpacing?: boolean;
  displayOwnLine?: boolean;
  currencyDollar?: boolean;
}

export interface LintOptions {
  filePath?: string;
  profile?: ProfileName;
  rules?: Record<string, RuleSetting>;
  katex?: KatexOptions;
  fix?: boolean;
  fixOptions?: FixOptions;
  markdownItSimulation?: MarkdownItSimulation;
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

export interface ConfigFile {
  profile?: ProfileName;
  rules?: Record<string, RuleSetting>;
  katex?: KatexOptions;
  fix?: FixOptions;
}

export interface ProfileDiffResult {
  filePath: string;
  profiles: Partial<Record<ProfileName, LintResult>>;
}
