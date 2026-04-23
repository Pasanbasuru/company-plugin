# Compatibility audit — integration-contract-safety

Date: 2026-04-22
Source: skills/integration-contract-safety/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | PASS | Description includes "Use when" + "Do NOT use for" + concrete triggers |
| C2 No HARD-GATE bypass           | PASS | No implementation imperatives; attaches to plan phase post-gate |
| C3 No duplication                | PASS | Clean handoff; does not restate TDD or verification patterns |
| C4 Correct handoff markers       | PASS | Uses **Hands off to:** for queue/resilience/auth; no loose references |
| C5 No Iron Law contradiction     | PASS | Rules align with Iron Laws; no forced violations |
| C6 Review-mode output compat     | FAIL | Checklist uses outdated labels (*pass/concerns/low-med-high*); shape missing Safer alternative section |
| C7 Workflow-insertion simulation | DEFERRED | Static checks pass; full subagent test required for dynamic verification |

## Findings (CONCERN or FAIL)

- skills/integration-contract-safety/SKILL.md lines 487–501 — FAIL — Review checklist must use PASS/CONCERN/NOT APPLICABLE and follow four-section format: Summary / Findings (file:line, severity as category, fix) / Safer alternative / Checklist coverage

## Workflows this skill attaches to

- 02 — plan structure phase, API/webhook/event contract review

Overall verdict: YELLOW
