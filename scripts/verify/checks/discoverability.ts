import type { CheckResult, Finding, SkillFile } from "../types.js";

const TRIGGER_VERBS = [
  "creating", "editing", "reviewing", "verifying", "debugging",
  "deploying", "refactoring", "auditing", "testing", "designing",
  "scaffolding", "validating", "analyzing", "implementing", "fixing",
  "enforcing", "ensuring", "protecting", "preventing", "guarding",
  "blocking", "catching", "evaluating", "assessing", "checking",
  "monitoring", "observing", "tracing", "handling", "managing",
  "planning", "rolling", "migrating", "structuring", "organizing",
  "securing", "hardening",
];
const STACK_KEYWORDS: Record<string, string[]> = {
  nextjs: ["next", "app router"],
  nest: ["nest", "nestjs"],
  prisma: ["prisma", "postgres", "database", "orm"],
  aws: ["aws", "cloudformation", "cdk", "lambda"],
  react: ["react", "jsx", "hook"],
  mobile: ["mobile", "react native", "rn"],
  frontend: ["frontend", "ui", "component"],
  backend: ["backend", "service", "api"],
};

export interface DiscoverabilityResult extends CheckResult {
  score: number;
}

export function checkDiscoverability(skill: SkillFile): DiscoverabilityResult {
  const findings: Finding[] = [];
  const fm = skill.frontmatter ?? {};
  const name = typeof fm.name === "string" ? fm.name.toLowerCase() : "";
  const desc = typeof fm.description === "string" ? fm.description : "";
  const descLower = desc.toLowerCase();

  let score = 0;

  if (/\bUse when\b/i.test(desc)) score += 20;
  else findings.push({ line: 1, severity: "CONCERN", category: "discoverability", message: "description missing 'Use when' trigger clause", fix: "Start description with 'Use when ...'" });

  if (desc.length >= 100) score += 15;
  else findings.push({ line: 1, severity: "CONCERN", category: "discoverability", message: `description is ${desc.length} chars (target >=100)`, fix: "Expand with concrete use cases" });
  if (desc.length >= 30) score += 10;
  if (desc.length >= 50) score += 10;

  if (TRIGGER_VERBS.some((v) => descLower.includes(v))) score += 15;
  else findings.push({ line: 1, severity: "CONCERN", category: "discoverability", message: "description lacks a trigger verb (creating, editing, reviewing, etc.)", fix: "Include a concrete verb describing what the user is doing" });

  for (const [key, kws] of Object.entries(STACK_KEYWORDS)) {
    if (name.includes(key)) {
      if (!kws.some((k) => descLower.includes(k))) {
        findings.push({ line: 1, severity: "CONCERN", category: "discoverability", message: `skill name suggests '${key}' stack but description does not mention ${kws.join(" / ")}`, fix: `Name the stack explicitly in description` });
      } else {
        score += 15;
      }
      break;
    }
  }
  if (!Object.keys(STACK_KEYWORDS).some((k) => name.includes(k))) {
    score += 15;
  }

  if (/\bfor\b|\bto\b/i.test(desc) && desc.length >= 80) score += 15;

  if (/TRIGGER when:|SKIP when:/i.test(desc)) score += 10;

  if (/^[a-z][a-z0-9-]*$/.test(name) && name.split("-").length >= 2) score += 10;

  const hasStackConcern = findings.some((f) => f.message.includes("stack"));
  let severity: "PASS" | "CONCERN" | "FAIL" = score >= 70 ? "PASS" : score >= 35 ? "CONCERN" : "FAIL";
  if (hasStackConcern && severity === "PASS") severity = "CONCERN";
  if (severity === "FAIL" && !findings.some((f) => f.severity === "FAIL")) {
    findings.push({ line: 1, severity: "FAIL", category: "discoverability", message: `Discoverability score ${score}/100 (need >=35 to pass, >=70 for clean)`, fix: "Strengthen description: add 'Use when', trigger verb, stack/domain keywords" });
  }
  return { name: "discoverability", severity, findings, score };
}
