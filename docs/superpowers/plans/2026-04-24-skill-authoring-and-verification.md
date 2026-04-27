# Skill Authoring & Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two new skills (`skill-authoring`, `skill-verification`) and a Node/TS static checker wired into a git pre-commit hook, so every SKILL.md change is verified for company conventions + discoverability before it lands.

**Architecture:** The static checker is the enforcer (pure Node/TS via `tsx`, runs in git hook + CI + from inside Claude sessions). The two skills are Claude-driven orchestrators: `skill-authoring` wraps `superpowers:writing-skills` + layers company conventions, `skill-verification` delegates static checks to the script and adds optional full-mode checks (7-check C1–C7 audit via subagent dispatch). Pre-commit hook invokes the script directly — no dependency on an active Claude session.

**Tech Stack:** TypeScript (no build step, run via `tsx`), `vitest` for tests, `js-yaml` for frontmatter parsing, `husky` for git hook management. Package manager: `pnpm` (switch to `npm`/`yarn` if user prefers; steps use `pnpm` throughout).

**Spec:** `docs/superpowers/specs/2026-04-24-skill-authoring-and-verification-design.md`

---

## File Structure

```
scripts/
  verify-skill.ts                    # CLI entrypoint — `pnpm verify <file>`
  verify/
    types.ts                         # Shared types (Finding, Verdict, CheckResult)
    run.ts                           # Orchestrator: runs all checks, aggregates verdict
    run.test.ts                      # E2E fixture tests
    checks/
      frontmatter.ts                 # Check 1: frontmatter validity
      frontmatter.test.ts
      sections.ts                    # Check 2: required sections present
      sections.test.ts
      review-checklist.ts            # Check 3: four-section Review checklist shape
      review-checklist.test.ts
      markers.ts                     # Check 4: sanctioned handoff markers only
      markers.test.ts
      size.ts                        # Check 5: line-count budget
      size.test.ts
      discoverability.ts             # Check 6: description quality score
      discoverability.test.ts
  fixtures/
    good-skill/SKILL.md              # All checks PASS
    bad-weak-description/SKILL.md    # Discoverability FAIL
    bad-no-interactions/SKILL.md     # Sections FAIL
    bad-prose-handoff/SKILL.md       # Markers CONCERN
    bad-oversize/SKILL.md            # Size FAIL (>500 lines)
skills/
  skill-authoring/SKILL.md           # Wrapper over superpowers:writing-skills
  skill-verification/SKILL.md        # Orchestrator over the verifier script
.husky/
  pre-commit                         # Runs verify-skill on staged SKILL.md files
package.json                         # pnpm scripts + deps
tsconfig.json                        # strict TS, module: nodenext
```

Why this shape: the script is single-responsibility (static checks, nothing else) and each check is its own file + test so they can evolve independently. The two skill files live alongside the 26 existing skills and follow the same layout. Fixtures drive E2E tests on the orchestrator — each fixture triggers exactly one check to fail so regressions are localized.

---

## Task 1: Bootstrap Node/TS tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore` additions
- Create: `scripts/verify/types.ts`

- [ ] **Step 1: Create package.json**

Create `package.json`:

```json
{
  "name": "global-plugin",
  "version": "0.2.2",
  "private": true,
  "type": "module",
  "scripts": {
    "verify": "tsx scripts/verify-skill.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "prepare": "husky"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^22.10.0",
    "husky": "^9.1.7",
    "js-yaml": "^4.1.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.0",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["scripts/**/*.ts"]
}
```

- [ ] **Step 3: Add .gitignore entries**

Append to `.gitignore`:

```
node_modules
dist
coverage
.vitest/
```

- [ ] **Step 4: Create shared types**

Create `scripts/verify/types.ts`:

```ts
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
```

- [ ] **Step 5: Install dependencies**

Run: `pnpm install`
Expected: installs deps, creates `pnpm-lock.yaml`, no errors.

- [ ] **Step 6: Smoke test tsx + vitest**

Run: `pnpm tsx --version && pnpm vitest --version`
Expected: both print a version string without error.

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json pnpm-lock.yaml .gitignore scripts/verify/types.ts
git commit -m "chore: bootstrap Node/TS tooling for skill verifier"
```

---

## Task 2: Parse SKILL.md (shared helper)

**Files:**
- Create: `scripts/verify/parse.ts`
- Create: `scripts/verify/parse.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/verify/parse.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseSkill } from "./parse.js";

const SAMPLE = `---
name: my-skill
description: Use when X.
---

# My Skill

body line 1
body line 2
`;

