import { describe, it, expect } from "vitest";
import { parseSkill } from "./parse.js";

const SAMPLE = `---
name: my-skill
description: Use when X.
---

# My Skill

body line 1
body line 2
`;

describe("parseSkill", () => {
  it("extracts frontmatter and body", () => {
    const parsed = parseSkill("/fake/path/SKILL.md", SAMPLE);
    expect(parsed.frontmatter).toEqual({ name: "my-skill", description: "Use when X." });
    expect(parsed.body).toContain("# My Skill");
    expect(parsed.lineCount).toBe(9);
  });

  it("returns null frontmatter when missing", () => {
    const parsed = parseSkill("/fake/path/SKILL.md", "# no frontmatter\n");
    expect(parsed.frontmatter).toBeNull();
    expect(parsed.body).toContain("# no frontmatter");
  });

  it("throws on malformed frontmatter YAML", () => {
    const bad = `---\nname: : : broken\n---\nbody\n`;
    expect(() => parseSkill("/fake/path/SKILL.md", bad)).toThrow();
  });
});
