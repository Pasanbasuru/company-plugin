# Compatibility audit — _baseline

Date: 2026-04-22
Source: skills/_baseline/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | N/A | foundation, never invoked directly |
| C2 No HARD-GATE bypass           | PASS | zero imperative verbs forcing implementation gates; sets standards only |
| C3 No duplication                | PASS | zero references to superpowers primitives |
| C4 Correct handoff markers       | PASS | zero cross-skill references; foundation has no handoffs |
| C5 No Iron Law contradiction     | PASS | all rules reinforce Iron Laws 1–4, none force violations |
| C6 Review-mode output compat     | N/A | no review checklist — baseline is never invoked directly |
| C7 Workflow-insertion simulation | N/A | implicitly active in every workflow, not phase-inserted |

## Findings (CONCERN or FAIL)
- none

## Workflows this skill attaches to
- foundation — implicit in every workflow

Overall verdict: GREEN
