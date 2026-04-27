# Skills Library Overhaul — Design

Date: 2026-04-22
Owner: Basuru
Scope: `skills/` under `global-plugin`

## 1. Goal

Rewrite the current 19 thin skills in `global-plugin/skills/` into 25 production-grade skills that guide Claude toward building full-stack apps on the company's stack (React/Next.js, Node/NestJS, Prisma/Postgres, AWS) with strong defaults for security, testing, performance, accessibility, resilience, and observability.

Skills must:

- Shape code at write time (guide mode) and produce a structured review when asked (review mode).
- Be grounded in generic industry best-practice (no Solto-specific folder layouts or library picks baked in).
- Live as a single `SKILL.md` per skill folder. No `references/` subdirectory.

## 2. Constraints & decisions

Confirmed during brainstorming:

| Decision | Choice |
|---|---|
| Grounding | Generic industry best-practice |
| Depth | Full bundle content, but single `SKILL.md` file per skill (~200–400 lines) |
| Coverage | Rewrite all 19, add 6 new skills, no merges |
| Mode | Hybrid — guide primary, review checklist inline |
| Baseline | Shared `_baseline` skill to avoid cross-skill duplication |

## 3. Skill file structure

```
skills/<skill-name>/
└── SKILL.md
```

Each `SKILL.md` has this body, in order:

1. **Frontmatter** — `name`, `description` (with explicit *when to use* / *when NOT to use*), `allowed-tools` (least privilege).
2. **Purpose & scope** — 2–3 sentences.
3. **Assumes `_baseline`. Adds:** — single line linking to the baseline skill.
4. **Core rules** — numbered, testable, each with a one-line "why".
5. **Red flags** — a table of `thought → reality` anti-patterns.
6. **Good vs bad snippets** — 2–3 high-leverage before/after code examples.
7. **Deep-dive sections** — inline `##` sections for topics that would have been separate reference files.
8. **Interactions with other skills** — explicit overlap map.
9. **Review checklist** — inline section prescribing a structured report format for review-mode invocations.

Frontmatter shape:

```yaml
---
name: <skill-name>
description: Use when <trigger>. Do NOT use for <anti-trigger>. Covers <X, Y, Z>.
allowed-tools: Read, Grep, Glob, Bash
---
```

## 4. Final skill inventory (25)

### Architecture & structure (5, rewritten)

- `architecture-guard` — cross-app/service boundaries, monorepo ownership, dependency direction.
- `nextjs-app-structure-guard` — App Router conventions, RSC vs client, route handlers, middleware scope.
- `nestjs-service-boundary-guard` — module ownership, provider scope, controller/service split, DTO discipline.
- `frontend-implementation-guard` — component structure, state placement, data flow. Accessibility moves out to its own skill.
- `mobile-implementation-guard` — React Native structure, native module boundaries, navigation.

### Data (2, rewritten)

- `prisma-data-access-guard` — query shape, N+1, transactions, migration safety.
- `state-integrity-check` — client/server state consistency, cache invalidation, optimistic updates.

### Integration & async (2, rewritten)

- `integration-contract-safety` — API/webhook/event contracts, versioning, breaking-change detection.
- `queue-and-retry-safety` — at-least-once semantics, idempotency keys, DLQ, poison messages.

### Security & config (2, rewritten)

- `auth-and-permissions-safety` — authN/authZ flows, session handling, RBAC/ABAC, token hygiene.
- `secrets-and-config-safety` — secret sources, env var discipline, config drift.

### Quality (3, rewritten)

- `test-strategy-enforcement` — pyramid, unit/integration/e2e split, flake hygiene.
- `coverage-gap-detection` — untested critical paths.
- `regression-risk-check` — blast radius on changed code.

### Ops & risk (5, rewritten)

- `change-risk-evaluation` — overall risk posture of a change.
- `rollback-planning` — rollback path for every risky change.
- `infra-safe-change` — Terraform/IaC safety.
- `aws-deploy-safety` — AWS-specific deploy concerns (roles, blue/green, Secrets Manager).
- `observability-first-debugging` — logs/metrics/traces-first debugging discipline.

### New (6)

- `performance-budget-guard` — Core Web Vitals, bundle budgets, query p95, memoization, streaming/SSR, cache.
- `resilience-and-error-handling` — error boundaries, retries with jitter, timeouts, circuit breakers, idempotency, graceful degradation.
- `typescript-rigor` — strict mode, no-any, exhaustive switches, branded/nominal types, discriminated unions, zod-parsed boundaries.
- `accessibility-guard` — WCAG 2.2 AA, keyboard nav, focus management, ARIA correctness, contrast, reduced-motion.
- `cicd-pipeline-safety` — GitHub Actions integrity, OIDC, artifact signing, env promotion, required checks.
- `supply-chain-and-dependencies` — lockfile discipline, SCA, pinned versions, license policy, peer-dep drift.

## 5. Cross-cutting baseline (shared `_baseline` skill)

Assumed by every other skill. Each skill opens with `Assumes _baseline. Adds:` and only covers its domain-specific content.

**TypeScript**

- `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`.
- No `any`; no `@ts-ignore` without a comment citing the reason.
- Zod (or equivalent) parses at every untrusted boundary (HTTP, queue, env, FS).
- Exhaustive `switch` with a `never` guard.

**Security-by-default**

- Input validated at the boundary; DTOs are not trusted beyond it.
- Secrets from a secret manager, never from code or plaintext env files in the repo.
- Least-privilege IAM; no `*` in policy `Action` or `Resource`.
- AuthN before authZ; authZ checked on every endpoint, not just the UI.
- SQL only via Prisma; no `$queryRawUnsafe` with interpolated input.

