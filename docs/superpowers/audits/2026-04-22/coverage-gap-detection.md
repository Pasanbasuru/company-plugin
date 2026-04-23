# Compatibility audit — coverage-gap-detection

Date: 2026-04-22
Source: skills/coverage-gap-detection/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | PASS | Description contains "Use when asked 'are we testing the right things'..."; clear anti-trigger "Do NOT use for test authoring patterns"; concrete triggers; no workflow summary |
| C2 No HARD-GATE bypass           | PASS | No imperative code-generation verbs; skill is review-only before merge; no "implement now" directives |
| C3 No duplication                | PASS | Does not restate test-driven-development, systematic-debugging, or verification-before-completion; correctly hands off to test-strategy-enforcement (how) and regression-risk-check (blocker assessment) |
| C4 Correct handoff markers       | CONCERN | References "test-strategy-enforcement" and "regression-risk-check" in Interactions section use prose ("Hands off to:") instead of `**REQUIRED SUB-SKILL:**` or `**REQUIRED BACKGROUND:**` markers |
| C5 No Iron Law contradiction     | PASS | No rule forces violation of "NO CODE WITHOUT TEST" or other Iron Laws; rules describe analysis and feedback, not enforcement of skipping gates |
| C6 Review-mode output compat     | FAIL | Review checklist (lines 314–321) is non-conformant; it prescribes recording PASS/CONCERN/NOT APPLICABLE but does not map the 7 core rules to individual checklist lines; lacks four-section shape (Summary, Findings file:line, Safer alternative, Checklist coverage) |
| C7 Workflow-insertion simulation | PASS | Skill attaches to Workflow 02 (before finishing) and Workflow 06 (alongside code-reviewer); both are review-mode; no gate bypass observed |

## Findings (CONCERN or FAIL)

- `SKILL.md:309` — C4: `**Hands off to:**` uses prose names instead of `**REQUIRED SUB-SKILL:** superpowers:test-strategy-enforcement` and `**REQUIRED SUB-SKILL:** superpowers:regression-risk-check` for mandatory dependencies
- `SKILL.md:314–321` — C6: Review checklist does not follow the guide shape; must include four sections (Summary, Findings, Safer alternative, Checklist coverage table with 7 rows mapping to Core rules) per `skill-authoring-guide.md`

## Workflows this skill attaches to

- 02 Creative work — test discipline phase, before finishing; review mode
- 06 Review loop — alongside code-reviewer as domain-risk reviewer; review mode

Overall verdict: YELLOW
