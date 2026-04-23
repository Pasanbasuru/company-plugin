# Superpowers Workflow Compatibility — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **This session's twist:** no commits. User will commit every artifact manually after review. Replace every "commit" step in the standard TDD pattern with a "verify artifact" step.

**Goal:** Produce an audited + company-extended workflow reference, a gitignored skills-categorization scratchpad, a workflow-compatibility test template, and per-skill audit reports for all 26 skills.

**Architecture:** Preserve-and-extend (Approach B) — layer 1 is a strict transcription of superpowers 5.0.7 diagrams; layer 2 shows where company-plugin skills attach. Parallel subagent fan-out for diagram audits (4 agents) and skill audits (26 agents). Everything else written inline.

**Tech Stack:** Markdown, Mermaid (inline in markdown), text files, `.gitignore`. No code beyond shell for verification.

---

## Task 1: Safety net — gitignore uncommitted artifacts

**Files:**
- Create/modify: `.gitignore`

- [ ] **Step 1: Check whether `.gitignore` exists**

Run: `ls -la "C:/Home/Basuru/Solto/company-plugin/.gitignore"`
Expected: "No such file" or a file listing.

- [ ] **Step 2: Write `.gitignore` with reference/working-file entries**

Content (if file does not exist — otherwise merge):

```
# Reference-only files (superpowers.md paste)
superpowers.md

# Local-only categorization scratchpad
skills-categorization.txt

# Accidental shell crash dumps
bash.exe.stackdump
```

- [ ] **Step 3: Verify `git status` reflects the ignore**

