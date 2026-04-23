# Compatibility Audit Summary — 2026-04-22

- **Audited:** 26 skills in `skills/`.
- **Template:** `docs/superpowers/testing-skills-against-workflows.md` (7 checks: C1–C7).
- **Method:** 26 parallel subagent dispatches, one per skill, read-only static + inferred workflow-insertion audits.
- **Applied fixes this session:** none. User triages a follow-up fix cycle.

## Results — as returned by auditing subagents

| Verdict | Count | Skills |
|---|---:|---|
| GREEN  | 9  | `_baseline`, `cicd-pipeline-safety`, `frontend-implementation-guard`, `nestjs-service-boundary-guard`, `performance-budget-guard`, `prisma-data-access-guard`, `state-integrity-check`, `supply-chain-and-dependencies`, `typescript-rigor` |
| YELLOW | 15 | `architecture-guard`, `auth-and-permissions-safety`, `aws-deploy-safety`, `change-risk-evaluation`, `coverage-gap-detection`, `infra-safe-change`, `integration-contract-safety`, `mobile-implementation-guard`, `nextjs-app-structure-guard`, `observability-first-debugging`, `queue-and-retry-safety`, `regression-risk-check`, `resilience-and-error-handling`, `rollback-planning`, `test-strategy-enforcement` |
| RED    | 2  | `accessibility-guard`, `secrets-and-config-safety` |

## Strict-template re-interpretation

The audit template (§Verdict guide) says:

> - **RED** — any FAIL. Skill must be fixed before next use or merge.
> - **YELLOW** — any CONCERN, no FAIL. Skill is usable; fix at next convenience.

Applying this rule strictly (any check with FAIL ⇒ RED), the tally becomes:

| Verdict | Count | Skills |
|---|---:|---|
| GREEN  | 9  | unchanged |
| YELLOW | 9  | `auth-and-permissions-safety`, `infra-safe-change`, `mobile-implementation-guard`, `nextjs-app-structure-guard`, `observability-first-debugging`, `queue-and-retry-safety`, `regression-risk-check`, `resilience-and-error-handling`, `test-strategy-enforcement` |
| RED    | 8  | `accessibility-guard`, `architecture-guard` (C4 FAIL), `aws-deploy-safety` (C6 FAIL), `change-risk-evaluation` (C6 FAIL), `coverage-gap-detection` (C6 FAIL), `integration-contract-safety` (C6 FAIL), `rollback-planning` (C4 + C6 FAIL), `secrets-and-config-safety` (C6 FAIL) |

Some subagents were lenient — they returned YELLOW when the strict rule calls for RED. The strict tally above is the one to act on. Each skill's per-file report keeps the subagent's own verdict for reference.

## Systemic patterns (high-leverage fixes)

These three patterns account for almost every CONCERN / FAIL in the 17 skills with issues.

### Pattern 1 — Review checklist shape drift (15 skills affected)

Many skills have a `## Review checklist` section, but its shape diverges from the prescribed four-section template in `docs/superpowers/skill-authoring-guide.md`:

- **Prescribed:** `Summary`, `Findings` (with `file:line, severity, category, fix`), `Safer alternative`, `Checklist coverage` (labels: `PASS / CONCERN / NOT APPLICABLE`).
- **Observed drift:** missing `Safer alternative` section, flat checkbox lists, custom domain "inventory" sections, non-standard grading labels (`COMPLETE/INCOMPLETE`, `pass/concerns/blocking`, `low/med/high`), or empty templates.

**Affected:** `accessibility-guard` (missing entirely), `aws-deploy-safety`, `auth-and-permissions-safety`, `change-risk-evaluation`, `coverage-gap-detection`, `infra-safe-change`, `integration-contract-safety`, `mobile-implementation-guard`, `observability-first-debugging`, `queue-and-retry-safety`, `regression-risk-check`, `resilience-and-error-handling`, `rollback-planning`, `secrets-and-config-safety`.

