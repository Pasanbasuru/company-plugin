# Compatibility audit — rollback-planning

Date: 2026-04-22
Source: skills/rollback-planning/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | PASS | "Use when" + "Do NOT use for" present; concrete scopes listed |
| C2 No HARD-GATE bypass           | PASS | No imperative to implement code; documents review activity only |
| C3 No duplication                | PASS | Does not restate TDD, debugging, or verification primitives |
| C4 Correct handoff markers       | FAIL | No `REQUIRED SUB-SKILL` / `REQUIRED BACKGROUND` / `Hands off to` markers; no `## Interactions` section |
| C5 No Iron Law contradiction     | PASS | Rules reinforce discipline; no forced law violations |
| C6 Review-mode output compat     | FAIL | Checklist is flat checkbox list, not prescribed four-section format with PASS/CONCERN/NOT APPLICABLE per rule |
| C7 Workflow-insertion simulation | PASS | Correctly attaches to Workflow 2 finish-phase risk; invoked in review mode only |

## Findings (CONCERN or FAIL)

- skills/rollback-planning/SKILL.md — `## Interactions` section missing — add explicit owns/hands-off/does-not-duplicate bullets per authoring guide §Interactions
- skills/rollback-planning/SKILL.md:230–237 `## Review checklist` — current format is flat checkbox; convert to four-section format: Summary (one line), Findings (file:line, severity, category, fix), Safer alternative, Checklist coverage (PASS/CONCERN/NOT APPLICABLE per core rule)

## Workflows this skill attaches to

- 02 Creative work — finish-phase risk; review mode invocation during `finishing-a-development-branch`

Overall verdict: YELLOW
