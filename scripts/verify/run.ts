import type { CheckResult, SkillFile, Verdict } from "./types.js";
import { checkFrontmatter } from "./checks/frontmatter.js";
import { checkSections } from "./checks/sections.js";
import { checkReviewChecklist } from "./checks/review-checklist.js";
import { checkMarkers } from "./checks/markers.js";
import { checkSize } from "./checks/size.js";
import { checkDiscoverability } from "./checks/discoverability.js";

export function verdictFor(results: CheckResult[]): Verdict {
  if (results.some((r) => r.severity === "FAIL")) return "RED";
  if (results.some((r) => r.severity === "CONCERN")) return "YELLOW";
  return "GREEN";
}

export function runChecks(skill: SkillFile): { verdict: Verdict; results: CheckResult[] } {
  const results: CheckResult[] = [
    checkFrontmatter(skill),
    checkSections(skill),
    checkReviewChecklist(skill),
    checkMarkers(skill),
    checkSize(skill),
    checkDiscoverability(skill),
  ];
  return { verdict: verdictFor(results), results };
}

export function formatReport(
  skillName: string,
  { verdict, results }: { verdict: Verdict; results: CheckResult[] },
): string {
  const lines: string[] = [];
  lines.push(`Verification: ${skillName}`);
  lines.push(`Mode: fast`);
  lines.push(`Verdict: ${verdict}`);
  lines.push("");
  lines.push("Checklist coverage");
  lines.push("------------------");
  for (const r of results) lines.push(`- ${r.name}: ${r.severity}`);
  lines.push("");
  const findings = results.flatMap((r) => r.findings);
  if (findings.length > 0) {
    lines.push("Findings");
    lines.push("--------");
    for (const f of findings) {
      lines.push(`- [${f.severity}] ${f.category}: ${f.message}`);
      lines.push(`    fix: ${f.fix}`);
    }
  }
  return lines.join("\n");
}