**Fix strategy:** add the missing `Safer alternative` section where absent; rewrite custom-shape checklists to the four-section template; unify grading labels to `PASS / CONCERN / NOT APPLICABLE`; keep domain "inventory" content only inside the `Findings` section. One lint-style fixup pass can sweep most of this.

### Pattern 2 — Handoff-marker hygiene (7 skills affected)

Cross-skill references use loose prose ("see X", "use X", "feeds from X") instead of the three sanctioned marker forms:

- `**REQUIRED SUB-SKILL:** superpowers:<name>` (must invoke)
- `**REQUIRED BACKGROUND:** superpowers:<name>` (must understand first)
- `**Hands off to:** superpowers:<name>` (passes responsibility)

**Affected:** `architecture-guard` (C4 FAIL — Hands off to in prose), `aws-deploy-safety`, `change-risk-evaluation`, `coverage-gap-detection`, `nextjs-app-structure-guard`, `observability-first-debugging`, `regression-risk-check`, `rollback-planning` (no Interactions section at all).

**Fix strategy:** one editorial pass per skill — replace prose citations with bold marker form. `rollback-planning` needs a full `## Interactions with other skills` section added.

### Pattern 3 — Missing `REQUIRED SUB-SKILL` / `REQUIRED BACKGROUND` for superpowers primitives (3 skills affected)

Some skills stand on top of superpowers primitives but don't say so explicitly:

- `test-strategy-enforcement` should declare `**REQUIRED SUB-SKILL:** superpowers:test-driven-development` (TDD is upstream).
- `observability-first-debugging` should declare `**REQUIRED BACKGROUND:** superpowers:systematic-debugging` (Phase 1 — Root Cause) since it attaches inside that skill's Phase 1.
- `coverage-gap-detection` should declare required links to `test-strategy-enforcement` and `regression-risk-check`.

**Fix strategy:** add the sub-skill / background marker in each skill's `## Interactions with other skills` section.

## Minor / size-only findings

- `resilience-and-error-handling` is 640 lines — exceeds the 500-line ceiling in the authoring guide's size target (200–400 preferred). Consider a split in a future cycle (e.g., retries + timeouts + idempotency vs circuit breakers + error boundaries + graceful degradation). Not a compatibility issue, but worth flagging.

## Recommended fix priority (follow-up cycle)

### Critical (strict RED — block next merge in the affected area)
1. `accessibility-guard` — add `## Review checklist` and `## Interactions with other skills` sections.
2. `secrets-and-config-safety` — replace inventory-based review checklist with four-section template.
3. `rollback-planning` — add `## Interactions` section; rewrite checklist to four sections.
4. `architecture-guard` — convert line-106 prose reference to `**Hands off to:**` marker.
5. `aws-deploy-safety`, `change-risk-evaluation`, `coverage-gap-detection`, `integration-contract-safety` — add `Safer alternative` section to review checklist; normalise labels.

### Important (strict YELLOW — schedule at next convenience)
- The other 9 YELLOW skills above, all of which have CONCERN-level findings in C4 or C6.

### Minor
- `test-strategy-enforcement`, `coverage-gap-detection`, `observability-first-debugging` — add missing `REQUIRED SUB-SKILL` / `REQUIRED BACKGROUND` markers.
- `resilience-and-error-handling` — consider a split to hit the authoring-guide size target.

## Out of scope (not applied this session)

- No SKILL.md files were modified. User schedules a fix cycle using the findings above.
- No subagent-driven dynamic pressure tests (C7 scenarios) were run; C7 verdicts are static inferences from the skill's trigger fields and interaction declarations.

## How to use this audit

- Per-skill details: see `docs/superpowers/audits/2026-04-22/<skill-name>.md`.
- Template these skills were audited against: `docs/superpowers/testing-skills-against-workflows.md`.
- Workflows the audits referenced: `docs/superpowers/workflows/*.md`.
- Categorization that maps skills → workflows: `skills-categorization.txt` (gitignored, local).
