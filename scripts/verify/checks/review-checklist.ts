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

  const contentLines = section
    .split("\n")
    .slice(1) // drop the '## Review checklist' heading line
    .filter((l) => l.trim().length > 0);
  const hasAllSubsections = SUBSECTIONS.every((sub) =>
    new RegExp(`###\\s+${sub}\\b`).test(section),
  );
  const hasSanctionedLabels = SANCTIONED_LABELS.some((label) =>
    new RegExp(`\\b${label}\\b`).test(section),
  );
  const isStub = contentLines.length < 5;

  if (isStub) {
    findings.push({
      line: null,
      severity: "CONCERN",
      category: "review-checklist",
      message: "Review checklist section is stub-like (<5 content lines)",
      fix: "Expand with per-rule verdicts (PASS/CONCERN/NOT APPLICABLE) or the four-subsection shape (Summary / Findings / Safer alternative / Checklist coverage)",
    });
  } else if (!hasAllSubsections && !hasSanctionedLabels) {
    findings.push({
      line: null,
      severity: "CONCERN",
      category: "review-checklist",
      message: "Review checklist lacks both four-subsection shape and sanctioned labels",
      fix: "Add '### Summary / ### Findings / ### Safer alternative / ### Checklist coverage', OR include per-rule PASS/CONCERN/NOT APPLICABLE markers",
    });
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
