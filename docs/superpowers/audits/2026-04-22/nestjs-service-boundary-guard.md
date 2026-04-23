# Compatibility audit — nestjs-service-boundary-guard

Date: 2026-04-22
Source: skills/nestjs-service-boundary-guard/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | PASS | Description starts with "Use when touching a NestJS module, controller, provider, or DTO"; includes two explicit "Do NOT use for" anti-triggers (database query shape, cross-service contracts); references concrete NestJS artifacts (modules, controllers, DTOs). |
| C2 No HARD-GATE bypass           | PASS | No imperative verbs triggering implementation (write, scaffold, implement, skip). Skill is a design-phase guard for module/provider/controller review; all content is analysis and validation, not code execution. |
| C3 No duplication                | PASS | No mention of TDD, RED-GREEN-REFACTOR, failing tests, root cause, fresh evidence, or worktree isolation. Correctly omits superpowers primitives; defers to `prisma-data-access-guard` for queries, `auth-and-permissions-safety` for guard logic. |
| C4 Correct handoff markers       | PASS | Uses "Hands off to:" marker (3 references: `prisma-data-access-guard`, `integration-contract-safety`, `auth-and-permissions-safety`). No loose prose mentions; no `@` force-loads. All cross-skill citations follow sanctioned form. |
| C5 No Iron Law contradiction     | PASS | Rules enforce module boundaries, controller thinness, stateless services, and DTO validation. None force code without tests, skip root-cause analysis, bypass git isolation, or skip evidence. Rules are restorative (enforce structure), not permissive. |
| C6 Review-mode output compat     | PASS | Review checklist follows prescribed structure: Summary, Findings (file:line, severity, category, fix), Safer alternative, Checklist coverage (7 rules, each checkable as PASS/CONCERN/NOT APPLICABLE). Grading labels conform to standard set. |
| C7 Workflow-insertion simulation | PASS | Skill attaches at design-review phase of Workflow 02 (creative work). Trigger is Backend NestJS work; invocation comes after brainstorming and spec approval but before implementation worktree creation. No HARD-GATE bypass risk; no gate-skipping in guidance. Mode is guide + review (appropriate for design phase, not pre-design). |

## Findings (CONCERN or FAIL)

None.

## Workflows this skill attaches to

- 02 — Design review phase (after spec approval, before implementation). Triggers on Backend NestJS module/controller/DTO work.

Overall verdict: GREEN
