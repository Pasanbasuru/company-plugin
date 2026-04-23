import { describe, it, expect } from "vitest";
import { parseSkill } from "../parse.js";
import { checkMarkers } from "./markers.js";

function withInteractions(body: string) {
  return parseSkill("/fake/SKILL.md", `---\nname: s\ndescription: Use when X.\n---\n\n## Interactions with other skills\n${body}\n`);
}

describe("checkMarkers", () => {
  it("PASS when only sanctioned markers are used", () => {
    const skill = withInteractions("- **REQUIRED SUB-SKILL:** superpowers:tdd\n- **Hands off to:** foo:bar");
    const result = checkMarkers(skill);
    expect(result.severity).toBe("PASS");
  });

  it("CONCERN when prose handoff ('see X', 'use X') is used in Interactions", () => {
    const skill = withInteractions("- see superpowers:tdd for testing patterns");
    const result = checkMarkers(skill);
    expect(result.severity).toBe("CONCERN");
  });

  it("accepts 'REQUIRED BACKGROUND' and 'Does not duplicate' markers", () => {
    const skill = withInteractions("- **REQUIRED BACKGROUND:** superpowers:x\n- **Does not duplicate:** company-plugin:y");
    const result = checkMarkers(skill);
    expect(result.severity).toBe("PASS");
  });

  it("PASS when Interactions section is absent (handled by sections check)", () => {
    const skill = parseSkill("/fake/SKILL.md", "---\nname: s\ndescription: Use when X.\n---\n\nbody\n");
    const result = checkMarkers(skill);
    expect(result.severity).toBe("PASS");
  });
});
