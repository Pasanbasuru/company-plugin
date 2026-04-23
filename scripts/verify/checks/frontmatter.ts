import type { CheckResult, Finding, SkillFile } from "../types.js";

export function checkFrontmatter(skill: SkillFile): CheckResult {
  const findings: Finding[] = [];

  if (skill.frontmatter === null) {
    findings.push({
      line: 1,
      severity: "FAIL",
      category: "frontmatter",
      message: "SKILL.md has no YAML frontmatter",
      fix: "Add `---\\nname: ...\\ndescription: Use when ...\\n---` at the top",
    });
    return { name: "frontmatter", severity: "FAIL", findings };
  }

  const fm = skill.frontmatter;
  if (typeof fm.name !== "string" || fm.name.length === 0) {
    findings.push({
      line: 1,
      severity: "FAIL",
      category: "frontmatter",
      message: "Missing or empty `name` field",
      fix: "Add a kebab-case `name:` field matching the skill directory",
    });
  }

  const desc = typeof fm.description === "string" ? fm.description : "";
  if (!desc) {
    findings.push({
      line: 1,
      severity: "FAIL",
      category: "frontmatter",
      message: "Missing `description` field",
      fix: "Add a `description:` starting with 'Use when ...'",
    });
  } else {
    if (desc.length < 100) {
      findings.push({
        line: 1,
        severity: "CONCERN",
        category: "frontmatter",
        message: `description is ${desc.length} chars; target ≥100 for discoverability`,
        fix: "Expand the description with concrete use cases and stack/domain keywords",
      });
    }
    if (!/\bUse when\b/i.test(desc)) {
      findings.push({
        line: 1,
        severity: "CONCERN",
        category: "frontmatter",
        message: "description does not contain a 'Use when' trigger clause",
        fix: "Rewrite to start with 'Use when <specific condition>'",
      });
    }
  }

  const severity = findings.some((f) => f.severity === "FAIL")
    ? "FAIL"
    : findings.some((f) => f.severity === "CONCERN")
      ? "CONCERN"
      : "PASS";
  return { name: "frontmatter", severity, findings };
}
