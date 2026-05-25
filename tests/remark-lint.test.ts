import { unified } from "unified";
import remarkParse from "remark-parse";
import { VFile } from "vfile";
import { describe, expect, it } from "vitest";
import remarkMathLint from "../src/remarkLint.js";

describe("remark plugin", () => {
  it("publishes mdmathlint diagnostics as VFile messages", async () => {
    const processor = unified().use(remarkParse).use(remarkMathLint, { profile: "strict" });
    const file = new VFile({ path: "answer.md", value: "令$x$为变量。\n" });
    await processor.run(processor.parse(file), file);
    expect(file.messages).toHaveLength(1);
    expect(file.messages[0].source).toBe("mdmathlint");
    expect(file.messages[0].ruleId).toBe("MDM005");
    expect(file.messages[0].fatal).toBe(false);
  });

  it("marks error diagnostics as fatal", async () => {
    const processor = unified().use(remarkParse).use(remarkMathLint);
    const file = new VFile({ value: "bad $x\n" });
    await processor.run(processor.parse(file), file);
    expect(file.messages[0].ruleId).toBe("MDM001");
    expect(file.messages[0].fatal).toBe(true);
  });
});