**Observability floor**

- Structured JSON logs with `requestId` / `correlationId`.
- Errors logged with context and cause chain; never swallowed.
- Metrics for p50/p95/p99 and error rate on every handler.
- Traces span service boundaries.

**Testing floor**

- Unit: pure logic, >80% on business rules.
- Integration: DB + HTTP boundaries, real Postgres via testcontainers (not mocked).
- E2E: critical user journeys only (Playwright).
- No snapshot tests for logic; no mocked DB for repository tests.

**Accessibility floor (any UI)**

- WCAG 2.2 AA.
- Keyboard reachable, visible focus ring, correct tab order.
- Respects `prefers-reduced-motion`.
- Form inputs labelled; errors announced to assistive tech.

**Performance floor**

- Web: LCP < 2.5s, INP < 200ms, CLS < 0.1 on p75 mobile.
- API: p95 < 300ms reads, < 800ms writes (per-endpoint budgets override).
- DB: every query has an index path; no full-table scans over 10k rows.
- Bundle: per-route JS budget (e.g. 170KB gzipped), monitored in CI.

**Resilience floor**

- Every network call has a timeout.
- Every retry uses exponential backoff with jitter and a cap.
- Idempotency keys on every non-GET external call.
- Circuit breakers on 3rd-party integrations.

## 6. Assumed stack & library picks

Skills are generic in spirit but pin concrete defaults so advice is not vague.

**Runtime & language**

- Node.js LTS (22.x), TypeScript 5.6+, pnpm monorepos, ESM.

**Web**

- Next.js 15+ App Router, React 19.
- Server Components by default; `'use client'` only at leaves.
- TanStack Query for server state on the client; React Context only for truly shared UI state.
- React Hook Form + Zod for forms.
- Tailwind + a design system (kept agnostic; referenced as "your design system").

**Backend**

- NestJS 11.
- class-validator / class-transformer for DTOs (Zod optional at the edge).
- Pino for logging, OpenTelemetry for traces.

**Data**

- Prisma 6 + PostgreSQL 16.
- Migrations via `prisma migrate`; never `db push` in prod paths.
- Testcontainers for integration tests.

**AWS**

- ECS Fargate or Lambda (skills accept either).
- RDS Postgres, SQS for queues, EventBridge for events.
- Secrets Manager for secrets, Parameter Store for config.
- CloudWatch + X-Ray for observability; OIDC for GitHub Actions → AWS.

**Testing**

- Vitest (unit/integration), Playwright (e2e), Testing Library (React).
- MSW for HTTP mocks at component level only; real services at integration level.

**CI/CD**

- GitHub Actions, OIDC to AWS (no long-lived keys), required status checks, branch protection.

**Mobile**

- React Native + Expo (EAS Build/Update).

## 7. Skill interaction map (overlap rules)

These overlaps exist by design; each skill states the handoff explicitly.

- `architecture-guard` owns **cross-service** boundaries; `nextjs-app-structure-guard` and `nestjs-service-boundary-guard` own **intra-app** structure.
- `frontend-implementation-guard` owns component structure; `accessibility-guard` owns a11y; `performance-budget-guard` owns perf. A frontend review touches all three.
- `change-risk-evaluation` is the entry point for risk assessment; `regression-risk-check` focuses on the changed surface; `rollback-planning` prescribes the reverse path. They form a chain, not duplicates.
- `resilience-and-error-handling` owns the code patterns; `queue-and-retry-safety` owns queue-specific semantics; `integration-contract-safety` owns contract stability. A webhook consumer triggers all three.
- `typescript-rigor` is a prerequisite for every other skill's code examples and enforcement.

## 8. Execution plan (batches)

Each batch is reviewed and committed before the next starts. Spec review and user approval gate each hand-off.

0. **Foundation.** Write `_baseline/SKILL.md` and a skill authoring guide at `docs/superpowers/skill-authoring-guide.md` that codifies section 3 of this spec. Update `README.md` to reflect the new lineup.
1. **TypeScript & architecture.** `typescript-rigor`, `architecture-guard`, `nextjs-app-structure-guard`, `nestjs-service-boundary-guard`.
2. **Data & state.** `prisma-data-access-guard`, `state-integrity-check`.
3. **Security.** `auth-and-permissions-safety`, `secrets-and-config-safety`.
4. **Frontend quality.** `frontend-implementation-guard`, `accessibility-guard`, `performance-budget-guard`.
5. **Integration & async.** `integration-contract-safety`, `queue-and-retry-safety`, `resilience-and-error-handling`.
6. **Testing & risk.** `test-strategy-enforcement`, `coverage-gap-detection`, `regression-risk-check`, `change-risk-evaluation`.
7. **Ops.** `observability-first-debugging`, `rollback-planning`, `infra-safe-change`, `aws-deploy-safety`, `cicd-pipeline-safety`, `supply-chain-and-dependencies`.
8. **Mobile.** `mobile-implementation-guard`.

## 9. Out of scope

- Hooks, agents, MCP configuration — no changes in this project.
- Solto-specific conventions (could be layered on top later as a separate skill set).
- Skill file format beyond `SKILL.md` (no references, no scripts).
- Tooling to lint or validate skills automatically.

## 10. Success criteria

- All 25 skills exist under `skills/` with the template shape in section 3.
- Each skill's `description` field is specific enough that Claude picks the right one without overlap confusion.
- `_baseline/SKILL.md` exists and is referenced from every other skill.
- `README.md` lists the new lineup accurately.
- A dry-run on a sample PR triggers at most 3 overlapping skills, and their outputs complement rather than duplicate each other.
