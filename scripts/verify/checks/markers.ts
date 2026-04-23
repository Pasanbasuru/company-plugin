import type { CheckResult, Finding, SkillFile } from "../types.js";

const SANCTIONED = [
  /\*\*REQUIRED SUB-SKILL:\*\*/,
  /\*\*REQUIRED BACKGROUND:\*\*/,
  /\*\*Hands off to:\*\*/,
  /\*\*Does not duplicate:\*\*/,
];
const PROSE_PATTERNS = [
  { re: /\bsee\s+(?:superpowers:|company-plugin:)/i, label: "'see <skill>'" },
  { re: /\buse\s+(?:superpowers:|company-plugin:)/i, label: "'use <skill>'" },
  { re: /\bfeeds? from\s+(?:superpowers:|company-plugin:)/i, label: "'feeds from <skill>'" },
];

function extractInteractionsSection(body: string): string | null {
  const startRe = /^##\s+Interactions with other skills\b.*$/m;
  const startMatch = body.match(startRe);
  if (!startMatch || startMatch.index === undefined) return null;
  const after = body.slice(startMatch.index + startMatch[0].length);
  const nextHeading = after.search(/^##\s/m);
  return nextHeading === -1 ? after : after.slice(0, nextHeading);
}

export function checkMarkers(skill: SkillFile): CheckResult {
  const findings: Finding[] = [];
  const section = extractInteractionsSection(skill.body);
  if (section === null) return { name: "markers", severity: "PASS", findings };

  for (const { re, label } of PROSE_PATTERNS) {
    if (re.test(section)) {
      findings.push({
        line: null,
        severity: "CONCERN",
        category: "markers",
        message: `Prose handoff reference detected: ${label}`,
        fix: "Replace with **REQUIRED SUB-SKILL:**, **REQUIRED BACKGROUND:**, **Hands off to:**, or **Does not duplicate:**",
      });
    }
  }

  const hasAnySanctioned = SANCTIONED.some((re) => re.test(section));
  if (!hasAnySanctioned) {
    findings.push({
      line: null,
      severity: "CONCERN",
      category: "markers",
      message: "Interactions section contains no sanctioned handoff markers",
      fix: "Declare at least one REQUIRED SUB-SKILL / REQUIRED BACKGROUND / Hands off to / Does not duplicate",
    });
  }

  const severity = findings.length > 0 ? "CONCERN" : "PASS";
  return { name: "markers", severity, findings };
}
