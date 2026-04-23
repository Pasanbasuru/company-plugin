import { describe, it, expect } from "vitest";
import { checkSize } from "./size.js";
import type { SkillFile } from "../types.js";

function withLines(n: number): SkillFile {
  const contents = Array(n).fill("x").join("\n");
  return { path: "/fake/SKILL.md", contents, frontmatter: {}, body: contents, lineCount: n };
}

describe("checkSize", () => {
  it("PASS under 400 lines", () => {
    expect(checkSize(withLines(200)).severity).toBe("PASS");
    expect(checkSize(withLines(399)).severity).toBe("PASS");
  });
  it("CONCERN between 400 and 499 lines", () => {
    expect(checkSize(withLines(400)).severity).toBe("CONCERN");
    expect(checkSize(withLines(499)).severity).toBe("CONCERN");
  });
  it("FAIL at 500+ lines", () => {
    expect(checkSize(withLines(500)).severity).toBe("FAIL");
    expect(checkSize(withLines(642)).severity).toBe("FAIL");
  });
});
