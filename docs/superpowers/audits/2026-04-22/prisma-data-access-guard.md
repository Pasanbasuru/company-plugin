# Compatibility audit — prisma-data-access-guard

Date: 2026-04-22
Source: skills/prisma-data-access-guard/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | PASS | "Use when touching Prisma..." + "Do NOT use for..." + concrete scope tags |
| C2 No HARD-GATE bypass           | PASS | No imperative verbs that bypass spec-approval gate; attach point is plan phase |
| C3 No duplication                | PASS | Hands off to state-integrity-check and performance-budget-guard; no restatement of superpowers primitives |
| C4 Correct handoff markers       | PASS | Uses "Hands off to:" marker; no loose prose or @-style force-loads |
| C5 No Iron Law contradiction     | PASS | Rules (transactions, migration safety, raw SQL templates) preserve Iron Laws; no exemptions |
| C6 Review-mode output compat     | PASS | Review checklist has correct structure: Summary, Findings, Safer alternative, Checklist coverage (8 rules, PASS/CONCERN/NOT APPLICABLE labels) |
| C7 Workflow-insertion simulation | PASS | Attaches to 02 (plan), 03 (domain phase), 06 (review); no gate bypass; output shape matches domain guard expectations |

## Findings (CONCERN or FAIL)
- none

## Workflows this skill attaches to
- 02 — Plan structure phase (data-access patterns, query shape, transaction safety)
- 03 — Bug path Phase 4 domain guard (Prisma-specific bugs: N+1, partial writes, unsafe migrations)
- 06 — Review loop (code review for data-access discipline)

Overall verdict: GREEN
