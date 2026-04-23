import { describe, it, expect } from "vitest";
import { parseSkill } from "../parse.js";
import { checkSections } from "./sections.js";

const FULL = `---
name: s
description: Use when doing X reliably.
---

## Core rules
- rule

## Red flags
- flag

## Review checklist
body

## Interactions with other skills
- **Hands off to:** foo:bar
`;

describe("checkSections", () => {
  it("PASS when all four sections present", () => {
    const skill = parseSkill("/fake/SKILL.md", FULL);
    const result = checkSections(skill);
    expect(result.severity).toBe("PASS");
  });

  it("FAIL when Interactions section missing", () => {
    const body = FULL.replace("## Interactions with other skills\n- **Hands off to:** foo:bar\n", "");
    const skill = parseSkill("/fake/SKILL.md", body);
    const result = checkSections(skill);
    expect(result.severity).toBe("FAIL");
    expect(result.findings[0].category).toBe("sections");
  });

  it("FAIL when Review checklist missing", () => {
    const body = FULL.replace(/## Review checklist[\s\S]*?(?=##)/, "");
    const skill = parseSkill("/fake/SKILL.md", body);
    const result = checkSections(skill);
    expect(result.severity).toBe("FAIL");
  });

  it("accepts 'Rules' as a synonym for 'Core rules'", () => {
    const body = FULL.replace("## Core rules", "## Rules");
    const skill = parseSkill("/fake/SKILL.md", body);
    const result = checkSections(skill);
    expect(result.severity).toBe("PASS");
  });
});
