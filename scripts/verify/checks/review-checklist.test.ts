import { describe, it, expect } from "vitest";
import { parseSkill } from "../parse.js";
import { checkReviewChecklist } from "./review-checklist.js";

const FOUR_SECTION = `---
name: s
description: Use when X.
---

## Review checklist

### Summary
one line

### Findings
| file:line | severity | category | fix |
| - | - | - | - |

### Safer alternative
text

### Checklist coverage
- Rule 1: PASS
- Rule 2: CONCERN
- Rule 3: NOT APPLICABLE
`;

describe("checkReviewChecklist", () => {
  it("PASS when four sections present with sanctioned labels", () => {
    const skill = parseSkill("/fake/SKILL.md", FOUR_SECTION);
    const result = checkReviewChecklist(skill);
    expect(result.severity).toBe("PASS");
  });

  it("CONCERN when Safer alternative missing", () => {
    const body = FOUR_SECTION.replace(/### Safer alternative[\s\S]*?(?=###)/, "");
    const skill = parseSkill("/fake/SKILL.md", body);
    const result = checkReviewChecklist(skill);
    expect(result.severity).toBe("CONCERN");
  });

  it("CONCERN when non-sanctioned grading label used (e.g. BLOCKING)", () => {
    const body = FOUR_SECTION.replace("PASS", "BLOCKING");
    const skill = parseSkill("/fake/SKILL.md", body);
    const result = checkReviewChecklist(skill);
    expect(result.severity).toBe("CONCERN");
  });

  it("returns PASS if Review checklist section absent (handled by sections check)", () => {
    const body = FOUR_SECTION.replace(/## Review checklist[\s\S]*/, "");
    const skill = parseSkill("/fake/SKILL.md", body);
    const result = checkReviewChecklist(skill);
    expect(result.severity).toBe("PASS");
  });
});
