# Compatibility audit — typescript-rigor

Date: 2026-04-22
Source: skills/typescript-rigor/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | PASS | Description starts with "Use when", includes clear anti-trigger "Do NOT use for runtime/logic review without a type concern", covers concrete triggers (types, DTOs, boundaries). |
| C2 No HARD-GATE bypass           | PASS | No imperative verbs (implement, scaffold, create file now, skip) that bypass spec-to-code gates. Skill is guidance-only. |
| C3 No duplication                | PASS | Extends baseline's type strictness; adds rigor beyond `strict: true`. Does not restate TDD, debugging, or verification primitives. |
| C4 Correct handoff markers       | PASS | Handoffs use `**Hands off to:**` syntax correctly (prisma-data-access-guard, nestjs-service-boundary-guard, integration-contract-safety). No loose prose references. |
| C5 No Iron Law contradiction     | PASS | No rule forces violation of Iron Laws 1–4. Skill is discipline-focused, never bypasses TEST or VERIFY gates. |
| C6 Review-mode output compat     | PASS | Review checklist follows prescribed format: Summary, Findings (file:line, severity, category, fix), Safer alternative, Checklist coverage. Uses PASS/CONCERN/NOT APPLICABLE labels. Maps 7 rules to 7 checklist items. |
| C7 Workflow-insertion simulation | PASS | Skill attaches to Workflow 02 impl-guardrails phase (line 157: "Implementation guardrail | typescript-rigor | guide | Always"). Fires during implementation, after spec approved and worktree ready. No gate bypass. |

## Findings (CONCERN or FAIL)
- none

## Workflows this skill attaches to
- 02 — Implementation guardrails phase. Fires during code authoring/review to enforce type discipline at boundaries (discriminated unions, branded IDs, Zod parsing, error typing, no bare `Record<string, unknown>`).

Overall verdict: GREEN
