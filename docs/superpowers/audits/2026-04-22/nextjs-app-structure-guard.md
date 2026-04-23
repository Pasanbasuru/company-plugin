# Compatibility audit — nextjs-app-structure-guard

Date: 2026-04-22
Source: skills/nextjs-app-structure-guard/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | PASS | "Use when" clear, anti-triggers explicit, concrete file types |
| C2 No HARD-GATE bypass           | PASS | No imperative verbs pushing to implementation; positioning-focused |
| C3 No duplication                | PASS | Does not restate TDD, debugging, or verification primitives |
| C4 Correct handoff markers       | CONCERN | Body uses correct **Hands off to:** syntax; description uses backticks without markers |
| C5 No Iron Law contradiction     | PASS | No rule forces violation of any Iron Law |
| C6 Review-mode output compat     | PASS | Checklist structure matches guide; labels and mappings correct |
| C7 Workflow-insertion simulation | PASS | Attaches to code-review and subagent workflows; no gate bypass |

## Findings (CONCERN or FAIL)

- SKILL.md:3 — C4 Minor inconsistency — description references `frontend-implementation-guard` and `prisma-data-access-guard` as anti-triggers without explicit **Hands off to:** markers. Consider moving these to the main Interactions section or prefixing with "see **Hands off to:**".

## Workflows this skill attaches to

- 04 (Subagent-driven-development) — triggered when reviewing code files touching App Router
- 06 (Code-review-loop) — invoked during review phase to validate routing, caching, boundary placement

Overall verdict: YELLOW
