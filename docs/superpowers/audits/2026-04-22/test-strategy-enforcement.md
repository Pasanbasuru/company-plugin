# Compatibility audit — test-strategy-enforcement

Date: 2026-04-22
Source: skills/test-strategy-enforcement/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | PASS | "Use when..." + anti-triggers ("Do NOT use for...") + concrete triggers (pyramid, layers, flake, data) |
| C2 No HARD-GATE bypass           | PASS | Test-layer only; no implementation directives; gates respect brainstorming completion |
| C3 No duplication                | CONCERN | Missing `**REQUIRED SUB-SKILL:** superpowers:test-driven-development` in Interactions section |
| C4 Correct handoff markers       | PASS | "Hands off to" and "Does not duplicate" use sanctioned marker forms |
| C5 No Iron Law contradiction     | PASS | Rules on Testcontainers, factories, flake hygiene assume TDD upstream; none force a violation |
| C6 Review-mode output compat     | PASS | Checklist shape correct (Summary, Findings, Checklist coverage); labels match (PASS/CONCERN/NOT APPLICABLE); 7 rules mapped |
| C7 Workflow-insertion simulation | PASS | Attaches to Workflow 02 test-discipline phase (post-implementation); no gate bypass; expected output shape |

## Findings (CONCERN or FAIL)

- **skills/test-strategy-enforcement/SKILL.md:354–358 — missing TDD sub-skill reference — Add `**REQUIRED SUB-SKILL:** superpowers:test-driven-development` to Interactions section so that agents understand TDD is upstream.**

## Workflows this skill attaches to

- 02 Creative work — test discipline phase (post-implementation, during integration/e2e test authoring)

Overall verdict: YELLOW
