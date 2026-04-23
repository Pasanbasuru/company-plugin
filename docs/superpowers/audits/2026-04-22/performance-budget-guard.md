# Compatibility audit — performance-budget-guard

Date: 2026-04-22
Source: skills/performance-budget-guard/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | PASS | Description starts with "Use when…", includes concrete triggers (new route, new dependency, hot-path query, Core Web Vitals), includes "Do NOT use for…" anti-triggers (logic correctness, query shape). No vague concepts. |
| C2 No HARD-GATE bypass           | PASS | No imperative verbs forcing code generation before merge. Rule 1 requires "enforced in CI; a regression blocks merge" — preserves gate. No "implement now" or "skip planning" directives. |
| C3 No duplication                | PASS | Does not restate test-driven-development, systematic-debugging, verification-before-completion, or using-git-worktrees. Measurement language ("check against budgets", "p95 estimate") references these domains but defers via "Hands off to" markers. |
| C4 Correct handoff markers       | PASS | All cross-skill references use explicit "Hands off to:" marker. Three skills referenced (prisma-data-access-guard, nextjs-app-structure-guard, supply-chain-and-dependencies) with specific handoff rationale. No loose prose or @-references. |
| C5 No Iron Law contradiction     | PASS | Iron Law 1 (NO CODE WITHOUT FAILING TEST): rules do not contradict — measurement happens at review, not during code generation. Iron Law 3 (NO CLAIM WITHOUT FRESH EVIDENCE): Rule 3 explicitly requires p95 measurement or cache justification before merge. No forcing of violations. |
| C6 Review-mode output compat     | PASS | Review checklist follows authoring-guide format: Summary, Findings (file:line, severity, category, fix), Safer alternative, Checklist coverage (PASS / CONCERN / NOT APPLICABLE). Seven rules map 1:1 to seven checklist items. No GREEN/YELLOW/RED grading; uses sanctioned labels. |
| C7 Workflow-insertion simulation | N/A | Skill is review-mode only ("invoke when reviewing existing code"). Attaches at workflow 06 (review-loop), not during brainstorming (02) or execution (04). Review-mode skills do not block gates. No execution-phase code; no gate-crossing risk. |

## Findings (CONCERN or FAIL)

None.

## Workflows this skill attaches to

- 06 (code-reviewer) — review-mode invocation during PR review; guards against performance regressions at merge time.

Overall verdict: GREEN
