import type { CheckResult, Finding, SkillFile } from "../types.js";

const SECTION_START_RE = /^##\s+Review checklist\b/m;
const NEXT_SECTION_RE = /^##\s/m;
const SUBSECTIONS = ["Summary", "Findings", "Safer alternative", "Checklist coverage"];
const SANCTIONED_LABELS = ["PASS", "CONCERN", "NOT APPLICABLE"];
const FORBIDDEN_LABELS = ["BLOCKING", "COMPLETE", "INCOMPLETE", "LOW", "MED", "HIGH", "CRITICAL"];

function extractSection(body: string): string | null {
  const start = body.match(SECTION_START_RE);
  if (!start || start.index === undefined) return null;
  const rest = body.slice(start.index + start[0].length);
  const next = rest.match(NEXT_SECTION_RE);
  const end = next && next.index !== undefined ? next.index : rest.length;
  return start[0] + rest.slice(0, end);
}

export function checkReviewChecklist(skill: SkillFile): CheckResult {
  const findings: Finding[] = [];
  const section = extractSection(skill.body);
  if (section === null) {
    return { name: "review-checklist", severity: "PASS", findings };
  }

  for (const sub of SUBSECTIONS) {
    if (!new RegExp(`###\\s+${sub}\\b`).test(section)) {
      findings.push({
        line: null,
        severity: "CONCERN",
        category: "review-checklist",
        message: `Review checklist missing subsection: ${sub}`,
        fix: `Add '### ${sub}' inside the Review checklist section`,
      });
    }
  }

  for (const forbidden of FORBIDDEN_LABELS) {
    const re = new RegExp(`\\b${forbidden}\\b`);
    if (re.test(section)) {
      findings.push({
        line: null,
        severity: "CONCERN",
        category: "review-checklist",
        message: `Non-sanctioned grading label '${forbidden}' in Review checklist`,
        fix: `Use only: ${SANCTIONED_LABELS.join(", ")}`,
      });
    }
  }

  const severity = findings.length > 0 ? "CONCERN" : "PASS";
  return { name: "review-checklist", severity, findings };
}
