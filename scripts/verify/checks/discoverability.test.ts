import { describe, it, expect } from "vitest";
import { parseSkill } from "../parse.js";
import { checkDiscoverability } from "./discoverability.js";

function build(name: string, description: string) {
  const escaped = description.replace(/"/g, '\\"');
  return parseSkill("/fake/SKILL.md", `---\nname: ${name}\ndescription: "${escaped}"\n---\n\nbody\n`);
}

describe("checkDiscoverability", () => {
  it("PASS for a strong generic description", () => {
    const skill = build("code-review-helper",
      "Use when reviewing a pull request for correctness, test coverage, and company conventions. TRIGGER when: user asks for code review. SKIP when: user wants security-specific review.");
    const result = checkDiscoverability(skill);
    expect(result.severity).toBe("PASS");
    expect((result as any).score).toBeGreaterThanOrEqual(70);
  });

  it("CONCERN for a weak description without trigger verbs", () => {
    const skill = build("x", "This skill helps with widgets and is useful sometimes.");
    const result = checkDiscoverability(skill);
    expect(result.severity).toBe("CONCERN");
  });

  it("FAIL for a very weak description", () => {
    const skill = build("x", "handles stuff");
    const result = checkDiscoverability(skill);
    expect(result.severity).toBe("FAIL");
  });

  it("CONCERN if stack-named skill does not mention the stack in description", () => {
    const skill = build("nextjs-app-structure-guard",
      "Use when reviewing an application structure to ensure conventions are followed across the project for maintainability.");
    const result = checkDiscoverability(skill);
    expect(result.severity).toBe("CONCERN");
    expect(result.findings.some((f) => f.message.includes("stack"))).toBe(true);
  });
});
