import type { CheckResult, Finding, SkillFile } from "../types.js";

const REQUIRED = [
  { label: "Core rules / Rules", pattern: /^##\s+(Core rules|Rules)\b/m },
  { label: "Red flags", pattern: /^##\s+Red flags\b/m },
  { label: "Review checklist", pattern: /^##\s+Review checklist\b/m },
  { label: "Interactions with other skills", pattern: /^##\s+Interactions with other skills\b/m },
];

export function checkSections(skill: SkillFile): CheckResult {
  const findings: Finding[] = [];
  for (const { label, pattern } of REQUIRED) {
    if (!pattern.test(skill.body)) {
      findings.push({
        line: null,
        severity: "FAIL",
        category: "sections",
        message: `Missing required section: ${label}`,
        fix: `Add a '## ${label}' heading and at least one bullet`,
      });
    }
  }
  const severity = findings.length > 0 ? "FAIL" : "PASS";
  return { name: "sections", severity, findings };
}
