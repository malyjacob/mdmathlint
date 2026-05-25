import type { VFile } from "vfile";
import { lintText } from "./index.js";
import type { LintOptions } from "./types.js";

export default function remarkMathLint(options: LintOptions = {}) {
  return async function transformer(_tree: unknown, file: VFile): Promise<void> {
    const result = await lintText(String(file), {
      ...options,
      filePath: file.path || "<remark>",
      fix: false,
    });
    result.diagnostics.forEach((diagnostic) => {
      const message = file.message(
        diagnostic.message,
        {
          start: { line: diagnostic.range.start.line, column: diagnostic.range.start.column },
          end: { line: diagnostic.range.end.line, column: diagnostic.range.end.column },
        },
        `mdmathlint:${diagnostic.code}`,
      );
      message.fatal = diagnostic.severity === "error" ? true : diagnostic.severity === "warning" ? false : null;
    });
  };
}
