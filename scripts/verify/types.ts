export type Severity = "PASS" | "CONCERN" | "FAIL";
export type Verdict = "GREEN" | "YELLOW" | "RED";

export interface Finding {
  line: number | null;
  severity: Severity;
  category: string;
  message: string;
  fix: string;
}

export interface CheckResult {
  name: string;
  severity: Severity;
  findings: Finding[];
}

export interface SkillFile {
  path: string;
  contents: string;
  frontmatter: Record<string, unknown> | null;
  body: string;
  lineCount: number;
}
