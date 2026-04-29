# 2026-04-29 — Skill set improvements (after-action)

## Outcome

Verifier sweep: 22 GREEN + 2 YELLOW → **24 GREEN + 0 YELLOW**. All discoverability trigger-verb concerns: 10 → 0. Tests: 46/46.

## What shipped (commits on `logan`)

1. `0d879df` — added whitelist trigger verbs to 10 descriptions (`architecture-guard`, `auth-and-permissions-safety`, `cicd-pipeline-safety`, `infra-safe-change`, `nestjs-service-boundary-guard`, `nextjs-app-structure-guard`, `performance-budget-guard`, `prisma-data-access-guard`, `resilience-and-error-handling`, `state-integrity-check`).
2. `f5d94ed` — extracted deep implementation patterns to `references/patterns.md` for the two oversize skills:
   - `integration-contract-safety` (493 → 343 lines): OpenAPI workflow + Contract testing.
   - `observability-first-debugging` (467 → 323 lines): Structured logging (Pino) setup + Tracing critical paths.

## Plan-vs-reality corrections

A planning doc written earlier in the session (`docs/superpowers/plans/2026-04-29-skill-set-improvements.md`, deleted alongside this audit's commit) had two factual errors caught only when the verifier was run with full findings:

- **YELLOW classification.** Both YELLOW skills were flagged for **size**, not trigger verbs. `integration-contract-safety` had a compound finding (trigger-verb + size); `observability-first-debugging` was size-only. The plan's Task 1 ("fix YELLOWs by description rewrite") could not reach 24 GREEN without `references/` extraction.
- **Interactions section coverage.** All 24 skills already had `## Interactions with other skills` sections. The plan's Task 2 ("add to 23 skills") was zero-work and was dropped.

The shipped scope is therefore narrower than the plan's: trigger-verb fixes + size extraction, no Interactions edits, no description rewrites beyond the trigger-verb cases, no C1–C7 audit run.

## Skipped (intentionally, with rationale)

- **C1–C7 workflow audit.** Defer until after the dev → main promotion is validated end-to-end. Running it now would test a state that is about to change again (next promotion + any user-driven follow-ups).
- **Description "Use when …" form alignment beyond trigger-verb fixes.** Verifier passes; the existing form is discoverable. Anthropic's `superpowers:writing-skills` standard is an aspirational tightening, not a correctness fix.
- **Adding commands/agents/MCP.** The plugin's job is guardrails as knowledge; composing `superpowers:*` is preferred to building.

## Follow-ups

Single open item: parent TaskList #5 — fast-forward `origin/main` to `logan` and remove the temporary `global-plugin-dev` marketplace entry, gated on the user re-installing `global-plugin-dev@global-plugins` and confirming the changes work end-to-end.