describe("parseSkill", () => {
  it("extracts frontmatter and body", () => {
    const parsed = parseSkill("/fake/path/SKILL.md", SAMPLE);
    expect(parsed.frontmatter).toEqual({ name: "my-skill", description: "Use when X." });
    expect(parsed.body).toContain("# My Skill");
    expect(parsed.lineCount).toBe(9);
  });

  it("returns null frontmatter when missing", () => {
    const parsed = parseSkill("/fake/path/SKILL.md", "# no frontmatter\n");
    expect(parsed.frontmatter).toBeNull();
    expect(parsed.body).toContain("# no frontmatter");
  });

  it("throws on malformed frontmatter YAML", () => {
    const bad = `---\nname: : : broken\n---\nbody\n`;
    expect(() => parseSkill("/fake/path/SKILL.md", bad)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test parse.test`
Expected: FAIL with "Cannot find module './parse.js'".

- [ ] **Step 3: Implement parseSkill**

Create `scripts/verify/parse.ts`:

```ts
import yaml from "js-yaml";
import type { SkillFile } from "./types.js";

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

export function parseSkill(path: string, contents: string): SkillFile {
  const lineCount = contents.split("\n").length;
  const match = contents.match(FRONTMATTER_RE);
  if (!match) {
    return { path, contents, frontmatter: null, body: contents, lineCount };
  }
  const [, fmText, body] = match;
  const parsed = yaml.load(fmText);
  if (parsed !== null && typeof parsed !== "object") {
    throw new Error(`Frontmatter in ${path} is not an object`);
  }
  return {
    path,
    contents,
    frontmatter: (parsed as Record<string, unknown>) ?? {},
    body,
    lineCount,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test parse.test`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify/parse.ts scripts/verify/parse.test.ts
git commit -m "feat(verify): add SKILL.md parser"
```

---

## Task 3: Frontmatter validity check

**Files:**
- Create: `scripts/verify/checks/frontmatter.ts`
- Create: `scripts/verify/checks/frontmatter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/verify/checks/frontmatter.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseSkill } from "../parse.js";
import { checkFrontmatter } from "./frontmatter.js";

function build(fm: string) {
  return parseSkill("/fake/SKILL.md", `---\n${fm}\n---\n\nbody\n`);
}

describe("checkFrontmatter", () => {
  it("PASS when name+description present and description has 'Use when'", () => {
    const skill = build(`name: my-skill\ndescription: Use when creating a new widget and it must render reliably across browsers.`);
    const result = checkFrontmatter(skill);
    expect(result.severity).toBe("PASS");
    expect(result.findings).toHaveLength(0);
  });

  it("FAIL when name missing", () => {
    const skill = build(`description: Use when doing X widely enough to matter.`);
    const result = checkFrontmatter(skill);
    expect(result.severity).toBe("FAIL");
    expect(result.findings[0].category).toBe("frontmatter");
  });

  it("FAIL when description missing", () => {
    const skill = build(`name: my-skill`);
    const result = checkFrontmatter(skill);
    expect(result.severity).toBe("FAIL");
  });

  it("CONCERN when description < 100 chars", () => {
    const skill = build(`name: my-skill\ndescription: Use when short.`);
    const result = checkFrontmatter(skill);
    expect(result.severity).toBe("CONCERN");
  });

  it("CONCERN when description lacks 'Use when' clause", () => {
    const skill = build(`name: my-skill\ndescription: This skill handles widgets and is generally useful for frontend engineering work in our codebase.`);
    const result = checkFrontmatter(skill);
    expect(result.severity).toBe("CONCERN");
  });

  it("FAIL when frontmatter missing entirely", () => {
    const skill = parseSkill("/fake/SKILL.md", "# no frontmatter\n");
    const result = checkFrontmatter(skill);
    expect(result.severity).toBe("FAIL");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test checks/frontmatter.test`
Expected: FAIL, "Cannot find module './frontmatter.js'".

- [ ] **Step 3: Implement check**

Create `scripts/verify/checks/frontmatter.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test checks/frontmatter.test`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify/checks/frontmatter.ts scripts/verify/checks/frontmatter.test.ts
git commit -m "feat(verify): add frontmatter check"
```

---

## Task 4: Required sections check

**Files:**
- Create: `scripts/verify/checks/sections.ts`
- Create: `scripts/verify/checks/sections.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/verify/checks/sections.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseSkill } from "../parse.js";
import { checkSections } from "./sections.js";

const FULL = `---
name: s
description: Use when doing X reliably.
---

## Core rules
- rule

## Red flags
- flag

## Review checklist
body

## Interactions with other skills
- **Hands off to:** foo:bar
`;

describe("checkSections", () => {
  it("PASS when all four sections present", () => {
    const skill = parseSkill("/fake/SKILL.md", FULL);
    const result = checkSections(skill);
    expect(result.severity).toBe("PASS");
  });

  it("FAIL when Interactions section missing", () => {
    const body = FULL.replace("## Interactions with other skills\n- **Hands off to:** foo:bar\n", "");
    const skill = parseSkill("/fake/SKILL.md", body);
    const result = checkSections(skill);
    expect(result.severity).toBe("FAIL");
    expect(result.findings[0].category).toBe("sections");
  });

  it("FAIL when Review checklist missing", () => {
    const body = FULL.replace(/## Review checklist[\s\S]*?(?=##)/, "");
    const skill = parseSkill("/fake/SKILL.md", body);
    const result = checkSections(skill);
    expect(result.severity).toBe("FAIL");
  });

  it("accepts 'Rules' as a synonym for 'Core rules'", () => {
    const body = FULL.replace("## Core rules", "## Rules");
    const skill = parseSkill("/fake/SKILL.md", body);
    const result = checkSections(skill);
    expect(result.severity).toBe("PASS");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test checks/sections.test`
Expected: FAIL, "Cannot find module './sections.js'".

- [ ] **Step 3: Implement check**

Create `scripts/verify/checks/sections.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test checks/sections.test`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify/checks/sections.ts scripts/verify/checks/sections.test.ts
git commit -m "feat(verify): add required-sections check"
```

---

## Task 5: Review-checklist shape check

**Files:**
- Create: `scripts/verify/checks/review-checklist.ts`
- Create: `scripts/verify/checks/review-checklist.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/verify/checks/review-checklist.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseSkill } from "../parse.js";
import { checkReviewChecklist } from "./review-checklist.js";

const FOUR_SECTION = `---
name: s
description: Use when X.
---

## Review checklist

### Summary
one line

### Findings
| file:line | severity | category | fix |
| - | - | - | - |

### Safer alternative
text

### Checklist coverage
- Rule 1: PASS
- Rule 2: CONCERN
- Rule 3: NOT APPLICABLE
`;

describe("checkReviewChecklist", () => {
  it("PASS when four sections present with sanctioned labels", () => {
    const skill = parseSkill("/fake/SKILL.md", FOUR_SECTION);
    const result = checkReviewChecklist(skill);
    expect(result.severity).toBe("PASS");
  });

  it("CONCERN when Safer alternative missing", () => {
    const body = FOUR_SECTION.replace(/### Safer alternative[\s\S]*?(?=###)/, "");
    const skill = parseSkill("/fake/SKILL.md", body);
    const result = checkReviewChecklist(skill);
    expect(result.severity).toBe("CONCERN");
  });

  it("CONCERN when non-sanctioned grading label used (e.g. BLOCKING)", () => {
    const body = FOUR_SECTION.replace("PASS", "BLOCKING");
    const skill = parseSkill("/fake/SKILL.md", body);
    const result = checkReviewChecklist(skill);
    expect(result.severity).toBe("CONCERN");
  });

  it("returns PASS if Review checklist section absent (handled by sections check)", () => {
    const body = FOUR_SECTION.replace(/## Review checklist[\s\S]*/, "");
    const skill = parseSkill("/fake/SKILL.md", body);
    const result = checkReviewChecklist(skill);
    expect(result.severity).toBe("PASS");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test checks/review-checklist.test`
Expected: FAIL, "Cannot find module './review-checklist.js'".

- [ ] **Step 3: Implement check**

Create `scripts/verify/checks/review-checklist.ts`:

```ts
import type { CheckResult, Finding, SkillFile } from "../types.js";

const SECTION_RE = /^##\s+Review checklist\b[\s\S]*?(?=^##\s|\Z)/m;
const SUBSECTIONS = ["Summary", "Findings", "Safer alternative", "Checklist coverage"];
const SANCTIONED_LABELS = ["PASS", "CONCERN", "NOT APPLICABLE"];
const FORBIDDEN_LABELS = ["BLOCKING", "COMPLETE", "INCOMPLETE", "LOW", "MED", "HIGH", "CRITICAL"];

export function checkReviewChecklist(skill: SkillFile): CheckResult {
  const findings: Finding[] = [];
  const match = skill.body.match(SECTION_RE);
  if (!match) {
    return { name: "review-checklist", severity: "PASS", findings };
  }
  const section = match[0];

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test checks/review-checklist.test`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify/checks/review-checklist.ts scripts/verify/checks/review-checklist.test.ts
git commit -m "feat(verify): add review-checklist shape check"
```

---

## Task 6: Handoff-markers check

**Files:**
- Create: `scripts/verify/checks/markers.ts`
- Create: `scripts/verify/checks/markers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/verify/checks/markers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseSkill } from "../parse.js";
import { checkMarkers } from "./markers.js";

function withInteractions(body: string) {
  return parseSkill("/fake/SKILL.md", `---\nname: s\ndescription: Use when X.\n---\n\n## Interactions with other skills\n${body}\n`);
}

describe("checkMarkers", () => {
  it("PASS when only sanctioned markers are used", () => {
    const skill = withInteractions("- **REQUIRED SUB-SKILL:** superpowers:tdd\n- **Hands off to:** foo:bar");
    const result = checkMarkers(skill);
    expect(result.severity).toBe("PASS");
  });

  it("CONCERN when prose handoff ('see X', 'use X') is used in Interactions", () => {
    const skill = withInteractions("- see superpowers:tdd for testing patterns");
    const result = checkMarkers(skill);
    expect(result.severity).toBe("CONCERN");
  });

  it("accepts 'REQUIRED BACKGROUND' and 'Does not duplicate' markers", () => {
    const skill = withInteractions("- **REQUIRED BACKGROUND:** superpowers:x\n- **Does not duplicate:** global-plugin:y");
    const result = checkMarkers(skill);
    expect(result.severity).toBe("PASS");
  });

  it("PASS when Interactions section is absent (handled by sections check)", () => {
    const skill = parseSkill("/fake/SKILL.md", "---\nname: s\ndescription: Use when X.\n---\n\nbody\n");
    const result = checkMarkers(skill);
    expect(result.severity).toBe("PASS");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test checks/markers.test`
Expected: FAIL, "Cannot find module './markers.js'".

- [ ] **Step 3: Implement check**

Create `scripts/verify/checks/markers.ts`:

```ts
import type { CheckResult, Finding, SkillFile } from "../types.js";

const INTERACTIONS_RE = /^##\s+Interactions with other skills\b[\s\S]*?(?=^##\s|\Z)/m;
const SANCTIONED = [
  /\*\*REQUIRED SUB-SKILL:\*\*/,
  /\*\*REQUIRED BACKGROUND:\*\*/,
  /\*\*Hands off to:\*\*/,
  /\*\*Does not duplicate:\*\*/,
];
const PROSE_PATTERNS = [
  { re: /\bsee\s+(?:superpowers:|global-plugin:)/i, label: "'see <skill>'" },
  { re: /\buse\s+(?:superpowers:|global-plugin:)/i, label: "'use <skill>'" },
  { re: /\bfeeds? from\s+(?:superpowers:|global-plugin:)/i, label: "'feeds from <skill>'" },
];

export function checkMarkers(skill: SkillFile): CheckResult {
  const findings: Finding[] = [];
  const match = skill.body.match(INTERACTIONS_RE);
  if (!match) return { name: "markers", severity: "PASS", findings };
  const section = match[0];

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test checks/markers.test`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify/checks/markers.ts scripts/verify/checks/markers.test.ts
git commit -m "feat(verify): add handoff-marker hygiene check"
```

---

## Task 7: Size-budget check

**Files:**
- Create: `scripts/verify/checks/size.ts`
- Create: `scripts/verify/checks/size.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/verify/checks/size.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { checkSize } from "./size.js";
import type { SkillFile } from "../types.js";

function withLines(n: number): SkillFile {
  const contents = Array(n).fill("x").join("\n");
  return { path: "/fake/SKILL.md", contents, frontmatter: {}, body: contents, lineCount: n };
}

describe("checkSize", () => {
  it("PASS under 400 lines", () => {
    expect(checkSize(withLines(200)).severity).toBe("PASS");
    expect(checkSize(withLines(399)).severity).toBe("PASS");
  });
  it("CONCERN between 400 and 499 lines", () => {
    expect(checkSize(withLines(400)).severity).toBe("CONCERN");
    expect(checkSize(withLines(499)).severity).toBe("CONCERN");
  });
  it("FAIL at 500+ lines", () => {
    expect(checkSize(withLines(500)).severity).toBe("FAIL");
    expect(checkSize(withLines(642)).severity).toBe("FAIL");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test checks/size.test`
Expected: FAIL, "Cannot find module './size.js'".

- [ ] **Step 3: Implement check**

Create `scripts/verify/checks/size.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test checks/size.test`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify/checks/size.ts scripts/verify/checks/size.test.ts
git commit -m "feat(verify): add size-budget check"
```

---

## Task 8: Discoverability score

**Files:**
- Create: `scripts/verify/checks/discoverability.ts`
- Create: `scripts/verify/checks/discoverability.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/verify/checks/discoverability.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseSkill } from "../parse.js";
import { checkDiscoverability } from "./discoverability.js";

function build(name: string, description: string) {
  return parseSkill("/fake/SKILL.md", `---\nname: ${name}\ndescription: ${description}\n---\n\nbody\n`);
}

describe("checkDiscoverability", () => {
  it("PASS for a strong generic description", () => {
    const skill = build("code-review-helper",
      "Use when reviewing a pull request for correctness, test coverage, and company conventions. TRIGGER when: user asks for code review. SKIP when: user wants security-specific review.");
    const result = checkDiscoverability(skill);
    expect(result.severity).toBe("PASS");
    expect((result as any).score).toBeGreaterThanOrEqual(70);
  });

  it("CONCERN for a weak description without trigger verbs", () => {
    const skill = build("x", "This skill helps with widgets and is useful sometimes.");
    const result = checkDiscoverability(skill);
    expect(result.severity).toBe("CONCERN");
  });

  it("FAIL for a very weak description", () => {
    const skill = build("x", "handles stuff");
    const result = checkDiscoverability(skill);
    expect(result.severity).toBe("FAIL");
  });

  it("CONCERN if stack-named skill does not mention the stack in description", () => {
    const skill = build("nextjs-app-structure-guard",
      "Use when reviewing an application structure to ensure conventions are followed across the project for maintainability.");
    const result = checkDiscoverability(skill);
    expect(result.severity).toBe("CONCERN");
    expect(result.findings.some((f) => f.message.includes("stack"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test checks/discoverability.test`
Expected: FAIL, "Cannot find module './discoverability.js'".

- [ ] **Step 3: Implement check**

Create `scripts/verify/checks/discoverability.ts`:

```ts
import type { CheckResult, Finding, SkillFile } from "../types.js";

const TRIGGER_VERBS = [
  "creating", "editing", "reviewing", "verifying", "debugging",
  "deploying", "refactoring", "auditing", "testing", "designing",
  "scaffolding", "validating", "analyzing", "implementing", "fixing",
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
  else findings.push({ line: 1, severity: "CONCERN", category: "discoverability", message: `description is ${desc.length} chars (target ≥100)`, fix: "Expand with concrete use cases" });

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

  const severity = score >= 70 ? "PASS" : score >= 50 ? "CONCERN" : "FAIL";
  if (severity === "FAIL" && !findings.some((f) => f.severity === "FAIL")) {
    findings.push({ line: 1, severity: "FAIL", category: "discoverability", message: `Discoverability score ${score}/100 (need ≥50 to pass, ≥70 for clean)`, fix: "Strengthen description: add 'Use when', trigger verb, stack/domain keywords" });
  }
  return { name: "discoverability", severity, findings, score };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test checks/discoverability.test`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify/checks/discoverability.ts scripts/verify/checks/discoverability.test.ts
git commit -m "feat(verify): add discoverability score check"
```

---

## Task 9: Orchestrator + CLI entrypoint

**Files:**
- Create: `scripts/verify/run.ts`
- Create: `scripts/verify-skill.ts`

- [ ] **Step 1: Write the orchestrator test**

Create `scripts/verify/run.test.ts`:

```ts
import { describe, it, expect } from "vitest";
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test verify/run.test`
Expected: FAIL, "Cannot find module './run.js'".

- [ ] **Step 3: Implement orchestrator**

Create `scripts/verify/run.ts`:

```ts
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
```

- [ ] **Step 4: Implement CLI entrypoint**

Create `scripts/verify-skill.ts`:

```ts
#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSkill } from "./verify/parse.js";
import { runChecks, formatReport } from "./verify/run.js";

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("usage: verify-skill <path-to-SKILL.md> [more paths...]");
    process.exit(2);
  }

  let anyRed = false;
  for (const arg of args) {
    const path = resolve(arg);
    const contents = readFileSync(path, "utf8");
    const skill = parseSkill(path, contents);
    const result = runChecks(skill);
    const name =
      typeof skill.frontmatter?.name === "string"
        ? (skill.frontmatter.name as string)
        : path;
    console.log(formatReport(name, result));
    console.log("");
    if (result.verdict === "RED") anyRed = true;
  }
  process.exit(anyRed ? 1 : 0);
}

main();
```

- [ ] **Step 5: Run orchestrator tests**

Run: `pnpm test verify/run.test`
Expected: 5 tests pass.

- [ ] **Step 6: Smoke-test CLI on an existing GREEN skill**

Run: `pnpm verify skills/_baseline/SKILL.md`
Expected: prints a report with `Verdict: GREEN` and exits 0.

- [ ] **Step 7: Commit**

```bash
git add scripts/verify/run.ts scripts/verify/run.test.ts scripts/verify-skill.ts
git commit -m "feat(verify): add orchestrator + CLI entrypoint"
```

---

## Task 10: Fixtures + end-to-end test

**Files:**
- Create: `scripts/fixtures/good-skill/SKILL.md`
- Create: `scripts/fixtures/bad-weak-description/SKILL.md`
- Create: `scripts/fixtures/bad-no-interactions/SKILL.md`
- Create: `scripts/fixtures/bad-prose-handoff/SKILL.md`
- Create: `scripts/fixtures/bad-oversize/SKILL.md`

- [ ] **Step 1: Write the E2E test**

Append to `scripts/verify/run.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
```

- [ ] **Step 2: Create `good-skill` fixture**

Create `scripts/fixtures/good-skill/SKILL.md`:

```markdown
---
name: good-skill
description: Use when reviewing a component for correctness, accessibility, and regression risks in the frontend. TRIGGER when: user asks for component review. SKIP when: user wants security-only review.
---

# Good Skill

## Core rules
1. Rule one.

## Red flags
- Flag one.

## Review checklist

### Summary
One-line summary.

### Findings
| file:line | severity | category | fix |
| - | - | - | - |

### Safer alternative
alt.

### Checklist coverage
- Rule one: PASS

## Interactions with other skills
- **REQUIRED BACKGROUND:** superpowers:brainstorming
- **Hands off to:** global-plugin:skill-verification
```

- [ ] **Step 3: Create `bad-weak-description` fixture**

Create `scripts/fixtures/bad-weak-description/SKILL.md`:

```markdown
---
name: bad-weak
description: handles stuff
---

## Core rules
- rule

## Red flags
- flag

## Review checklist

### Summary
x

### Findings
x

### Safer alternative
x

### Checklist coverage
- rule: PASS

## Interactions with other skills
- **Hands off to:** global-plugin:skill-verification
```

- [ ] **Step 4: Create `bad-no-interactions` fixture**

Create `scripts/fixtures/bad-no-interactions/SKILL.md`:

```markdown
---
name: bad-no-interactions
description: Use when reviewing a component thoroughly for correctness, accessibility, and regression risks in the frontend codebase.
---

## Core rules
- rule

## Red flags
- flag

## Review checklist
body
```

- [ ] **Step 5: Create `bad-prose-handoff` fixture**

Create `scripts/fixtures/bad-prose-handoff/SKILL.md`:

```markdown
---
name: bad-prose-handoff
description: Use when reviewing a component thoroughly for correctness, accessibility, and regression risks in the frontend codebase.
---

## Core rules
- rule

## Red flags
- flag

## Review checklist

### Summary
x

### Findings
x

### Safer alternative
x

### Checklist coverage
- rule: PASS

## Interactions with other skills
- see superpowers:brainstorming for context
```

- [ ] **Step 6: Create `bad-oversize` fixture**

Create `scripts/fixtures/bad-oversize/SKILL.md` with ≥520 lines. Use a header plus 500 filler lines:

```bash
{
  cat <<'EOF'
---
name: bad-oversize
description: Use when reviewing a component thoroughly for correctness, accessibility, and regression risks in the frontend codebase.
---

## Core rules
- rule

## Red flags
- flag

## Review checklist

### Summary
x

### Findings
x

### Safer alternative
x

### Checklist coverage
- rule: PASS

## Interactions with other skills
- **Hands off to:** global-plugin:skill-verification

EOF
  for i in $(seq 1 500); do echo "filler line $i"; done
} > scripts/fixtures/bad-oversize/SKILL.md
```

- [ ] **Step 7: Run the E2E tests**

Run: `pnpm test verify/run.test`
Expected: all 10 tests pass (5 unit + 5 fixture).

- [ ] **Step 8: Commit**

```bash
git add scripts/fixtures/ scripts/verify/run.test.ts
git commit -m "test(verify): add E2E fixtures covering each check's failure mode"
```

---

## Task 11: Pre-commit hook

**Files:**
- Create: `.husky/pre-commit`

- [ ] **Step 1: Initialize husky**

Run: `pnpm dlx husky init`
Expected: creates `.husky/pre-commit` with a sample. `pnpm prepare` script runs automatically.

- [ ] **Step 2: Replace the generated hook**

Overwrite `.husky/pre-commit`:

```bash
#!/usr/bin/env bash
set -e

staged=$(git diff --cached --name-only --diff-filter=ACM | grep -E '^skills/[^/]+/SKILL\.md$' || true)
[ -z "$staged" ] && exit 0

echo "→ skill-verification (fast mode) on staged SKILL.md files"
pnpm verify $staged
```

- [ ] **Step 3: Make it executable (Unix)**

Run: `chmod +x .husky/pre-commit`
Expected: no output. (Git on Windows + pnpm prepare handles this automatically; the chmod is a no-op there.)

- [ ] **Step 4: Test hook with a fake RED commit**

Create a temporary bad skill, stage it, attempt commit:

```bash
mkdir -p skills/__tmp_bad
cp scripts/fixtures/bad-no-interactions/SKILL.md skills/__tmp_bad/SKILL.md
git add skills/__tmp_bad/SKILL.md
git commit -m "test: should block" || echo "commit blocked as expected"
```

Expected: commit blocked; hook printed findings. Exit status of `git commit` is non-zero.

- [ ] **Step 5: Clean up the test artifact**

```bash
git restore --staged skills/__tmp_bad/SKILL.md
rm -rf skills/__tmp_bad
```

- [ ] **Step 6: Test hook passes for a GREEN commit**

Stage the `good-skill` fixture by temporarily placing it under `skills/`:

```bash
mkdir -p skills/__tmp_good
cp scripts/fixtures/good-skill/SKILL.md skills/__tmp_good/SKILL.md
git add skills/__tmp_good/SKILL.md
git commit -m "test: should pass"
```

Expected: commit succeeds.

Then revert the commit and clean up:

```bash
git reset --soft HEAD~1
git restore --staged skills/__tmp_good/SKILL.md
rm -rf skills/__tmp_good
```

- [ ] **Step 7: Commit the hook**

```bash
git add .husky/pre-commit package.json
git commit -m "feat: add skill-verification pre-commit hook"
```

---

## Task 12: Author `skill-authoring` SKILL.md

**Files:**
- Create: `skills/skill-authoring/SKILL.md`

- [ ] **Step 1: Write the SKILL.md**

Create `skills/skill-authoring/SKILL.md`:

````markdown
---
name: skill-authoring
description: Use when creating a new skill, editing an existing skill, or scaffolding a skill from an idea. Enforces company conventions on top of superpowers:writing-skills — four-section Review checklist, sanctioned handoff markers, size targets (200–400 lines), and discoverability requirements (strong description field with trigger signals, stack naming).
---

# skill-authoring

Wraps `superpowers:writing-skills` with company conventions for the `global-plugin`.

## When to use
- Creating a new skill in `skills/<name>/SKILL.md`
- Editing an existing skill's structure or metadata
- Scaffolding a skill from a brainstorm output

## Core rules

1. **Description MUST have trigger signals.** Start with `Use when ...`. Add `TRIGGER when:` / `SKIP when:` for sharp discrimination. No vague verbs ("handles", "manages", "deals with").
2. **Interactions section is mandatory.** Every skill declares at least one `**REQUIRED BACKGROUND:**`, `**REQUIRED SUB-SKILL:**`, `**Hands off to:**`, or `**Does not duplicate:**` tying it into the superpowers or global-plugin graph.
3. **Review checklist uses the four-section shape.** Sections: `Summary`, `Findings` (table: file:line, severity, category, fix), `Safer alternative`, `Checklist coverage` (labels: `PASS / CONCERN / NOT APPLICABLE`).
4. **Size budget.** 200–400 lines preferred, 500 hard ceiling. Over → split.
5. **Stack-relevant triggers.** Stack-specific skills (Next.js, NestJS, Prisma, AWS, React Native) name the stack in the description so Claude can match against user prompts.
6. **No duplicated primitives.** Use `**REQUIRED SUB-SKILL:**` or `**Does not duplicate:**` instead of re-implementing superpowers skills.

## Red flags

- Description starts with "This skill…" (declarative, not trigger-based)
- No Interactions section
- Flat checkbox Review checklist instead of four-section shape
- Prose handoff references ("see X", "use X", "feeds from X")
- Vague description verbs
- Size > 500 lines

## Authoring flow

1. Run `superpowers:brainstorming` to pin down the skill's purpose and attach point.
2. Follow `superpowers:writing-skills` for file layout and metadata.
3. Apply company conventions from the Core rules above.
4. Hand off to `global-plugin:skill-verification` before committing.

## Good vs bad

### description field

Bad: `description: Handles frontend architecture concerns.`

Good: `description: Use when reviewing or scaffolding a Next.js App Router structure for route organization, layout boundaries, and server/client component placement. TRIGGER when: user edits files under app/. SKIP when: Pages Router is in use.`

### Interactions

Bad:
```
## Interactions with other skills
- see superpowers:tdd for testing
```

Good:
```
## Interactions with other skills
- **REQUIRED SUB-SKILL:** superpowers:test-driven-development
- **Hands off to:** global-plugin:skill-verification
```

## Review checklist

### Summary
One paragraph on whether the authored skill meets company conventions.

### Findings
| file:line | severity | category | fix |
| - | - | - | - |

### Safer alternative
If the skill re-implements a superpowers primitive, replace with a sub-skill marker.

### Checklist coverage
- Rule 1 (description trigger signals): PASS / CONCERN / NOT APPLICABLE
- Rule 2 (Interactions section): PASS / CONCERN / NOT APPLICABLE
- Rule 3 (Review checklist shape): PASS / CONCERN / NOT APPLICABLE
- Rule 4 (size budget): PASS / CONCERN / NOT APPLICABLE
- Rule 5 (stack-relevant triggers): PASS / CONCERN / NOT APPLICABLE
- Rule 6 (no duplicated primitives): PASS / CONCERN / NOT APPLICABLE

## Interactions with other skills
- **REQUIRED SUB-SKILL:** superpowers:writing-skills
- **REQUIRED BACKGROUND:** superpowers:brainstorming
- **REQUIRED BACKGROUND:** agent-development
- **Hands off to:** global-plugin:skill-verification
````

- [ ] **Step 2: Self-verify**

Run: `pnpm verify skills/skill-authoring/SKILL.md`
Expected: `Verdict: GREEN`.

- [ ] **Step 3: Commit**

```bash
git add skills/skill-authoring/SKILL.md
git commit -m "feat(skill): add skill-authoring"
```

---

## Task 13: Author `skill-verification` SKILL.md

**Files:**
- Create: `skills/skill-verification/SKILL.md`

- [ ] **Step 1: Write the SKILL.md**

Create `skills/skill-verification/SKILL.md`:

````markdown
---
name: skill-verification
description: Use when verifying a skill before commit, reviewing an existing skill's compliance, or auditing skill discoverability. Runs authoring-guide compliance, handoff-marker hygiene, description-quality scoring, Review-checklist shape check, and (on-demand) the 7-check C1–C7 workflow-compatibility audit. Returns GREEN/YELLOW/RED verdict with findings.
---

# skill-verification

Verifies a skill meets company + superpowers standards. Fast mode runs statically (pre-commit hook). Full mode adds the 7-check C1–C7 workflow-compatibility audit via subagent dispatch.

## Modes

| Mode | Trigger | Checks | Cost |
|---|---|---|---|
| Fast | Auto (pre-commit hook) or manual for one skill | Static (frontmatter, sections, checklist shape, markers, size, discoverability) | <5s |
| Full | Manual invocation only | Fast checks + 7-check C1–C7 audit, optional dynamic pressure test | Minutes, subagent dispatch |

## How to run

**Fast mode (CLI):**

```bash
pnpm verify skills/<name>/SKILL.md
```

Exit 0 = GREEN. Exit 1 = RED. stdout includes YELLOW findings.

**Full mode (Claude-driven):**

When invoked from a Claude session, dispatch a subagent using the audit template at `docs/superpowers/testing-skills-against-workflows.md`. Provide the skill's path; subagent returns a 7-check verdict table.

## Core rules

1. **Fast-mode check set is fixed.** frontmatter, sections, review-checklist, markers, size, discoverability. Changing the set is a versioning event.
2. **Verdict mapping is fixed.** Any FAIL → RED. Any CONCERN (no FAIL) → YELLOW. All PASS → GREEN.
3. **Never silently pass RED.** If the hook is misbehaving, fix the hook — do not bypass.
4. **Full mode is manual only.** Subagent dispatch is expensive; do not run it in a pre-commit hook.
5. **Do not duplicate the 7-check audit.** Delegate to `docs/superpowers/testing-skills-against-workflows.md`.

## Red flags

- Marking a check as PASS when findings exist
- Running full mode in pre-commit
- Re-implementing the 7-check audit inline
- Adding "skip if" escape hatches to the hook
- Changing thresholds without updating the spec

## Good vs bad

### Fast-mode output

Bad: `LGTM 👍`

Good:
```
Verification: my-skill
Mode: fast
Verdict: YELLOW

Checklist coverage
- frontmatter: PASS
- sections: PASS
- review-checklist: CONCERN
- markers: PASS
- size: PASS
- discoverability: PASS

Findings
- [CONCERN] review-checklist: non-sanctioned label 'CRITICAL'
    fix: Use only: PASS, CONCERN, NOT APPLICABLE
```

## Review checklist

### Summary
One paragraph on whether `skill-verification` itself operates to spec.

### Findings
| file:line | severity | category | fix |
| - | - | - | - |

### Safer alternative
If the full-mode audit is slow or flaky, run fast-mode only and schedule the 7-check audit separately.

### Checklist coverage
- Rule 1 (fixed check set): PASS / CONCERN / NOT APPLICABLE
- Rule 2 (verdict mapping): PASS / CONCERN / NOT APPLICABLE
- Rule 3 (no silent pass): PASS / CONCERN / NOT APPLICABLE
- Rule 4 (full mode manual): PASS / CONCERN / NOT APPLICABLE
- Rule 5 (no audit duplication): PASS / CONCERN / NOT APPLICABLE

## Interactions with other skills
- **REQUIRED BACKGROUND:** superpowers:writing-skills
- **Does not duplicate:** superpowers:requesting-code-review
- **Hands off to:** superpowers:writing-plans
````

- [ ] **Step 2: Self-verify**

Run: `pnpm verify skills/skill-verification/SKILL.md`
Expected: `Verdict: GREEN`.

- [ ] **Step 3: Commit**

```bash
git add skills/skill-verification/SKILL.md
git commit -m "feat(skill): add skill-verification"
```

---

## Task 14: Verify the plugin's plugin.json and bump version

**Files:**
- Modify: `.claude-plugin/plugin.json`

- [ ] **Step 1: Bump version**

Edit `.claude-plugin/plugin.json` — change `"version": "0.2.2"` to `"version": "0.3.0"` (minor bump: two new skills added).

- [ ] **Step 2: Verify all skills with one command**

Run:
```bash
pnpm verify skills/*/SKILL.md
```
Expected: all 28 skills (26 existing + 2 new) print reports. At least the 2 new skills GREEN. Some of the 26 existing may be YELLOW on discoverability — that's the follow-up cycle; acknowledge and proceed.

- [ ] **Step 3: Commit**

```bash
git add .claude-plugin/plugin.json
git commit -m "chore: bump version to 0.3.0 for new skill-authoring + skill-verification"
```

---

## Task 15: Smoke test — install plugin on a fresh project

**Files:**
- None (user action)

- [ ] **Step 1: Reinstall plugin in a fresh directory**

Outside this repo, in a fresh test project:

```bash
claude plugin install /path/to/global-plugin
claude plugin enable global-plugin
```

Restart Claude Code session.

- [ ] **Step 2: Verify discovery**

In a fresh Claude Code session, type a prompt such as: "I want to review the Next.js App Router structure of this project." Expected: Claude surfaces `global-plugin:nextjs-app-structure-guard` (or proposes invoking it) — confirming discoverability works.

- [ ] **Step 3: Verify authoring flow**

Type: "I want to create a new skill for reviewing GraphQL schemas." Expected: Claude surfaces `global-plugin:skill-authoring`.

- [ ] **Step 4: Record findings**

Note any skills that did NOT surface when expected; these are the candidates for the discoverability follow-up audit (task 16).

**No commit** — this is an external validation step.

---

## Task 16: Follow-up — discoverability audit of 26 existing skills

**Files:**
- Create: `docs/superpowers/audits/YYYY-MM-DD/discoverability/SUMMARY.md`
- Modify: 26 skill descriptions as needed

This task is out-of-scope for the current plan's acceptance criteria — it's a separate cycle per spec §12. Execute as a follow-up plan after Tasks 1–15 land. Process:

1. Run `pnpm verify skills/*/SKILL.md` and collect discoverability scores.
2. For each skill scoring <70, dispatch a subagent to propose a stronger description preserving the existing behaviour.
3. Land descriptions in a batch commit. Re-verify.

Write this up as its own plan document when ready.

---

## Self-review notes

- **Spec coverage:** All 12 spec sections have at least one task.
  - §1 Background → context only.
  - §2 Problem statement → context only.
  - §3 Approach → locked in tasks 9, 12, 13.
  - §4 Locked decisions → tasks 1, 11, 13.
  - §5 skill-authoring → task 12.
  - §6 skill-verification → tasks 3–9 (static) + task 13 (skill wrapping full mode).
  - §7 Pre-commit hook → task 11.
  - §8 File layout → matches File Structure section above.
  - §9 Acceptance criteria → tasks 12, 13, 11, 14, 15, 16.
  - §10 Out of scope → respected (no plugin-disable fix; no PostToolUse hook; no dashboard).
  - §11 Risks → §11.1 resolved by making the script the enforcer (tasks 1–10) instead of `claude skill run`.
  - §12 Follow-ups → task 16 (discoverability) + noted in task 15.
- **Placeholders:** None. Every step has code or an exact command.
- **Type consistency:** `CheckResult`, `SkillFile`, `Finding`, `Verdict`, `Severity` defined in `types.ts` (task 1), used consistently throughout.
- **Risks still open:**
  - `pnpm dlx husky init` in task 11 assumes Husky v9 behaviour; if it fails, fall back to writing `.husky/pre-commit` by hand and running `git config core.hooksPath .husky`.
  - Fixture `bad-oversize` uses a shell heredoc; on Windows, run via Git Bash (already available in this environment).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-24-skill-authoring-and-verification.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
