import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runChecks, formatReport, verdictFor } from "./run.js";
import { parseSkill } from "./parse.js";

const GOOD = `---
name: good-skill
description: Use when reviewing a widget for quality. Covers test coverage, accessibility, and regression risks in the frontend.
---

## Core rules
- rule 1

## Red flags
- flag 1

## Review checklist

### Summary
summary

### Findings
| file:line | severity | category | fix |

### Safer alternative
alt

### Checklist coverage
- rule 1: PASS

## Interactions with other skills
- **REQUIRED BACKGROUND:** superpowers:brainstorming
`;

describe("runChecks", () => {
  it("GREEN verdict for a compliant skill", () => {
    const skill = parseSkill("/fake/SKILL.md", GOOD);
    const { verdict, results } = runChecks(skill);
    expect(verdict).toBe("GREEN");
    expect(results.every((r) => r.severity === "PASS")).toBe(true);
  });

  it("RED verdict when any check FAILs", () => {
    const body = GOOD.replace("name: good-skill", "name: x");
    const skill = parseSkill("/fake/SKILL.md", body);
    const { verdict } = runChecks(skill);
    expect(verdict).toBe("RED");
  });

  it("YELLOW verdict when any CONCERN, no FAIL", () => {
    const body = GOOD.replace("Use when reviewing a widget for quality. Covers test coverage, accessibility, and regression risks in the frontend.", "Use when reviewing widgets.");
    const skill = parseSkill("/fake/SKILL.md", body);
    const { verdict } = runChecks(skill);
    expect(verdict).toBe("YELLOW");
  });

  it("formatReport produces a readable Markdown-like block", () => {
    const skill = parseSkill("/fake/SKILL.md", GOOD);
    const report = formatReport("good-skill", runChecks(skill));
    expect(report).toContain("Verdict: GREEN");
  });

  it("verdictFor maps PASS→GREEN, CONCERN→YELLOW, FAIL→RED", () => {
    expect(verdictFor([{ name: "a", severity: "PASS", findings: [] }])).toBe("GREEN");
    expect(verdictFor([{ name: "a", severity: "CONCERN", findings: [] }])).toBe("YELLOW");
    expect(verdictFor([{ name: "a", severity: "FAIL", findings: [] }])).toBe("RED");
  });
});

const fx = (name: string) => resolve(`scripts/fixtures/${name}/SKILL.md`);

describe("fixtures E2E", () => {
  it("good-skill → GREEN", () => {
    const skill = parseSkill(fx("good-skill"), readFileSync(fx("good-skill"), "utf8"));
    expect(runChecks(skill).verdict).toBe("GREEN");
  });
  it("bad-weak-description → YELLOW or RED", () => {
    const skill = parseSkill(fx("bad-weak-description"), readFileSync(fx("bad-weak-description"), "utf8"));
    expect(runChecks(skill).verdict).not.toBe("GREEN");
  });
  it("bad-no-interactions → RED", () => {
    const skill = parseSkill(fx("bad-no-interactions"), readFileSync(fx("bad-no-interactions"), "utf8"));
    expect(runChecks(skill).verdict).toBe("RED");
  });
  it("bad-prose-handoff → YELLOW", () => {
    const skill = parseSkill(fx("bad-prose-handoff"), readFileSync(fx("bad-prose-handoff"), "utf8"));
    expect(runChecks(skill).verdict).toBe("YELLOW");
  });
  it("bad-oversize → RED", () => {
    const skill = parseSkill(fx("bad-oversize"), readFileSync(fx("bad-oversize"), "utf8"));
    expect(runChecks(skill).verdict).toBe("RED");
  });
});
