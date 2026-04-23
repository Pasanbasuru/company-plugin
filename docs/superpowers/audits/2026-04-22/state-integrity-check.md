# Compatibility audit — state-integrity-check

Date: 2026-04-22
Source: skills/state-integrity-check/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | PASS | Clear "Use when" trigger (mutations + UI cache); explicit anti-triggers for DB-only and UI-only changes |
| C2 No HARD-GATE bypass           | PASS | All rules guide plan-phase structure; no implementation scaffolding; post-gate skill only |
| C3 No duplication                | PASS | No duplication of TDD, debugging, or verification Iron Laws; handoff to prisma-data-access-guard and frontend-implementation-guard explicit |
| C4 Correct handoff markers       | PASS | Uses "Owns / Hands off to / Does not duplicate" format; all cross-references sanctioned |
| C5 No Iron Law contradiction     | PASS | Rules strengthen Iron Law 3 (fresh evidence); no rule forces a violation of any Iron Law |
| C6 Review-mode output compat     | PASS | Review checklist present with four sections; grading uses PASS/CONCERN/NOT APPLICABLE; every core rule mapped |
| C7 Workflow-insertion simulation | PASS | Attaches to 02 (plan-structure), 03 (domain-guard), 06 (review); no gate bypass; invokes at expected phases |

## Findings (CONCERN or FAIL)
- none

## Workflows this skill attaches to
- 02 — Plan-structure phase: guides cache invalidation and optimistic-update discipline
- 03 — Domain-risk reviewer for cache-related bugs (stale reads, divergence, invalidation misses)
- 06 — Review-loop domain-risk reviewer alongside code-reviewer

Overall verdict: GREEN