Run: `cd "C:/Home/Basuru/Solto/company-plugin" && git status --short`
Expected: `superpowers.md` no longer appears as `??`. `bash.exe.stackdump` no longer appears. (The `.gitignore` itself appears as `??` — that's expected, the user commits it later.)

---

## Task 2: Parallel diagram audit — dispatch 4 subagents

**Files:** none yet (subagents return summaries; corrections applied in Task 3).

- [ ] **Step 1: Dispatch all 4 audit agents in a single message**

Each agent audits 2 diagrams from `superpowers.md` against the superpowers 5.0.7 source at `C:/Users/basuru/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.7/`.

Agent prompt template (filled per diagram pair):

> Audit Diagrams <N1> and <N2> in `C:/Home/Basuru/Solto/company-plugin/superpowers.md` against the actual superpowers 5.0.7 source at `C:/Users/basuru/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.7/`.
>
> For each diagram, verify:
> 1. Every labelled `skill`/`agent`/`hook`/`artifact` node exists in the source (give path).
> 2. Every arrow claim is justified by the source (quote or cite line).
> 3. Every decision-diamond text matches a real branch in the source.
> 4. Every Iron Law hexagon text is a direct quote or accurate paraphrase.
> 5. (Diagram 1 only) Hook chain `hooks/hooks.json → run-hook.cmd → session-start → using-superpowers` is intact.
> 6. (Diagram 4 only) `implementer-prompt.md`, `spec-reviewer-prompt.md`, `code-quality-reviewer-prompt.md` exist at claimed paths.
>
> Return: for each diagram, verdict (PASS or CORRECTIONS NEEDED), and a concrete diff list (node X should be renamed to Y / edge A→B should be A→C because…). Do NOT rewrite the diagram — list corrections only. Under 400 words total.

Dispatch assignments:
- Agent 1: Diagrams 1 + 2
- Agent 2: Diagrams 3 + 4
- Agent 3: Diagrams 5 + 6
- Agent 4: Diagrams 7 + 8

- [ ] **Step 2: Collect verdicts + diffs**

Record each agent's diff list in working memory. These feed Task 3-11.

- [ ] **Step 3: Verify**

Check that every diagram has either a PASS verdict or a concrete diff list. If any diagram returned an ambiguous verdict, re-dispatch that one agent with a clearer brief.

---

## Task 3: Write `docs/superpowers/workflows/README.md`

**Files:**
- Create: `docs/superpowers/workflows/README.md`

- [ ] **Step 1: Write the README**

Structure:

```markdown
# Superpowers Workflows — as they run with company-plugin loaded

Source of truth: superpowers v5.0.7 at
`C:/Users/basuru/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.7/`.
Diagrams here are audited against that source (see docs/superpowers/specs/2026-04-22-superpowers-workflow-compatibility-design.md).

## How to read a workflow file

Each file has:
- **Layer 1 — superpowers core flow** (nodes coloured `extPlugin` / amber).
- **Layer 2 — where company-plugin skills attach** (company nodes coloured `companyPlugin` / teal). Absent when no company-plugin skill applies.
- **Compatibility notes** — what a new skill attached to this workflow must not do.

## Shape legend

| Shape          | Type       | Mermaid syntax |
|----------------|------------|----------------|
| Stadium        | hook       | `([…])`        |
| Hexagon        | rule       | `{{…}}`        |
| Rectangle      | skill      | `[…]`          |
| Double-rect    | agent      | `[[…]]`        |
| Diamond        | gate       | `{…}`          |
| Cylinder       | artifact   | `[(…)]`        |

## Origin legend

| Class          | Meaning                                  | Colour          |
|----------------|------------------------------------------|-----------------|
| `extPlugin`    | Ships from superpowers or other external | amber `#785f28` |
| `companyPlugin`| Ships from this company-plugin           | teal  `#1f5a5b` |
| (none)         | Narrative / state / user action          | plain           |

## File index

| # | Workflow                              | File                            | Has layer 2? |
|---|---------------------------------------|---------------------------------|--------------|
| 1 | Universal entry — any prompt arrives  | `01-universal-entry.md`         | no           |
| 2 | Creative work — build / add / create  | `02-creative-work.md`           | yes          |
| 3 | Bug path — crash / failure / regression| `03-bug-path.md`               | yes          |
| 4 | Subagent execution loop               | `04-subagent-execution.md`      | yes (guardrail cluster) |
| 5 | Parallel agents                       | `05-parallel-agents.md`         | minimal      |
| 6 | Review loop                           | `06-review-loop.md`             | yes          |
| 7 | Writing / testing a skill             | `07-writing-skills.md`          | yes (compatibility test hook) |
| 8 | The whole map                         | `08-whole-map.md`               | yes          |

## Cheat sheet — "given a prompt, what fires?"

(Reproduce the table from superpowers.md here, updated with company-plugin layer where relevant.)
```

- [ ] **Step 2: Verify**

Run: `ls -la "C:/Home/Basuru/Solto/company-plugin/docs/superpowers/workflows/README.md"`
Expected: File exists, non-empty.

---

## Tasks 4–11: Write the 8 per-workflow files

Each of these tasks follows the same shape. The template is spelled out once in Task 4 and referenced in 5–11 with the diagram swapped in.

### Task 4: `01-universal-entry.md`

**Files:**
- Create: `docs/superpowers/workflows/01-universal-entry.md`

- [ ] **Step 1: Write the file**

Template:

````markdown
# Workflow 1 — Universal entry: what happens the moment any prompt arrives

**Trigger shape:** every prompt, no exceptions.

## Diagram (superpowers core)

```mermaid
%%{init: {'theme':'dark','themeVariables':{'fontSize':'11px'},'flowchart':{'nodeSpacing':20,'rankSpacing':26,'padding':4,'diagramPadding':4}}}%%
flowchart TD
    classDef extPlugin     fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef companyPlugin fill:#1f5a5bd9,stroke:#4fb0b2,stroke-width:1.25px,color:#dff3f4
    classDef hook     fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef rule     fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef skill    fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef agent    fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef gate     fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
    classDef artifact fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5

    <<insert audited diagram 1 from superpowers.md, applying corrections from Task 2>>

    <<class assignments — every ext node also gets `,extPlugin`>>
```

## Key gates and Iron Laws

- `SessionStart` hook pre-loads `using-superpowers` into every session.
- **1% rule:** if any skill might apply, invoke it — even on a simple question.
- Priority: user instructions > superpowers skills > default system prompt.

## No layer 2

No company-plugin skill attaches here — this workflow is entirely about the harness injecting the `using-superpowers` gate. Company-plugin skills live downstream and are reached through Workflows 2, 3, 4, 6, 7.

## Compatibility notes for new skills

- A new skill must not add a `SessionStart`-style injection that competes with `using-superpowers`.
- A new skill must not alter the 1%-rule gate; it can only sit downstream of it.
````

- [ ] **Step 2: Verify**

Check file exists, mermaid block is intact, origin legend respected.

### Task 5: `02-creative-work.md` (with layer 2)

**Files:**
- Create: `docs/superpowers/workflows/02-creative-work.md`

- [ ] **Step 1: Write the file**

Layer 1: audited Diagram 2 from superpowers.md.

Layer 2 — company-plugin attach points:

- During `brainstorming` design review: `architecture-guard` (when the design spans modules), `nextjs-app-structure-guard` (for frontend-only designs), `nestjs-service-boundary-guard` (for backend-only designs), `frontend-implementation-guard` (component structure), `mobile-implementation-guard` (RN).
- During `writing-plans`: data-layer skills (`prisma-data-access-guard`, `state-integrity-check`), integration skills (`integration-contract-safety`, `queue-and-retry-safety`, `resilience-and-error-handling`), security skills (`auth-and-permissions-safety`, `secrets-and-config-safety`).
- During implementation inside `subagent-driven-development` / `executing-plans`: `typescript-rigor` (always), `accessibility-guard` (any UI), `performance-budget-guard` (any UI or DB-touching), `test-strategy-enforcement` (while writing tests), `coverage-gap-detection` (before finishing).
- During `finishing-a-development-branch`: `change-risk-evaluation` (entry point), `regression-risk-check`, `rollback-planning`, `infra-safe-change` (if IaC touched), `aws-deploy-safety` (if deploy touched), `cicd-pipeline-safety` (if workflow files touched), `supply-chain-and-dependencies` (if deps added/updated).

Layer 2 diagram: reproduce Layer 1 structure, add `companyPlugin` nodes next to the phase they attach to, with labels indicating mode (guide / review).

Compatibility notes:

- Do NOT short-circuit the HARD-GATE between `brainstorming` and code. A guard skill must remain advisory inside design phase, not jump to producing code.
- Do NOT duplicate `test-driven-development` — reference it via `REQUIRED SUB-SKILL:`.
- Review-mode output from these skills feeds `code-reviewer` (Workflow 6), not each other.

- [ ] **Step 2: Verify**

### Task 6: `03-bug-path.md` (with layer 2)

**Files:**
- Create: `docs/superpowers/workflows/03-bug-path.md`

- [ ] **Step 1: Write the file**

Layer 1: audited Diagram 3.

Layer 2 — attach points:

- **Phase 1 (Root Cause):** `observability-first-debugging` — primary attach. Must honour `systematic-debugging`'s "no fixes without root cause" Iron Law; adds the "logs/metrics/traces first" domain rule.
- **Phase 4 (Implementation):** whichever domain guard matches the bug area (e.g., `prisma-data-access-guard` for query bug, `auth-and-permissions-safety` for authz bug).

Compatibility notes:

- A new skill here must not weaken the "3+ failures → question architecture" escape hatch.
- Must not bypass the `verification-before-completion` exit gate.

- [ ] **Step 2: Verify**

### Task 7: `04-subagent-execution.md` (with layer 2 guardrail cluster)

**Files:**
- Create: `docs/superpowers/workflows/04-subagent-execution.md`

- [ ] **Step 1: Write the file**

Layer 1: audited Diagram 4.

Layer 2: the guardrail cluster — `typescript-rigor`, `accessibility-guard`, `performance-budget-guard`, `auth-and-permissions-safety`, `secrets-and-config-safety`, `prisma-data-access-guard`, etc. All apply *inside* the Implementer subagent's context, as invisible-to-controller rules. Layer 2 shows this as a bounded cluster labelled "Implementer subagent guardrails (guide mode)".

Compatibility notes:

- These skills fire inside the subagent — controller must never read them.
- Any new skill that should apply during subagent execution must be addable to the guardrail cluster without changing the subagent prompt templates.

- [ ] **Step 2: Verify**

### Task 8: `05-parallel-agents.md` (minimal layer 2)

**Files:**
- Create: `docs/superpowers/workflows/05-parallel-agents.md`

- [ ] **Step 1: Write the file**

Layer 1: audited Diagram 5.

Layer 2 (minimal): per-agent guardrails apply inside each parallel agent's narrow scope. Note that `regression-risk-check` may also run after the final green verification to validate no cross-parallel conflict created regression.

- [ ] **Step 2: Verify**

### Task 9: `06-review-loop.md` (with layer 2)

**Files:**
- Create: `docs/superpowers/workflows/06-review-loop.md`

- [ ] **Step 1: Write the file**

Layer 1: audited Diagram 6.

Layer 2:

- Alongside `code-reviewer` agent (dispatched from `requesting-code-review`), the following company-plugin skills may run in parallel to produce domain-risk reports:
  - `regression-risk-check` — changed-surface blast radius
  - `change-risk-evaluation` — overall risk posture
- The `code-reviewer` owns plan alignment. The company-plugin review skills own domain risk. Their outputs sit alongside, not on top.

Compatibility notes:

- Review-mode report shape must match the `## Review checklist` prescribed in `docs/superpowers/skill-authoring-guide.md` so the consolidated output is parseable.
- Do NOT perform implementation actions during review mode — read-only tools only.

- [ ] **Step 2: Verify**

### Task 10: `07-writing-skills.md` (with layer 2)

**Files:**
- Create: `docs/superpowers/workflows/07-writing-skills.md`

- [ ] **Step 1: Write the file**

Layer 1: audited Diagram 7.

Layer 2: **company-plugin compatibility test hook** — after the superpowers GREEN phase (agents comply with the new skill under pressure), add a step: "Run `docs/superpowers/testing-skills-against-workflows.md` — the 7-check audit — against every workflow file in `docs/superpowers/workflows/`. Produce a report. A new company-plugin skill cannot be committed until every check is PASS or documented N/A."

Compatibility notes:

- The compatibility audit is additive — it runs AFTER superpowers' pressure tests pass. It does not replace them.

- [ ] **Step 2: Verify**

### Task 11: `08-whole-map.md` (layered)

**Files:**
- Create: `docs/superpowers/workflows/08-whole-map.md`

- [ ] **Step 1: Write the file**

Layer 1: audited Diagram 8 (the whole map), every superpowers node with `extPlugin`.

Layer 2: same map, annotated with company-plugin skills as a side cluster, lines drawn to the workflow phases they attach to.

- [ ] **Step 2: Verify**

---

## Task 12: Skills categorization scratchpad

**Files:**
- Create: `skills-categorization.txt` (repo root, gitignored per Task 1)

- [ ] **Step 1: Write the file**

Plain text, scannable, covers all 26 skills. Structure:

```
SKILLS CATEGORIZATION — company-plugin
Date: 2026-04-22
Purpose: scannable index for Basuru. Not committed.

================================================================
SECTION A — By what the skill protects (semantic grouping)
================================================================

[Architecture & structure]  5 skills
  - architecture-guard
  - nextjs-app-structure-guard
  - nestjs-service-boundary-guard
  - frontend-implementation-guard
  - mobile-implementation-guard

[Data]  2 skills
  - prisma-data-access-guard
  - state-integrity-check

[Integration & async]  3 skills
  - integration-contract-safety
  - queue-and-retry-safety
  - resilience-and-error-handling

[Security & config]  2 skills
  - auth-and-permissions-safety
  - secrets-and-config-safety

[Quality]  3 skills
  - test-strategy-enforcement
  - coverage-gap-detection
  - regression-risk-check

[Frontend quality]  2 skills
  - accessibility-guard
  - performance-budget-guard

[Language rigor]  1 skill
  - typescript-rigor

[Ops & risk]  7 skills
  - change-risk-evaluation
  - rollback-planning
  - infra-safe-change
  - aws-deploy-safety
  - cicd-pipeline-safety
  - supply-chain-and-dependencies
  - observability-first-debugging

[Shared foundation]  1 skill
  - _baseline

================================================================
SECTION B — By when to invoke (workflow attach points)
================================================================

[During brainstorming / design review]
  architecture-guard, nextjs-app-structure-guard,
  nestjs-service-boundary-guard, frontend-implementation-guard,
  mobile-implementation-guard

[During writing-plans / structure layout]
  prisma-data-access-guard, state-integrity-check,
  integration-contract-safety, queue-and-retry-safety,
  resilience-and-error-handling, auth-and-permissions-safety,
  secrets-and-config-safety

[During implementation — always]
  typescript-rigor

[During implementation — if UI]
  accessibility-guard, performance-budget-guard,
  frontend-implementation-guard

[During test writing]
  test-strategy-enforcement, coverage-gap-detection

[During finishing-a-development-branch]
  change-risk-evaluation, regression-risk-check,
  rollback-planning, infra-safe-change, aws-deploy-safety,
  cicd-pipeline-safety, supply-chain-and-dependencies

[During bug path / systematic-debugging]
  observability-first-debugging

================================================================
SECTION C — By scope of impact
================================================================

[App-wide / cross-module]
  architecture-guard, typescript-rigor, _baseline,
  change-risk-evaluation, rollback-planning, infra-safe-change,
  aws-deploy-safety, cicd-pipeline-safety,
  supply-chain-and-dependencies, observability-first-debugging

[Per-module / feature]
  nextjs-app-structure-guard, nestjs-service-boundary-guard,
  frontend-implementation-guard, mobile-implementation-guard,
  prisma-data-access-guard, state-integrity-check,
  integration-contract-safety, queue-and-retry-safety,
  resilience-and-error-handling, auth-and-permissions-safety,
  secrets-and-config-safety, accessibility-guard,
  performance-budget-guard, test-strategy-enforcement,
  coverage-gap-detection, regression-risk-check

================================================================
SECTION D — Where each skill attaches to superpowers workflows
================================================================

(Format: skill | workflows | mode)

_baseline                       | foundation for all | guide
architecture-guard              | 02                 | guide + review
nextjs-app-structure-guard      | 02, 06             | guide + review
nestjs-service-boundary-guard   | 02, 06             | guide + review
frontend-implementation-guard   | 02, 06             | guide + review
mobile-implementation-guard     | 02, 06             | guide + review
prisma-data-access-guard        | 02, 03, 06         | guide + review
state-integrity-check           | 02, 03, 06         | guide + review
integration-contract-safety     | 02, 06             | guide + review
queue-and-retry-safety          | 02, 03, 06         | guide + review
resilience-and-error-handling   | 02, 04, 06         | guide + review
auth-and-permissions-safety     | 02, 03, 06         | guide + review
secrets-and-config-safety       | 02, 06             | guide + review
test-strategy-enforcement       | 02, 04             | guide
coverage-gap-detection          | 02, 06             | review
regression-risk-check           | 02, 05, 06         | review
accessibility-guard             | 02, 04, 06         | guide + review
performance-budget-guard        | 02, 04, 06         | guide + review
typescript-rigor                | 02, 03, 04, 06     | guide + review
change-risk-evaluation          | 02, 06             | review
rollback-planning               | 02, 06             | review
infra-safe-change               | 02, 06             | guide + review
aws-deploy-safety               | 02, 06             | guide + review
cicd-pipeline-safety            | 02, 06             | guide + review
supply-chain-and-dependencies   | 02, 06             | review
observability-first-debugging   | 03                 | guide
```

- [ ] **Step 2: Verify**

Run: `ls -la "C:/Home/Basuru/Solto/company-plugin/skills-categorization.txt"`
Run: `cd "C:/Home/Basuru/Solto/company-plugin" && git check-ignore -v skills-categorization.txt`
Expected: File exists, gitignore rule matches.

---

## Task 13: Workflow-compatibility test template

**Files:**
- Create: `docs/superpowers/testing-skills-against-workflows.md`

- [ ] **Step 1: Write the template**

Structure (following the spec §7):

```markdown
# Testing Company-Plugin Skills Against Superpowers Workflows

Companion to `superpowers:writing-skills` and `superpowers:writing-skills/testing-skills-with-subagents.md`.
Use this AFTER superpowers pressure-testing passes, BEFORE committing a new or edited company-plugin skill.

## Why this exists

`superpowers:writing-skills` tests a skill in isolation — it verifies the skill's rules resist rationalization under pressure. It does NOT verify that the skill fits inside the superpowers workflows (brainstorming, writing-plans, subagent-driven-development, etc.). A skill can be internally bulletproof and still misfire at the wrong point in a workflow — e.g., by triggering during `brainstorming` and pushing Claude past the design HARD-GATE.

This document closes that gap.

## Assumes `_baseline`. Adds: superpowers workflow awareness.

## The seven checks

(Reproduce C1–C7 from the spec §7.2, with full method descriptions and examples.)

## How to run

1. **Static review:** apply C1, C3, C4, C5 by reading the SKILL.md.
2. **Workflow insertion:** pick each workflow file in `docs/superpowers/workflows/` that your skill attaches to (per the categorization file, Section D). For each, write a 1-paragraph simulation: "The user says X, the agent enters Workflow N, at point P the agent considers invoking your skill." Verify the agent doesn't skip a superpowers gate, doesn't duplicate a superpowers primitive, and doesn't produce output that conflicts with a parallel company-plugin skill.
3. **Pressure scenario (C7):** for discipline-style skills (those with hard rules like "never …"), adapt one of the scenarios from superpowers:testing-skills-with-subagents.md to include a workflow context: "You are in the middle of `brainstorming` on a feature. You are tempted to violate rule R from this skill because Y. What do you do?" Dispatch a subagent; verify compliance.

## Report format

(Reproduce the report template from spec §7.3.)

## Integration into skill-authoring-guide

Adds "Run the workflow-compatibility audit (this file) and attach the report before committing" to `docs/superpowers/skill-authoring-guide.md` §Self-review.

## When to skip

- `_baseline`: not a standalone skill — checks C1 and C6 do not apply (it's never invoked directly).
- Reference-only skills (none exist in company-plugin today): C2 does not apply.
```

- [ ] **Step 2: Verify**

Run: `ls -la "C:/Home/Basuru/Solto/company-plugin/docs/superpowers/testing-skills-against-workflows.md"`
Expected: file exists.

---

## Task 14: Parallel audit — dispatch 26 subagents

**Files:** no files written in this task; subagent summaries captured in Task 15.

- [ ] **Step 1: Dispatch 26 audit agents in a single message**

Per-agent prompt template:

> You are auditing ONE company-plugin skill for compatibility with superpowers v5.0.7 workflows. Produce a report in the exact format at the end of this prompt.
>
> **Skill under audit:** `C:/Home/Basuru/Solto/company-plugin/skills/<SKILL-NAME>/SKILL.md`
>
> **Reference material (read if needed):**
> - Test template: `C:/Home/Basuru/Solto/company-plugin/docs/superpowers/testing-skills-against-workflows.md`
> - Workflows: `C:/Home/Basuru/Solto/company-plugin/docs/superpowers/workflows/*.md`
> - Company conventions: `C:/Home/Basuru/Solto/company-plugin/docs/superpowers/skill-authoring-guide.md`
> - Baseline: `C:/Home/Basuru/Solto/company-plugin/skills/_baseline/SKILL.md`
> - Superpowers source: `C:/Users/basuru/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.7/` (skim for Iron Laws, TDD, verification, systematic-debugging, writing-skills, using-superpowers, subagent-driven-development).
>
> **Run the 7 checks (C1–C7) from the test template.** For each: PASS / CONCERN / FAIL / N/A with one-line rationale. For each CONCERN/FAIL, add a concrete fix recommendation (file:section — exact edit).
>
> **Do NOT modify any files.** Read-only audit.
>
> **Return format (strict markdown, no preamble):**
>
> ```
> # Compatibility audit — <skill-name>
>
> Date: 2026-04-22
> Source: skills/<skill-name>/SKILL.md
>
> | Check | Verdict | Notes |
> |---|---|---|
> | C1 Trigger correctness           | ... | ... |
> | C2 No HARD-GATE bypass           | ... | ... |
> | C3 No duplication                | ... | ... |
> | C4 Correct handoff markers       | ... | ... |
> | C5 No Iron Law contradiction     | ... | ... |
> | C6 Review-mode output compat     | ... | ... |
> | C7 Workflow-insertion simulation | ... | ... |
>
> ## Findings (CONCERN or FAIL)
> - <file:section — issue — fix>
>
> ## Workflows this skill attaches to
> - 0X — <reason>
>
> Overall verdict: GREEN | YELLOW | RED
> ```
>
> Keep report under 600 words. Return ONLY the markdown report — no conversational preamble.

Skills to dispatch (26):

```
_baseline, accessibility-guard, architecture-guard,
auth-and-permissions-safety, aws-deploy-safety,
change-risk-evaluation, cicd-pipeline-safety,
coverage-gap-detection, frontend-implementation-guard,
infra-safe-change, integration-contract-safety,
mobile-implementation-guard, nestjs-service-boundary-guard,
nextjs-app-structure-guard, observability-first-debugging,
performance-budget-guard, prisma-data-access-guard,
queue-and-retry-safety, regression-risk-check,
resilience-and-error-handling, rollback-planning,
secrets-and-config-safety, state-integrity-check,
supply-chain-and-dependencies, test-strategy-enforcement,
typescript-rigor
```

All 26 dispatches go in a SINGLE message (one `Agent` tool call per skill, in one block). Per user directive.

Fallback (if 26 parallel dispatches exceed the harness limit): cluster into 6 groups (Architecture, Data+Integration+Async, Security+Quality, Frontend Quality + Language, Ops + Risk, Shared+Foundation) and dispatch 6 parallel agents where each handles its cluster.

- [ ] **Step 2: Collect 26 (or 6) agent summaries**

Each summary is a full markdown report. Hold them in working memory for Task 15.

---

## Task 15: Write per-skill reports + SUMMARY

**Files:**
- Create: `docs/superpowers/audits/2026-04-22/<skill-name>.md` × 26
- Create: `docs/superpowers/audits/2026-04-22/SUMMARY.md`

- [ ] **Step 1: Create audit directory**

Run: `mkdir -p "C:/Home/Basuru/Solto/company-plugin/docs/superpowers/audits/2026-04-22"`

- [ ] **Step 2: Write each per-skill report**

For each skill, save the agent's returned markdown verbatim to `docs/superpowers/audits/2026-04-22/<skill-name>.md`. If clustering was used in Task 14, extract the per-skill sections from each cluster report.

- [ ] **Step 3: Write `SUMMARY.md`**

Structure:

```markdown
# Compatibility Audit Summary — 2026-04-22

Audited: 26 skills
Template: docs/superpowers/testing-skills-against-workflows.md

## Results

| Verdict | Count | Skills |
|---|---|---|
| GREEN  | ... | ... |
| YELLOW | ... | ... |
| RED    | ... | ... |

## Systemic patterns

(Collected findings that appear across multiple skills.)

- Pattern 1: <description> — affects N skills: <list>
- Pattern 2: ...

## Recommended fix priority

### Critical (RED)
- <skill> — <top issue> — suggested fix

### Important (YELLOW)
- <skill> — <top concern>

### Minor
- ...

## Out of scope (deferred)

Fixes are NOT applied in this session. User schedules a follow-up cycle.
```

- [ ] **Step 4: Verify**

Run: `ls "C:/Home/Basuru/Solto/company-plugin/docs/superpowers/audits/2026-04-22/" | wc -l`
Expected: 27 (26 skill reports + SUMMARY.md).

---

## Task 16: Final verification and summary

**Files:** none written; verification only.

- [ ] **Step 1: Verify no commits were made**

Run: `cd "C:/Home/Basuru/Solto/company-plugin" && git log -1 --format=%H`
Run: `cd "C:/Home/Basuru/Solto/company-plugin" && git status --short | head -50`

Expected: HEAD unchanged from start of session (still `1206df9`). `git status --short` shows untracked files for every new artifact, plus the new `.gitignore`. No modified tracked files (we didn't touch any).

- [ ] **Step 2: Verify the three ignored files are in fact ignored**

Run: `cd "C:/Home/Basuru/Solto/company-plugin" && git check-ignore -v superpowers.md skills-categorization.txt bash.exe.stackdump`
Expected: all three match `.gitignore` rules.

- [ ] **Step 3: Produce consolidated summary for the user**

Single final message listing:
- Every artifact created (path + one-line purpose)
- Every decision made during execution (including any fallback to cluster dispatch)
- The RED skills count and top issues from `SUMMARY.md` so the user can scope the follow-up fix cycle
- Explicit statement that no commits were made

---

## Self-review (plan against spec)

- **Spec §5 (piece #1):** covered by Tasks 2 (audit), 3 (README), 4–11 (per-workflow files). ✔
- **Spec §6 (piece #2):** covered by Task 12. ✔
- **Spec §7 (piece #3):** covered by Task 13. ✔
- **Spec §8 (piece #4):** covered by Tasks 14–15. ✔
- **Spec §9 (artifacts):** all listed artifacts appear in a task's Files section. ✔
- **Spec §10 (sequencing):** Task ordering matches. Parallel tasks (2, 14) explicitly dispatch in a single message. ✔
- **Spec §2 (no commits):** every task uses verify-not-commit. Task 1 and Task 16 explicitly confirm. ✔
- **Out of scope (§12):** no fix-application tasks. ✔

Placeholders scan: no TBD/TODO/handle-appropriately — all content is concrete.

Type consistency: verdict labels (GREEN/YELLOW/RED, PASS/CONCERN/FAIL/N/A) consistent across Tasks 14, 15, 16.

---

## Execution choice

Per Basuru's autonomous directive (2026-04-22), execution proceeds inline via `superpowers:executing-plans` WITHOUT pausing for approval between tasks. Parallel dispatches (Tasks 2 and 14) use the `Agent` tool natively. No subagent-driven-development wrapper — each task in this plan is either a file-write or a subagent-dispatch-and-collect, not a TDD cycle, so the subagent-driven-development two-stage-review overhead is not warranted.
