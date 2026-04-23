import type { CheckResult, Finding, SkillFile } from "../types.js";

export function checkSize(skill: SkillFile): CheckResult {
  const findings: Finding[] = [];
  const n = skill.lineCount;
  if (n >= 500) {
    findings.push({
      line: null,
      severity: "FAIL",
      category: "size",
      message: `${n} lines — over the 500-line ceiling`,
      fix: "Split the skill into focused sub-skills",
    });
    return { name: "size", severity: "FAIL", findings };
  }
  if (n >= 400) {
    findings.push({
      line: null,
      severity: "CONCERN",
      category: "size",
      message: `${n} lines — over 400-line target`,
      fix: "Consider splitting or trimming",
    });
    return { name: "size", severity: "CONCERN", findings };
  }
  return { name: "size", severity: "PASS", findings };
}
