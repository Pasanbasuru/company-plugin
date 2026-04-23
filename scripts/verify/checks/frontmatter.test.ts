import { describe, it, expect } from "vitest";
import { parseSkill } from "../parse.js";
import { checkFrontmatter } from "./frontmatter.js";

function build(fm: string) {
  return parseSkill("/fake/SKILL.md", `---\n${fm}\n---\n\nbody\n`);
}

describe("checkFrontmatter", () => {
  it("PASS when name+description present and description has 'Use when'", () => {
    const skill = build(`name: my-skill\ndescription: Use when creating a new widget and it must render reliably across browsers, including edge cases and accessibility requirements.`);
    const result = checkFrontmatter(skill);
    expect(result.severity).toBe("PASS");
    expect(result.findings).toHaveLength(0);
  });

  it("FAIL when name missing", () => {
    const skill = build(`description: Use when doing X widely enough to matter.`);
    const result = checkFrontmatter(skill);
    expect(result.severity).toBe("FAIL");
    expect(result.findings[0].category).toBe("frontmatter");
  });

  it("FAIL when description missing", () => {
    const skill = build(`name: my-skill`);
    const result = checkFrontmatter(skill);
    expect(result.severity).toBe("FAIL");
  });

  it("CONCERN when description < 100 chars", () => {
    const skill = build(`name: my-skill\ndescription: Use when short.`);
    const result = checkFrontmatter(skill);
    expect(result.severity).toBe("CONCERN");
  });

  it("CONCERN when description lacks 'Use when' clause", () => {
    const skill = build(`name: my-skill\ndescription: This skill handles widgets and is generally useful for frontend engineering work in our codebase.`);
    const result = checkFrontmatter(skill);
    expect(result.severity).toBe("CONCERN");
  });

  it("PASS for underscore-prefixed template names like _baseline", () => {
    const skill = build(`name: _baseline\ndescription: Use when authoring a new skill and you need a minimal template as a starting point with all required sections in place.`);
    const result = checkFrontmatter(skill);
    expect(result.severity).toBe("PASS");
  });

  it("FAIL when name is too short (e.g. 'x')", () => {
    const skill = build(`name: x\ndescription: Use when doing a valid and sufficiently long description for discoverability here.`);
    const result = checkFrontmatter(skill);
    expect(result.severity).toBe("FAIL");
  });

  it("FAIL when frontmatter missing entirely", () => {
    const skill = parseSkill("/fake/SKILL.md", "# no frontmatter\n");
    const result = checkFrontmatter(skill);
    expect(result.severity).toBe("FAIL");
  });
});
