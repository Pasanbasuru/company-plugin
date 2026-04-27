# Skills Library Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the 19 thin SKILL.md files in `global-plugin/skills/` into 25 production-grade skills (19 rewritten + 6 new) plus a shared `_baseline` skill and a skill authoring guide. Each skill is one `SKILL.md` file (no `references/`), runs in hybrid guide + review mode, and encodes generic industry best-practice for the React/Next.js, NestJS, Prisma/Postgres, AWS stack.

**Architecture:** Every skill is a folder containing a single `SKILL.md`. A shared `_baseline/SKILL.md` defines cross-cutting standards (TypeScript, security, testing, observability, accessibility, performance, resilience). Every other skill opens with `Assumes _baseline. Adds:` and only covers domain-specific content. Skills have explicit interaction/ownership notes to prevent overlap confusion.

**Tech Stack:** Markdown + YAML frontmatter. Design spec at `docs/superpowers/specs/2026-04-22-skills-library-overhaul-design.md`.

---

## File Structure

Created / modified in this plan:

```
skills/_baseline/SKILL.md                          # new, shared baseline
skills/typescript-rigor/SKILL.md                   # new
skills/accessibility-guard/SKILL.md                # new
skills/performance-budget-guard/SKILL.md           # new
skills/resilience-and-error-handling/SKILL.md      # new
skills/cicd-pipeline-safety/SKILL.md               # new
skills/supply-chain-and-dependencies/SKILL.md      # new

skills/architecture-guard/SKILL.md                 # rewrite
skills/nextjs-app-structure-guard/SKILL.md         # rewrite
skills/nestjs-service-boundary-guard/SKILL.md      # rewrite
skills/frontend-implementation-guard/SKILL.md      # rewrite
skills/mobile-implementation-guard/SKILL.md        # rewrite
skills/prisma-data-access-guard/SKILL.md           # rewrite
skills/state-integrity-check/SKILL.md              # rewrite
skills/integration-contract-safety/SKILL.md        # rewrite
skills/queue-and-retry-safety/SKILL.md             # rewrite
skills/auth-and-permissions-safety/SKILL.md        # rewrite
skills/secrets-and-config-safety/SKILL.md          # rewrite
skills/test-strategy-enforcement/SKILL.md          # rewrite
skills/coverage-gap-detection/SKILL.md             # rewrite
skills/regression-risk-check/SKILL.md              # rewrite
skills/change-risk-evaluation/SKILL.md             # rewrite
skills/rollback-planning/SKILL.md                  # rewrite
skills/infra-safe-change/SKILL.md                  # rewrite
skills/aws-deploy-safety/SKILL.md                  # rewrite
skills/observability-first-debugging/SKILL.md      # rewrite

docs/superpowers/skill-authoring-guide.md          # new
README.md                                          # update
```

---

## Skill body template (applied by every task below)

Every `SKILL.md` for a domain skill (not `_baseline`) follows this exact section order:

```
---
name: <skill-name>
description: Use when <trigger>. Do NOT use for <anti-trigger>. Covers <X, Y, Z>.
allowed-tools: Read, Grep, Glob, Bash
---

# <Skill Title>

## Purpose & scope
<2–3 sentences>

## Assumes `_baseline`. Adds:
<one-line link>

## Core rules
1. **<rule>** — *Why:* <one line>
2. ...

## Red flags
| Thought | Reality |
|---|---|
| "..." | "..." |

## Good vs bad
### <Pattern name>
Bad:
```ts
...
```
Good:
```ts
...
```

## <Deep-dive section headings as listed per task>

## Interactions with other skills
- **Owns:** <scope>
- **Hands off to:** <skill> for <concern>
- **Does not duplicate:** <skill>'s <concern>

## Review checklist (invoke when reviewing existing code)

Produce a markdown report with these sections:

1. **Summary** — one line: pass / concerns / blocking issues.
2. **Findings** — per issue: *File:line, severity (low/med/high), category, what's wrong, recommended fix*.
3. **Safer alternative** — if an anti-pattern is widespread, prescribe the replacement.
4. **Checklist coverage** — for each rule, mark: PASS / CONCERN / NOT APPLICABLE.
```

The template above is **referenced** by every skill task — do not re-copy the frame in each task, only fill in the content.

---

## Task 1: Create `_baseline` skill

**Files:**
- Create: `skills/_baseline/SKILL.md`

- [ ] **Step 1: Create the baseline skill file**

Write `skills/_baseline/SKILL.md` with exactly this content:

````markdown
---
name: _baseline
description: Use as the shared foundation referenced by every other skill in this library. Do NOT invoke standalone for review — this captures cross-cutting standards (TypeScript, security, observability, testing, accessibility, performance, resilience) that every domain skill assumes.
allowed-tools: Read, Grep, Glob
---

# Baseline standards

## Purpose

Cross-cutting standards every other skill in this library assumes. Each domain skill opens with `Assumes _baseline. Adds:` and only covers its domain. If something here is violated, the domain skill does not have to restate it — it fails baseline.

## TypeScript

1. `tsconfig.json` must set `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `exactOptionalPropertyTypes: true`.
2. No `any`. No `@ts-ignore` or `@ts-expect-error` without a comment citing the reason and a ticket or issue link.
3. Zod (or equivalent schema library) parses every value crossing an untrusted boundary: HTTP body/query/params, queue messages, file input, environment variables, third-party API responses.
4. Exhaustive `switch` statements end with a `default` branch that assigns to a `never`-typed variable.
5. Prefer discriminated unions over optional fields + flags; prefer branded types for IDs to avoid mixing them.

## Security-by-default

1. Input validated at the boundary; DTOs are not trusted beyond the validator.
2. Secrets come from a secret manager (AWS Secrets Manager / Parameter Store). Never from source, never from plaintext env files in the repo.
3. Least-privilege IAM. No `*` in policy `Action` or `Resource`. No wildcard S3 buckets.
4. AuthN before authZ. AuthZ checked on every endpoint — UI guards are cosmetic.
5. SQL only via Prisma client methods. No `$queryRawUnsafe` with user-interpolated input; `$queryRaw` with tagged templates only when parameterised.
6. No PII in logs or error messages. Hash or redact before logging.
7. Output encoding: trust the framework (React, Next.js) for HTML escaping; never use `dangerouslySetInnerHTML` with untrusted data.

## Observability floor

1. Structured JSON logs with `requestId` / `correlationId` propagated across service boundaries.
2. Errors logged with full context (inputs summary, user id if present, cause chain). Never swallow an error silently.
3. Metrics for p50/p95/p99 and error rate on every HTTP handler and queue consumer.
4. Traces span service boundaries (OpenTelemetry).

## Testing floor

1. **Unit:** pure logic, fast, >80% line coverage on business rules.
2. **Integration:** DB + HTTP boundaries. Real Postgres via testcontainers. Not mocked.
3. **E2E:** critical user journeys only, Playwright.
4. No snapshot tests for logic. No mocked DBs for repository tests.
5. Tests must be deterministic. No `sleep`, no real clocks, no network to the real internet.

## Accessibility floor (any UI)

1. WCAG 2.2 AA.
2. Keyboard reachable, visible focus ring, correct tab order.
3. Respects `prefers-reduced-motion`.
4. Form inputs labelled; errors announced to assistive tech.
5. Colour not the sole indicator of meaning.

## Performance floor

1. **Web:** LCP < 2.5s, INP < 200ms, CLS < 0.1 on p75 mobile.
2. **API:** p95 < 300ms for reads, < 800ms for writes (per-endpoint budgets override).
3. **DB:** every query has an index path; no full-table scans over 10k rows.
4. **Bundle:** per-route JS budget (e.g. 170KB gzipped), monitored in CI.

## Resilience floor

1. Every network call has a timeout.
2. Every retry uses exponential backoff with jitter and a cap (max attempts and max delay).
3. Idempotency keys on every non-GET external call.
4. Circuit breakers on 3rd-party integrations.
5. No unbounded promise chains; every background task has a supervisor.

## Stack assumed by skills

- Node.js 22 LTS, TypeScript 5.6+, pnpm monorepos, ESM.
- Next.js 15+ App Router, React 19.
- NestJS 11, class-validator / class-transformer.
- Prisma 6, PostgreSQL 16.
- Pino, OpenTelemetry.
- AWS: ECS Fargate or Lambda, RDS Postgres, SQS, EventBridge, Secrets Manager, CloudWatch, X-Ray.
- GitHub Actions with OIDC to AWS.
- Vitest, Playwright, Testing Library, MSW, Testcontainers.
- React Native + Expo for mobile.
````

- [ ] **Step 2: Verify structure**

Run: `test -f skills/_baseline/SKILL.md && grep -c '^##' skills/_baseline/SKILL.md`
Expected: file exists and contains at least 9 `##` headings.

- [ ] **Step 3: Commit**

```bash
git add skills/_baseline/SKILL.md
git commit -m "feat(skills): add _baseline shared standards skill"
```

---

## Task 2: Write the skill authoring guide

**Files:**
- Create: `docs/superpowers/skill-authoring-guide.md`

- [ ] **Step 1: Write the guide**

Write `docs/superpowers/skill-authoring-guide.md` with this content:

````markdown
# Skill authoring guide

How to write a `SKILL.md` for the `global-plugin` library. Read this before creating or rewriting a skill.

## File layout

One folder per skill, one file per folder:

```
skills/<skill-name>/SKILL.md
```

No `references/`, no scripts, no assets.

## Section order

Every domain skill's `SKILL.md` follows this exact order:

1. **YAML frontmatter** with `name`, `description`, `allowed-tools`.
2. `# <Skill Title>`
3. `## Purpose & scope` — 2–3 sentences.
4. `` ## Assumes `_baseline`. Adds: `` — one line naming the additional domain.
5. `## Core rules` — numbered list. Each rule is one sentence + a `*Why:*` line.
6. `## Red flags` — table of `Thought | Reality` pairs.
7. `## Good vs bad` — 2–3 subsections, each with a `Bad:` and `Good:` code block.
8. Domain-specific `##` sections (deep dives).
9. `## Interactions with other skills` — explicit owns / hands-off / does-not-duplicate bullets.
10. `## Review checklist` — prescribed report format for review-mode invocations.

## Writing the `description`

The frontmatter `description` is how Claude decides whether to apply the skill. It must contain:

- **Use when** — the trigger.
- **Do NOT use for** — the anti-trigger (at least one).
- **Covers** — comma-separated scope tags.

Example:

```yaml
description: Use when touching Prisma queries, schema, or migrations. Do NOT use for schema design decisions without a concrete query (use architecture-guard instead). Covers query shape, N+1, transactions, migration safety, index usage.
```

## Rule writing

- Each rule is imperative ("Do X", "Never Y"), not aspirational ("Try to X").
- Each rule ends with a `*Why:*` line giving the consequence of breaking it.
- A rule must be testable — a reviewer must be able to say PASS, CONCERN, or NOT APPLICABLE.

## Red flags

A thought Claude might have that signals the skill is being ignored, paired with why it's wrong.

| Thought | Reality |
|---|---|
| "This query is simple, no transaction needed" | Two writes without a transaction is a partial-failure bug. |

## Good vs bad snippets

Keep each snippet under 20 lines. Only snippets that illustrate a rule from `Core rules` — no generic examples.

## Interactions

State ownership explicitly. If two skills could apply, say who owns what:

```
- **Owns:** query shape, transactions, migrations.
- **Hands off to:** state-integrity-check for cache invalidation after writes.
- **Does not duplicate:** architecture-guard's schema ownership concerns.
```

## Review checklist

Prescribe a markdown report with four sections: Summary, Findings (file:line, severity, category, fix), Safer alternative, Checklist coverage (PASS / CONCERN / NOT APPLICABLE per rule).

## What every skill assumes

- `_baseline` is in effect. Do not restate TypeScript strict, observability floor, testing floor, etc.
- The stack pinned in `_baseline` (Next.js 15, NestJS 11, Prisma 6, Postgres 16, Node 22).

## Size target

200–400 lines per `SKILL.md`. If you hit 500+, the skill is doing too much — propose a split.

## Self-review before commit

1. **Placeholder scan:** no `TBD`, `TODO`, `handle appropriately`, `add error handling` without specifics.
2. **Baseline leak:** rules that restate `_baseline` get removed.
3. **Overlap check:** if another skill owns a concern, hand off rather than re-encode.
4. **Testability:** every rule is checkable as PASS / CONCERN / NOT APPLICABLE.
````

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/skill-authoring-guide.md
git commit -m "docs(skills): add skill authoring guide"
```

---

## Task 3: Update README to reflect new lineup

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the "Included skills" section**

Replace the `## Included skills` section of `README.md` (lines 12–36 in the current file) with:

```markdown
## Included skills

Every skill assumes the shared [`_baseline`](skills/_baseline/SKILL.md) for TypeScript strictness, security-by-default, observability, testing, accessibility, performance, and resilience. Skills only document what they add on top.

See [the skill authoring guide](docs/superpowers/skill-authoring-guide.md) for the template.

### Shared foundation
- `_baseline` — cross-cutting standards referenced by every other skill

### Architecture & structure
- `architecture-guard`
- `nextjs-app-structure-guard`
- `nestjs-service-boundary-guard`
- `frontend-implementation-guard`
- `mobile-implementation-guard`

### Data
- `prisma-data-access-guard`
- `state-integrity-check`

### Integration & async
- `integration-contract-safety`
- `queue-and-retry-safety`
- `resilience-and-error-handling`

### Security & config
- `auth-and-permissions-safety`
- `secrets-and-config-safety`

### Quality
- `typescript-rigor`
- `test-strategy-enforcement`
- `coverage-gap-detection`
- `regression-risk-check`

### Frontend quality
- `accessibility-guard`
- `performance-budget-guard`

### Ops & risk
- `change-risk-evaluation`
- `rollback-planning`
- `infra-safe-change`
- `aws-deploy-safety`
- `cicd-pipeline-safety`
- `supply-chain-and-dependencies`
- `observability-first-debugging`
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README to reflect new 25-skill lineup"
```

---

## Task 4: `typescript-rigor` (new)

**Files:**
- Create: `skills/typescript-rigor/SKILL.md`

- [ ] **Step 1: Write the skill**

Write `skills/typescript-rigor/SKILL.md` following the [skill body template](#skill-body-template-applied-by-every-task-below). Required content:

**Frontmatter `description`:** Use when authoring or reviewing TypeScript types, generics, DTOs, or boundary parsing. Do NOT use for runtime/logic review without a type concern. Covers strict compiler options, discriminated unions, branded types, exhaustiveness, zod boundaries, error types.

**Purpose:** Enforce strong type discipline beyond `_baseline`: modelling correctness-by-construction at boundaries and in domain code so invalid states are unrepresentable.

**Assumes `_baseline`. Adds:** type-system rigour on top of baseline TS strictness.

**Core rules (each with a `*Why:*` line):**
1. Prefer discriminated unions to optional + flag patterns — invalid combinations become compile errors.
2. Brand domain IDs (`type UserId = string & { __brand: 'UserId' }`) — prevents passing `OrderId` where `UserId` is expected.
3. Parse, don't validate: Zod schemas return typed, trusted data; downstream code never re-checks.
4. Function signatures accept the narrowest input and return the widest type the caller needs — no `Partial<Everything>`.
5. Errors are typed (`Result<T, E>` or typed error hierarchy) — `catch (e: unknown)` narrows before use.
6. No `Record<string, unknown>` at boundaries — define the shape or use `z.unknown()` then parse.
7. Generics have bounded type parameters; no `<T>` that accepts `any`.

**Red flag topics (table rows):**
- "I'll cast this for now" → casts lie to the compiler and propagate bugs.
- "Just add an optional field" → optional + flag combos hide invariants; use a union.
- "I validated it earlier" → parsing once is cheap; re-checking is an invitation to drift.
- "`any` is fine here, it's internal" → `any` punches a hole; prefer `unknown` + narrow.

**Good vs bad snippets:**
- Discriminated union vs flag field
- Branded ID vs raw string
- `parse` at boundary vs type assertion

**Deep-dive sections:**
- `## Compiler options` (lists required and recommended beyond baseline, e.g. `noPropertyAccessFromIndexSignature`)
- `## Zod at boundaries` (pattern: schema + inferred type, parse in controller/route handler)
- `## Error typing` (Result type or typed exception class pattern)
- `## Migration tactics` (how to remove `any` from an existing codebase incrementally)

**Interactions:**
- **Owns:** type-system usage, boundary parsing typing.
- **Hands off to:** `prisma-data-access-guard` for Prisma-generated types; `nestjs-service-boundary-guard` for DTO validation placement; `integration-contract-safety` for cross-service type contracts.
- **Does not duplicate:** `_baseline`'s `strict: true` requirement — this skill adds rigor on top.

**Review checklist:** per core rule, PASS / CONCERN / NOT APPLICABLE. Flag every `any`, `@ts-ignore`, and untyped boundary with file:line.

- [ ] **Step 2: Verify**

Run: `test -f skills/typescript-rigor/SKILL.md && head -4 skills/typescript-rigor/SKILL.md | grep -q '^name: typescript-rigor'`
Expected: file exists, frontmatter `name` matches.

- [ ] **Step 3: Commit**

```bash
git add skills/typescript-rigor/SKILL.md
git commit -m "feat(skills): add typescript-rigor"
```

---

## Task 5: `architecture-guard` (rewrite)

**Files:**
- Modify (full rewrite): `skills/architecture-guard/SKILL.md`

- [ ] **Step 1: Rewrite the skill**

**Frontmatter `description`:** Use when a change crosses service/app boundaries, adds a new top-level package, or shifts dependency direction in the monorepo. Do NOT use for intra-app structure concerns — use `nextjs-app-structure-guard` or `nestjs-service-boundary-guard` instead. Covers monorepo ownership, dependency direction, shared-package scope, cross-service contracts.

**Purpose:** Keep the monorepo's shape healthy — packages have clear owners, dependencies flow one direction, shared code is stable.

**Core rules:**
1. Apps depend on packages; packages never depend on apps — apps are the leaves.
2. Packages form a DAG. A new edge that creates a cycle is rejected.
3. A package has one public `index.ts`; consumers import from the package root only.
4. Shared types live in a `shared-types` (or equivalent) package; services never import each other's internal types.
5. Every new package has an `OWNERS` entry (or CODEOWNERS) and a one-paragraph README describing its responsibility.
6. Test code never imports from a sibling app's source tree.

**Red flag topics:**
- "Just one import from the other app" → that's a package waiting to happen, or a leak.
- "Circular dep is tiny" → tooling breaks later, debugging is miserable.
- "I'll flatten packages for convenience" → monorepos collapse when boundaries vanish.

**Good vs bad snippets:**
- App importing from another app (bad) vs shared package (good)
- Re-exporting internals via deep path (bad) vs importing from package root (good)

**Deep-dive sections:**
- `## Dependency direction rules`
- `## Shared-types package pattern`
- `## Adding a new package (checklist)`
- `## Detecting cycles` (reference `madge`, `dependency-cruiser`)

**Interactions:**
- **Owns:** cross-package / cross-app structure.
- **Hands off to:** `nextjs-app-structure-guard` (intra-Next.js), `nestjs-service-boundary-guard` (intra-NestJS).
- **Does not duplicate:** `integration-contract-safety`'s HTTP/event contract concerns.

**Review checklist:** per rule, PASS / CONCERN / NOT APPLICABLE; list every new cross-package edge with file:line and whether it respects dependency direction.

- [ ] **Step 2: Verify**

Run: `grep -q '^description: Use when a change crosses' skills/architecture-guard/SKILL.md`
Expected: matches.

- [ ] **Step 3: Commit**

```bash
git add skills/architecture-guard/SKILL.md
git commit -m "refactor(skills): rewrite architecture-guard for monorepo boundaries"
```

---

## Task 6: `nextjs-app-structure-guard` (rewrite)

**Files:**
- Modify (full rewrite): `skills/nextjs-app-structure-guard/SKILL.md`

- [ ] **Step 1: Rewrite**

**Frontmatter `description`:** Use when touching a Next.js App Router file — page, layout, route handler, middleware, server action, or a component that crosses the server/client boundary. Do NOT use for pure client component state logic (use `frontend-implementation-guard`) or for data access (use `prisma-data-access-guard`). Covers RSC vs client, route handlers, middleware, server actions, streaming, caching, route groups.

**Purpose:** Keep App Router code aligned with its rendering model — Server Components by default, client components at the leaves, middleware narrow, route handlers thin.

**Core rules:**
1. Server Components are the default. `'use client'` goes on the smallest leaf that needs it.
2. Do not import server-only modules (`fs`, DB clients, secret managers) into client components.
3. Route handlers are thin: parse input (Zod), call a service, return a typed response. No business logic in `route.ts`.
4. Middleware is narrow — authz shortcuts, header manipulation, redirects. No DB calls, no business logic.
5. Server Actions validate input with Zod and re-verify authorization at the top; never trust a hidden form field.
6. Caching is explicit: each fetch declares `cache`, `revalidate`, or `no-store`. Defaults are not assumed.
7. `generateMetadata` and `generateStaticParams` are pure — no side effects, no secret usage.

**Red flag topics:**
- "I'll mark the whole layout 'use client' for convenience" → loses RSC benefits, ships DB client to the browser.
- "Route handler can do the work directly" → violates thin-handler rule; services are testable, handlers aren't as cleanly.
- "Middleware can check the DB" → every request pays the cost; use a session cookie or token claim.

**Good vs bad snippets:**
- `'use client'` at a form (good) vs at the layout root (bad)
- Route handler that validates + delegates (good) vs route handler with embedded business logic (bad)
- `fetch(url, { next: { revalidate: 60 } })` explicit (good) vs default cache assumed (bad)

**Deep-dive sections:**
- `## RSC/client boundary`
- `## Route handler patterns`
- `## Server Actions safety`
- `## Caching and revalidation`
- `## Middleware scope`

**Interactions:**
- **Owns:** Next.js-specific file structure, rendering boundary, caching semantics.
- **Hands off to:** `frontend-implementation-guard` for component composition; `auth-and-permissions-safety` for authz logic; `prisma-data-access-guard` for DB queries inside server functions; `performance-budget-guard` for bundle impact.
- **Does not duplicate:** React component structure concerns.

**Review checklist:** per rule, PASS / CONCERN / NOT APPLICABLE; list every `'use client'` with file:line and whether it could move to a smaller leaf.

- [ ] **Step 2: Commit**

```bash
git add skills/nextjs-app-structure-guard/SKILL.md
git commit -m "refactor(skills): rewrite nextjs-app-structure-guard"
```

---

## Task 7: `nestjs-service-boundary-guard` (rewrite)

**Files:**
- Modify (full rewrite): `skills/nestjs-service-boundary-guard/SKILL.md`

- [ ] **Step 1: Rewrite**

**Frontmatter `description`:** Use when touching a NestJS module, controller, provider, or DTO. Do NOT use for database query shape (use `prisma-data-access-guard`) or for cross-service contracts (use `integration-contract-safety`). Covers module ownership, provider scope, controller/service split, DTO validation, transaction placement, cross-module coupling.

**Purpose:** Keep NestJS codebases maintainable — each module owns a domain, controllers are thin, services hold logic, DTOs validate everything that crosses in.

**Core rules:**
1. Controllers are thin: validate (DTO), authorize, delegate to a service, shape the response. No business logic.
2. Services are stateless. State lives in DB or injected caches.
3. A module exports only what other modules must consume. Internals stay internal.
4. Cross-module imports go through a feature module's exported API, not its internal providers.
5. Transactions are started in services or explicit use-cases, never in controllers or repositories.
6. DTOs use `class-validator` decorators and `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true`.
7. Guards/interceptors/pipes are registered at the most specific scope that works (route > controller > module > global).

**Red flag topics:**
- "I'll put the transaction in the controller, it's just one" → controllers become transaction managers; bad separation.
- "Services can reach into other services' repositories" → you've lost module boundaries.
- "DTO is `any` for flexibility" → hostile input reaches your logic.

**Good vs bad snippets:**
- Thin controller (good) vs fat controller (bad)
- Module exporting a facade (good) vs module exporting all providers (bad)
- Transaction in a use-case (good) vs transaction spread across controller + service (bad)

**Deep-dive sections:**
- `## Module boundaries`
- `## Controller/service split`
- `## Transaction placement`
- `## DTO validation patterns`
- `## Guard/interceptor/pipe scope`

**Interactions:**
- **Owns:** module/provider structure, controller discipline, DTO validation, transaction scope.
- **Hands off to:** `prisma-data-access-guard` for query shape inside services; `integration-contract-safety` for cross-service HTTP/event payloads; `auth-and-permissions-safety` for guard logic.
- **Does not duplicate:** `architecture-guard`'s cross-package concerns.

**Review checklist:** per rule, PASS / CONCERN / NOT APPLICABLE; list every controller with logic beyond validate/authorize/delegate/shape.

- [ ] **Step 2: Commit**

```bash
git add skills/nestjs-service-boundary-guard/SKILL.md
git commit -m "refactor(skills): rewrite nestjs-service-boundary-guard"
```

---

## Task 8: `prisma-data-access-guard` (rewrite)

**Files:**
- Modify (full rewrite): `skills/prisma-data-access-guard/SKILL.md`

- [ ] **Step 1: Rewrite**

**Frontmatter `description`:** Use when touching Prisma queries, schema, or migrations. Do NOT use for schema design decisions without a concrete query (use `architecture-guard`). Covers query shape, N+1, transactions, migration safety, indexes, raw SQL safety, selection shape.

**Purpose:** Prevent data-access landmines — N+1 queries, unsafe raw SQL, partial-failure writes, and migrations that lock production tables.

**Core rules:**
1. `select` exactly what's needed — never return full rows by default.
2. Loops over related data use `include` or a single `in` query, never `await` inside the loop.
3. Multi-write operations use `prisma.$transaction`. Reads that must be consistent use an interactive transaction.
4. `findMany` without `take` is a bug — unbounded results ship everything to memory.
5. Every high-cardinality `where` field has a matching index in `schema.prisma`.
6. Migrations are reversible (or have a documented forward-only justification) and avoid `ALTER TABLE … NOT NULL` on large tables without a backfill strategy.
7. `$queryRaw` uses tagged templates only. `$queryRawUnsafe` is forbidden for user-controlled input.
8. `prisma db push` is for local prototyping only. Production uses `prisma migrate deploy` against versioned migrations.

**Red flag topics:**
- "I'll await inside the map" → N+1.
- "This is a small migration, no backfill needed" → large tables lock, prod goes down.
- "I need raw SQL just for speed" → prefer Prisma methods; if truly needed, tagged template + explain plan.
- "No index — table is small today" → today is not production at scale.

**Good vs bad snippets:**
- N+1 via await-in-loop (bad) vs `include` (good)
- Transaction wrapping two writes (good) vs sequential writes (bad)
- `$queryRawUnsafe` with interpolation (bad) vs `$queryRaw` tagged template (good)

**Deep-dive sections:**
- `## Query shape and over-fetching`
- `## N+1 detection`
- `## Transaction semantics (interactive vs sequential)`
- `## Migration safety (locks, backfills, downtime)`
- `## Indexing strategy`
- `## When to drop to raw SQL (rare)`

**Interactions:**
- **Owns:** query shape, transactions, migrations, indexes.
- **Hands off to:** `state-integrity-check` for cache invalidation after writes; `performance-budget-guard` for query p95 budgets.
- **Does not duplicate:** `architecture-guard`'s schema ownership.

**Review checklist:** per rule, PASS / CONCERN / NOT APPLICABLE; list every `findMany` without `take`, every `await` inside a loop over Prisma, every `$queryRawUnsafe`.

- [ ] **Step 2: Commit**

```bash
git add skills/prisma-data-access-guard/SKILL.md
git commit -m "refactor(skills): rewrite prisma-data-access-guard"
```

---

## Task 9: `state-integrity-check` (rewrite)

**Files:**
- Modify (full rewrite): `skills/state-integrity-check/SKILL.md`

- [ ] **Step 1: Rewrite**

**Frontmatter `description`:** Use when a change writes data AND the UI caches or optimistically updates that data, or when cache/invalidation behaviour changes on either side. Do NOT use for pure DB write review (use `prisma-data-access-guard`) or pure UI state shape (use `frontend-implementation-guard`). Covers cache invalidation, optimistic updates, server/client divergence, stale reads.

**Purpose:** Prevent the class of bug where the DB says one thing and a user's screen says another — stale caches, missed invalidations, optimistic updates that don't reconcile.

**Core rules:**
1. Every mutation invalidates or updates the specific TanStack Query keys that depend on it. No blind `invalidateQueries()`.
2. Optimistic updates include an `onError` rollback and an `onSettled` refetch.
3. Server-returned data is the source of truth after a mutation; client state is never trusted across a reload.
4. Next.js server mutations use `revalidatePath` / `revalidateTag` explicitly; no hope-and-pray cache behaviour.
5. Cross-tab sync (storage event / broadcast channel) is explicit when the app has multi-tab scenarios.
6. Subscription-based state (WebSocket) includes reconnect-and-replay logic; no assuming the socket stayed open.

**Red flag topics:**
- "I'll just invalidate everything" → heavy, wasteful, masks bugs.
- "Optimistic update without rollback" → drift stays if the server rejects.
- "Cache TTL handles it" → users see stale data for exactly the wrong duration.

**Good vs bad snippets:**
- Targeted `invalidateQueries({ queryKey })` (good) vs blind invalidate (bad)
- Optimistic update with rollback + refetch (good) vs fire-and-forget (bad)
- Explicit `revalidateTag('orders')` (good) vs implicit revalidate (bad)

**Deep-dive sections:**
- `## TanStack Query invalidation patterns`
- `## Optimistic update pattern (with rollback)`
- `## Next.js revalidation (path, tag, time-based)`
- `## Cross-tab and WebSocket consistency`

**Interactions:**
- **Owns:** server/client state consistency, cache invalidation discipline.
- **Hands off to:** `prisma-data-access-guard` for the write itself; `frontend-implementation-guard` for where state lives in the component tree.
- **Does not duplicate:** `resilience-and-error-handling`'s retry semantics.

**Review checklist:** per rule, PASS / CONCERN / NOT APPLICABLE; list every mutation without an invalidation step.

- [ ] **Step 2: Commit**

```bash
git add skills/state-integrity-check/SKILL.md
git commit -m "refactor(skills): rewrite state-integrity-check"
```

---

## Task 10: `auth-and-permissions-safety` (rewrite)

**Files:**
- Modify (full rewrite): `skills/auth-and-permissions-safety/SKILL.md`

- [ ] **Step 1: Rewrite**

**Frontmatter `description`:** Use when touching authentication, sessions, JWT/tokens, RBAC/ABAC logic, or any route/handler/procedure that accesses user data. Do NOT use for infra-level IAM (use `infra-safe-change` / `aws-deploy-safety`). Covers authN flows, session/token hygiene, RBAC/ABAC checks, CSRF, permission inheritance.

**Purpose:** Ensure every request is authenticated correctly and authorized on the server for the specific resource, not just the endpoint.

**Core rules:**
1. AuthZ is checked on every endpoint — including read endpoints. UI-only guards are advisory.
2. Permission checks are resource-scoped: "can user X read order Y", not just "can user X read orders".
3. Sessions: HTTP-only, secure, SameSite=Lax (or Strict when feasible). Rotate on privilege change, invalidate on logout.
4. JWTs: short-lived access token + refresh token; verify `iss`, `aud`, `exp`, `nbf`; no symmetric secrets in the client.
5. CSRF defence on cookie-based auth (token or SameSite=Strict + Origin check).
6. Rate-limit auth endpoints (login, password reset, MFA) separately from normal traffic.
7. Password reset, email change, MFA: require step-up auth (re-enter password or second factor).
8. Don't leak existence: login/reset responses don't reveal whether an email is registered.

**Red flag topics:**
- "The UI hides the button" → back-end must still refuse.
- "Same secret client-side and server-side, simpler" → client secrets are public.
- "Long-lived session, user convenience" → compromise window = session lifetime.
- "We'll rate-limit the whole API, login is fine" → credential stuffing thrives.

**Good vs bad snippets:**
- Resource-scoped check (good) vs role-only check (bad)
- Short-lived JWT + refresh (good) vs long-lived JWT (bad)
- Step-up before sensitive change (good) vs implicit trust from session (bad)

**Deep-dive sections:**
- `## Session vs token trade-offs`
- `## RBAC, ABAC, and resource scoping`
- `## CSRF strategy`
- `## Step-up authentication`
- `## Auth error responses (no enumeration)`

**Interactions:**
- **Owns:** app-level authN/authZ logic, session/token handling.
- **Hands off to:** `infra-safe-change` for IAM roles; `secrets-and-config-safety` for key storage; `nextjs-app-structure-guard` for middleware scope.
- **Does not duplicate:** `integration-contract-safety`'s API versioning concerns.

**Review checklist:** per rule, PASS / CONCERN / NOT APPLICABLE; list every endpoint touched and whether it checks resource-scoped permission.

- [ ] **Step 2: Commit**

```bash
git add skills/auth-and-permissions-safety/SKILL.md
git commit -m "refactor(skills): rewrite auth-and-permissions-safety"
```

---

## Task 11: `secrets-and-config-safety` (rewrite)

**Files:**
- Modify (full rewrite): `skills/secrets-and-config-safety/SKILL.md`

- [ ] **Step 1: Rewrite**

**Frontmatter `description`:** Use when touching environment variables, secret references, or config that varies across environments. Do NOT use for IAM policy review (use `infra-safe-change`) or runtime observability (use `observability-first-debugging`). Covers secret sourcing, env var discipline, config drift, client-vs-server env boundaries, secret rotation awareness.

**Purpose:** Keep secrets out of source, out of logs, and out of the client bundle; keep config predictable across environments.

**Core rules:**
1. Secrets come from AWS Secrets Manager (runtime pull) or injected at deploy time — never committed, never in plaintext env files in the repo.
2. `.env.example` (or equivalent) is committed; real `.env` files are `.gitignore`d and never shared in chat.
3. Env vars are validated on startup with Zod — fail fast with a clear message if missing.
4. Next.js: server-only secrets never go in `NEXT_PUBLIC_*`. Every `NEXT_PUBLIC_*` variable is reviewed before merge.
5. No secret reaches a log line. Log the *fact* of a secret's presence, not its value.
6. Rotation is assumed: code reads secrets fresh (or on a cache with TTL), not once at process start, for rotated credentials.
7. Feature flags and config that differ by environment live in a config store (Parameter Store, LaunchDarkly, etc.), not hard-coded.

**Red flag topics:**
- "I'll commit it, we rotate later" → never rotated.
- "It's just staging, paste it in chat" → secrets propagate.
- "Caching secret at boot is fine" → rotation breaks the service.

**Good vs bad snippets:**
- Zod-validated env at startup (good) vs direct `process.env.FOO` access (bad)
- Secret fetched from Secrets Manager with cache TTL (good) vs baked-in at image build (bad)

**Deep-dive sections:**
- `## Env validation pattern (Zod at startup)`
- `## Next.js `NEXT_PUBLIC_*` discipline`
- `## Secret rotation-ready patterns`
- `## Config store vs env vars`

**Interactions:**
- **Owns:** secret sourcing and env/config discipline in application code.
- **Hands off to:** `infra-safe-change` for how Secrets Manager / Parameter Store is provisioned; `aws-deploy-safety` for role-based fetch permissions; `cicd-pipeline-safety` for CI secret injection.
- **Does not duplicate:** `auth-and-permissions-safety`'s session/token handling.

**Review checklist:** per rule, PASS / CONCERN / NOT APPLICABLE; list every `process.env.X` without validation, every `NEXT_PUBLIC_*` added.

- [ ] **Step 2: Commit**

```bash
git add skills/secrets-and-config-safety/SKILL.md
git commit -m "refactor(skills): rewrite secrets-and-config-safety"
```

---

## Task 12: `frontend-implementation-guard` (rewrite, a11y moved out)

**Files:**
- Modify (full rewrite): `skills/frontend-implementation-guard/SKILL.md`

- [ ] **Step 1: Rewrite**

**Frontmatter `description`:** Use when writing or reviewing React components, hooks, component-level state, or data-fetching at the component layer. Do NOT use for Next.js routing/rendering structure (use `nextjs-app-structure-guard`), accessibility (use `accessibility-guard`), or bundle/runtime perf (use `performance-budget-guard`). Covers component structure, state placement, data flow, hook discipline, composition.

**Purpose:** Keep the React layer clean — components are focused, state lives at the right level, hooks follow the rules, composition beats inheritance of concerns.

**Core rules:**
1. A component does one thing. Split when it exceeds ~150 lines or handles unrelated concerns.
2. Business logic lives in hooks or services, not in JSX render bodies.
3. State lives at the lowest common ancestor that needs it. Lifted further only for a concrete reason.
4. Server state (data from the API) is owned by TanStack Query, not by `useState` or Context.
5. Context is for truly app-wide, low-churn values (theme, auth). Not for frequently-updated data.
6. Hook rules are enforced with `eslint-plugin-react-hooks`; warnings block merge.
7. Prop shapes are typed; no `...props: any`. Prefer discriminated props over boolean flags when a component renders differently per variant.

**Red flag topics:**
- "I'll use Context for this list that updates every keystroke" → everything re-renders.
- "useEffect to sync server state" → TanStack Query owns that.
- "Boolean flag for the 'error' variant AND the 'loading' variant" → discriminated union is clearer.

**Good vs bad snippets:**
- TanStack Query for server state (good) vs `useEffect` + `useState` (bad)
- Discriminated variant prop (good) vs parallel booleans (bad)
- State at LCA (good) vs global Context misuse (bad)

**Deep-dive sections:**
- `## Component decomposition heuristics`
- `## State placement`
- `## Server state vs client state`
- `## Context: when it's right`
- `## Hook rules and custom hook design`

**Interactions:**
- **Owns:** React component structure, state placement, client data flow.
- **Hands off to:** `nextjs-app-structure-guard` for server/client boundary; `accessibility-guard` for a11y; `performance-budget-guard` for memoization and bundle impact; `state-integrity-check` for cache invalidation.
- **Does not duplicate:** any rendering-strategy concerns.

**Review checklist:** per rule, PASS / CONCERN / NOT APPLICABLE; flag components over 150 lines, every `useEffect` that syncs server data, every Context misuse.

- [ ] **Step 2: Commit**

```bash
git add skills/frontend-implementation-guard/SKILL.md
git commit -m "refactor(skills): rewrite frontend-implementation-guard (a11y extracted)"
```

---

## Task 13: `accessibility-guard` (new)

**Files:**
- Create: `skills/accessibility-guard/SKILL.md`

- [ ] **Step 1: Write**

**Frontmatter `description`:** Use when writing or reviewing any UI — web or mobile — that a user interacts with. Do NOT skip this for "internal tools"; internal users also use assistive tech. Covers WCAG 2.2 AA, keyboard navigation, focus management, ARIA correctness, colour contrast, reduced motion, form accessibility.

**Purpose:** Ensure every interface is usable by people who navigate with keyboards, screen readers, magnifiers, or reduced motion — not a pass at the end, a pass at write time.

**Core rules:**
1. Every interactive element is keyboard-reachable in logical tab order and has a visible focus indicator.
2. Use semantic HTML (`<button>`, `<a>`, `<label>`, `<nav>`, `<main>`) before adding ARIA. ARIA patches semantics; it doesn't replace them.
3. Form inputs have associated `<label>` (via `for` / `htmlFor`). Error messages are linked via `aria-describedby` and announced via `aria-live`.
4. Colour contrast meets WCAG 2.2 AA (4.5:1 for body text, 3:1 for large text and UI components).
5. Focus is managed on route change, modal open/close, and async content insertion — users don't lose their place.
6. Respect `prefers-reduced-motion`: large motion has a reduced variant.
7. Non-text content (icon-only buttons, decorative images) has an `aria-label` or is marked `aria-hidden` as appropriate.
8. Custom widgets follow the WAI-ARIA Authoring Practices pattern (combobox, dialog, tabs, etc.). Do not invent ARIA.

**Red flag topics:**
- "It's a `<div>` with an onClick" → that's a button. Use `<button>`.
- "Focus ring is ugly, `outline: none`" → never, without a replacement indicator.
- "I'll skip a11y, this is admin-only" → admins use screen readers too.
- "ARIA fixes it" → ARIA is a last resort; semantic HTML comes first.

**Good vs bad snippets:**
- `<button>` with icon + `aria-label` (good) vs `<div onClick>` with no keyboard handler (bad)
- Form field with `<label>`, `aria-describedby`, and `aria-live` error (good) vs placeholder-as-label (bad)
- Modal with focus trap + restore (good) vs modal that loses focus (bad)

**Deep-dive sections:**
- `## Keyboard and focus`
- `## Forms and errors`
- `## Colour and contrast`
- `## Motion, animation, and reduced-motion`
- `## ARIA patterns reference` (link WAI-ARIA APG)
- `## Testing a11y` (axe, Playwright a11y, manual screen reader spot-check)

**Interactions:**
- **Owns:** a11y semantics, keyboard, focus, colour contrast, ARIA.
- **Hands off to:** `frontend-implementation-guard` for component structure; `performance-budget-guard` for reduced-motion impact on perf.
- **Does not duplicate:** design-system responsibility (the design system should provide accessible primitives).

**Review checklist:** per rule, PASS / CONCERN / NOT APPLICABLE; run `axe` and include findings; manually keyboard-test critical flows and note result.

- [ ] **Step 2: Commit**

```bash
git add skills/accessibility-guard/SKILL.md
git commit -m "feat(skills): add accessibility-guard"
```

---

## Task 14: `performance-budget-guard` (new)

**Files:**
- Create: `skills/performance-budget-guard/SKILL.md`

- [ ] **Step 1: Write**

**Frontmatter `description`:** Use when adding a new route, new dependency, heavy computation, new DB query on a hot path, or UI that might affect Core Web Vitals. Do NOT use for pure logic correctness review (use `typescript-rigor`) or for DB query shape (use `prisma-data-access-guard`). Covers Core Web Vitals, JS bundle budgets, query p95 budgets, memoization, streaming, caching layers.

**Purpose:** Keep performance from regressing one small decision at a time — every change is checked against concrete budgets before merge.

**Core rules:**
1. Per-route JS bundle budget (e.g. 170KB gzipped) is monitored in CI; a regression above threshold blocks merge until justified.
2. New dependencies are weighed: size, tree-shakability, whether a smaller alternative exists.
3. Hot-path DB queries meet their p95 latency budget; a new query includes a baseline measurement.
4. React memoization (`memo`, `useMemo`, `useCallback`) is applied to the 1% of components it helps, not by reflex.
5. Images are served responsively (Next.js `<Image>`) with explicit `sizes`, correct `priority`, and width/height to prevent CLS.
6. Streaming / Suspense is used where TTFB benefits; static where it's cheap.
7. Cache layers (browser, CDN, Next.js, Redis, Prisma) are explicit — every cache has a written TTL and invalidation story.

**Red flag topics:**
- "Memoize everything, just in case" → overhead without benefit.
- "Pull in the whole library for one function" → bundle bloat.
- "I'll check perf after launch" → regressions compound; check per change.

**Good vs bad snippets:**
- Tree-shaken import (good) vs whole-library import (bad)
- Next.js `<Image priority sizes="…">` (good) vs `<img>` (bad)
- Targeted memo on an expensive subtree (good) vs blanket `React.memo` (bad)

**Deep-dive sections:**
- `## Core Web Vitals budgets and measurement`
- `## Bundle budgets in CI (e.g. `next build` + size-limit)`
- `## Query p95 budgets`
- `## Memoization: when it helps`
- `## Image optimization`
- `## Cache layer topology`

**Interactions:**
- **Owns:** perf budgets on web and API.
- **Hands off to:** `prisma-data-access-guard` for query shape; `nextjs-app-structure-guard` for RSC/streaming decisions; `supply-chain-and-dependencies` for new-dependency review.
- **Does not duplicate:** design-system's CSS performance concerns.

**Review checklist:** per rule, PASS / CONCERN / NOT APPLICABLE; report bundle delta, new-query p95 estimate, image optimization state.

- [ ] **Step 2: Commit**

```bash
git add skills/performance-budget-guard/SKILL.md
git commit -m "feat(skills): add performance-budget-guard"
```

---

## Task 15: `integration-contract-safety` (rewrite)

**Files:**
- Modify (full rewrite): `skills/integration-contract-safety/SKILL.md`

- [ ] **Step 1: Rewrite**

**Frontmatter `description`:** Use when changing a public HTTP API, webhook payload, event schema, or any boundary another team/service depends on. Do NOT use for internal intra-module calls (use `nestjs-service-boundary-guard`). Covers API versioning, breaking-change detection, schema evolution, webhook/event contracts, consumer migration.

**Purpose:** Prevent silent breaking changes across service boundaries — consumers find out in prod otherwise.

**Core rules:**
1. Breaking changes (removed field, type change, new required field, changed semantics) require a new major version or a documented migration window.
2. Additive changes (new optional field, new endpoint) are non-breaking when consumers ignore unknown fields — verify the contract assumption before claiming it.
3. Every public API has a machine-readable contract (OpenAPI, JSON Schema, or similar). Changes to the contract are reviewed before code.
4. Webhook consumers receive signed payloads; signature verification is mandatory before any processing.
5. Event schemas are versioned in the payload (`schemaVersion`); consumers ignore versions they don't understand and log them.
6. Deprecations: `Deprecation` header or documented sunset date; never a silent removal.
7. Contract tests (e.g. Pact, or code-generated client tests) catch mismatches in CI.

**Red flag topics:**
- "Small rename, no one uses that field" → someone does.
- "Webhook validation is slow, skip signature" → replay attacks in one line.
- "Version in the URL, handle breaks later" → versioning without a migration is cosmetic.

**Good vs bad snippets:**
- Additive field with `?` (good) vs changing a field's type (bad)
- Signed webhook verification (good) vs trust on path (bad)
- Versioned event with consumer tolerance (good) vs unversioned event (bad)

**Deep-dive sections:**
- `## Breaking vs additive change taxonomy`
- `## OpenAPI workflow`
- `## Webhook signing and verification`
- `## Event schema versioning`
- `## Deprecation strategy`
- `## Contract testing`

**Interactions:**
- **Owns:** cross-service contracts and their evolution.
- **Hands off to:** `queue-and-retry-safety` for delivery semantics; `resilience-and-error-handling` for consumer retry patterns; `auth-and-permissions-safety` for endpoint authz.
- **Does not duplicate:** `architecture-guard`'s package dependency direction.

**Review checklist:** per rule, PASS / CONCERN / NOT APPLICABLE; classify every contract change as additive / breaking / behavioural and list affected consumers.

- [ ] **Step 2: Commit**

```bash
git add skills/integration-contract-safety/SKILL.md
git commit -m "refactor(skills): rewrite integration-contract-safety"
```

---

## Task 16: `queue-and-retry-safety` (rewrite)

**Files:**
- Modify (full rewrite): `skills/queue-and-retry-safety/SKILL.md`

- [ ] **Step 1: Rewrite**

**Frontmatter `description`:** Use when publishing to or consuming from SQS, EventBridge, or any message queue; also for background jobs with retry semantics. Do NOT use for in-process retries of a function call (use `resilience-and-error-handling`). Covers at-least-once delivery, idempotency keys, DLQ strategy, poison message handling, visibility timeout, ordering.

**Purpose:** Queues are at-least-once by default — duplicate and out-of-order messages are normal. Code must tolerate them without data corruption.

**Core rules:**
1. Every consumer is idempotent. Either the operation is naturally idempotent, or an idempotency key is stored to dedupe.
2. Every queue has a DLQ; every DLQ has an alarm.
3. Visibility timeout > max expected processing time + buffer. Heartbeating required for long jobs.
4. Poison messages (fail > N times) go to DLQ with the original error metadata preserved.
5. Ordering is not assumed unless using FIFO (SQS) with a message group ID; even then, retries break order.
6. Payloads are versioned and validated by the consumer (Zod or equivalent).
7. Publishers include a `correlationId` propagated from the originating request.

**Red flag topics:**
- "Consumer just does the thing" → duplicates silently double-apply.
- "Visibility timeout is the default" → long jobs re-fire and run twice.
- "No DLQ, we retry forever" → a poison message jams the queue forever.

**Good vs bad snippets:**
- Idempotency key stored + checked (good) vs naive "mark processed" (bad)
- Heartbeat during long job (good) vs single long processing step (bad)

**Deep-dive sections:**
- `## At-least-once reality`
- `## Idempotency key patterns`
- `## Visibility timeout and heartbeating`
- `## DLQ topology and alarms`
- `## Ordering caveats (FIFO, MessageGroupId, retries)`

**Interactions:**
- **Owns:** queue delivery semantics, retry policy for queue consumers.
- **Hands off to:** `integration-contract-safety` for payload schema; `resilience-and-error-handling` for in-process retry of downstream calls; `observability-first-debugging` for DLQ alarms.
- **Does not duplicate:** `prisma-data-access-guard`'s transaction semantics.

**Review checklist:** per rule, PASS / CONCERN / NOT APPLICABLE; list every consumer and whether it's idempotent (naturally or via key).

- [ ] **Step 2: Commit**

```bash
git add skills/queue-and-retry-safety/SKILL.md
git commit -m "refactor(skills): rewrite queue-and-retry-safety"
```

---

## Task 17: `resilience-and-error-handling` (new)

**Files:**
- Create: `skills/resilience-and-error-handling/SKILL.md`

- [ ] **Step 1: Write**

**Frontmatter `description`:** Use when code calls a network service, handles an error, sets a timeout, implements a retry, or exposes a user-facing failure path. Do NOT use for queue-specific retry semantics (use `queue-and-retry-safety`). Covers timeouts, retry with jitter, circuit breakers, error boundaries, idempotency of external calls, graceful degradation, typed errors.

**Purpose:** Software fails. Code that assumes happy-path breaks users at 3am. This skill prescribes patterns that fail well.

**Core rules:**
1. Every network call has a timeout. No default-infinite waits.
2. Retries use exponential backoff with jitter, a max-attempts cap, and a max-delay cap. Not all errors are retryable — 4xx (except 408/429) usually isn't.
3. External POSTs include an idempotency key so a retry doesn't duplicate the side effect.
4. Third-party integrations sit behind a circuit breaker. Open circuit → fast-fail with a fallback or a user-visible degraded state.
5. React error boundaries wrap feature surfaces. A crashed feature doesn't crash the app.
6. Errors are typed (either `Result<T, E>` or a typed hierarchy). `catch (e: unknown)` narrows before use.
7. User-facing messages are actionable ("retry", "contact support") and never leak stack traces or internals.
8. Background work has a supervisor or lifecycle owner — no fire-and-forget promises.

**Red flag topics:**
- "I'll just retry 3 times" → thundering herd without jitter; backoff missing.
- "Try/catch and log it, move on" → error swallowed; caller assumes success.
- "No timeout, it's fast usually" → tail latency is your 3am page.
- "await someAsync();" in a loop with no concurrency limit → one slow caller saturates.

**Good vs bad snippets:**
- Timeout + typed retry (good) vs bare `fetch` (bad)
- Circuit breaker wrapper (good) vs direct integration call (bad)
- Error boundary per feature (good) vs single app-level boundary (bad)

**Deep-dive sections:**
- `## Timeouts`
- `## Retry with backoff + jitter`
- `## Idempotency in external POSTs`
- `## Circuit breakers`
- `## React error boundaries`
- `## Typed errors (Result vs exception hierarchy)`
- `## Graceful degradation patterns`

**Interactions:**
- **Owns:** in-process resilience patterns for app code.
- **Hands off to:** `queue-and-retry-safety` for queue-level retry; `observability-first-debugging` for what to log when things fail; `integration-contract-safety` for how upstream contract shapes retry strategy.
- **Does not duplicate:** `frontend-implementation-guard`'s component structure.

**Review checklist:** per rule, PASS / CONCERN / NOT APPLICABLE; list every external call without a timeout, every retry loop without jitter, every catch that swallows.

- [ ] **Step 2: Commit**

```bash
git add skills/resilience-and-error-handling/SKILL.md
git commit -m "feat(skills): add resilience-and-error-handling"
```

---

## Task 18: `test-strategy-enforcement` (rewrite)

**Files:**
- Modify (full rewrite): `skills/test-strategy-enforcement/SKILL.md`

- [ ] **Step 1: Rewrite**

**Frontmatter `description`:** Use when adding tests, changing testing patterns, or reviewing a PR's test plan. Do NOT use for missing-coverage analysis (use `coverage-gap-detection`) or for risk assessment (use `regression-risk-check`). Covers test pyramid, unit vs integration vs e2e split, flake hygiene, test data, mocks vs real services.

**Purpose:** Keep the test portfolio useful — fast where it matters, real where correctness requires it, minimal where it doesn't.

**Core rules:**
1. Unit tests are pure — no DB, no network, no filesystem. Fast (< 50ms each).
2. Integration tests hit a real DB (testcontainers Postgres) and real HTTP stacks. No mocked Prisma, no mocked Nest controllers.
3. E2E tests (Playwright) cover a short list of critical user journeys. Not every edge case.
4. Mocks are for third parties your team doesn't own. Don't mock your own services.
5. Test data is built with factories (Fishery, or plain builders), not fixtures — each test defines what matters.
6. Tests are deterministic — seed randomness, freeze time (`vi.useFakeTimers()` / `sinon`), no real clocks.
7. Flaky tests are quarantined and fixed or deleted within a sprint, never left "pending".

**Red flag topics:**
- "I mocked Prisma, the test is fast" → repository tests must use real Prisma.
- "Just snapshot it" → snapshot tests rot and everyone rubber-stamps the update.
- "Sleep(500) until it passes" → flake factory.

**Good vs bad snippets:**
- Testcontainers Postgres in integration test (good) vs mocked Prisma (bad)
- Factory + override (good) vs rigid JSON fixture (bad)
- `vi.useFakeTimers()` with assertions on advanced time (good) vs sleep (bad)

**Deep-dive sections:**
- `## Test pyramid (concrete ratios)`
- `## Testcontainers setup for Postgres`
- `## Factories and test data`
- `## Flake hunting`
- `## What to mock, what to keep real`

**Interactions:**
- **Owns:** test strategy and patterns.
- **Hands off to:** `coverage-gap-detection` for gaps; `regression-risk-check` for blast radius.
- **Does not duplicate:** `prisma-data-access-guard`'s migration testing concerns.

**Review checklist:** per rule, PASS / CONCERN / NOT APPLICABLE; list every mock of an owned service, every snapshot test in logic code.

- [ ] **Step 2: Commit**

```bash
git add skills/test-strategy-enforcement/SKILL.md
git commit -m "refactor(skills): rewrite test-strategy-enforcement"
```

---

## Task 19: `coverage-gap-detection` (rewrite)

**Files:**
- Modify (full rewrite): `skills/coverage-gap-detection/SKILL.md`

- [ ] **Step 1: Rewrite**

**Frontmatter `description`:** Use when asked "are we testing the right things" or after a feature is complete but before merge, to find critical untested paths. Do NOT use for test authoring patterns (use `test-strategy-enforcement`). Covers critical-path identification, missing negative tests, untested error branches, edge-case discovery.

**Purpose:** Coverage % lies. This skill finds the paths that *should* have tests and don't.

**Core rules:**
1. Critical paths (auth, payments, data mutations with financial/legal impact) have integration tests, not just unit.
2. Every `catch` branch and every error return has at least one test.
3. Every authorization decision has a "denied" test as well as a "permitted" test.
4. Input validation is tested at the boundary — invalid shapes and boundary values (empty string, large string, unicode, null).
5. Time-sensitive logic (expiry, deadlines, TTLs) has tests at the boundary times.
6. Concurrency-sensitive logic (transactions, race conditions) has a concurrent test or a documented justification.
7. UI "empty state", "loading state", "error state" all have rendering tests.

**Red flag topics:**
- "Coverage is 90%" → that's not what this skill is about.
- "Happy path only, ship it" → production is not the happy path.
- "We don't test errors, too hard" → errors are where bugs live.

**Good vs bad snippets:**
- Happy + denied + invalid-input trio (good) vs happy-only (bad)
- Boundary-time assertion (good) vs mid-range-only assertion (bad)

**Deep-dive sections:**
- `## Critical-path checklist`
- `## Negative-case discovery heuristics`
- `## Authorization coverage`
- `## Empty/loading/error state tests`
- `## Time and concurrency coverage`

**Interactions:**
- **Owns:** gap-finding for existing code.
- **Hands off to:** `test-strategy-enforcement` for *how* to write the missing tests; `regression-risk-check` for whether a gap is a merge blocker.
- **Does not duplicate:** line-coverage tooling (`vitest --coverage`).

**Review checklist:** per rule, PASS / CONCERN / NOT APPLICABLE; for each gap, name the specific test that should exist.

- [ ] **Step 2: Commit**

```bash
git add skills/coverage-gap-detection/SKILL.md
git commit -m "refactor(skills): rewrite coverage-gap-detection"
```

---

## Task 20: `regression-risk-check` (rewrite)

**Files:**
- Modify (full rewrite): `skills/regression-risk-check/SKILL.md`

- [ ] **Step 1: Rewrite**

**Frontmatter `description`:** Use when a PR touches shared utilities, high-traffic endpoints, data-layer code, or migration-bearing files — to assess blast radius of regressions. Do NOT use for overall release risk (use `change-risk-evaluation`) or missing tests (use `coverage-gap-detection`). Covers blast-radius analysis, call-site scanning, cross-feature impact.

**Purpose:** A change's risk is defined by what else it touches. This skill makes that concrete.

**Core rules:**
1. List every module that imports from the changed file(s). If > N (e.g. 10), blast radius is high.
2. Classify the change: internal (no exported API change), API-compatible (same signatures, same behaviour), API-breaking.
3. For API-breaking changes, list every consumer and its migration plan.
4. For behavioural changes (same signatures, different results), flag the hidden-breakage risk.
5. Data-layer changes (schema, index, query plan) require a query-plan diff or benchmark on production-sized data.
6. Check for "spooky action at a distance" — changes that alter shared state, global config, or middleware affect every consumer.

**Red flag topics:**
- "Tiny refactor, low risk" → count the callers first.
- "Signature unchanged, behaviour same" → verify, don't assume.
- "It's just internal" → internals have callers too.

**Good vs bad snippets:**
- Explicit blast-radius list in PR description (good) vs "small change" claim (bad)

**Deep-dive sections:**
- `## Blast radius estimation`
- `## Change classification (internal / API-compat / breaking / behavioural)`
- `## Schema and query-plan impact`
- `## Spooky-action warning list`

**Interactions:**
- **Owns:** blast-radius analysis.
- **Hands off to:** `change-risk-evaluation` for overall risk; `rollback-planning` for reverse path; `coverage-gap-detection` for missing tests on the blast surface.
- **Does not duplicate:** diff review.

**Review checklist:** per rule, PASS / CONCERN / NOT APPLICABLE; produce a blast-radius report: changed file → importers → classification.

- [ ] **Step 2: Commit**

```bash
git add skills/regression-risk-check/SKILL.md
git commit -m "refactor(skills): rewrite regression-risk-check"
```

---

## Task 21: `change-risk-evaluation` (rewrite)

**Files:**
- Modify (full rewrite): `skills/change-risk-evaluation/SKILL.md`

- [ ] **Step 1: Rewrite**

**Frontmatter `description`:** Use at PR time to produce a top-level risk posture for a change — the ticket an on-call or lead reads before approving. Do NOT use for code-level review (that's the domain skills). Covers overall risk rating, deploy strategy, monitoring plan, stakeholder list.

**Purpose:** Give an approver a one-page read on risk — not "is the code good", but "what happens if this breaks in prod?"

**Core rules:**
1. Produce a risk rating (low / med / high / critical) with explicit justification.
2. List affected users, services, and business processes.
3. Name the deploy strategy: canary, blue/green, feature flag, straight-through.
4. Name the monitoring signals that will detect breakage (dashboard link, alert name).
5. Name the rollback trigger — what signal says "roll back now".
6. List the stakeholders who must know before deploy (team leads, on-call, support).

**Red flag topics:**
- "Low risk, it's just a small change" → without the justification, that's a vibes assessment.
- "We'll watch prod after deploy" → name the signal and threshold.

**Good vs bad snippets:** (risk report template vs ad-hoc risk claim)

**Deep-dive sections:**
- `## Risk-rating rubric`
- `## Deploy strategy selection`
- `## Monitoring signal selection`
- `## Stakeholder notification list`

**Interactions:**
- **Owns:** top-level risk posture.
- **Hands off to:** `regression-risk-check` for blast-radius inputs; `rollback-planning` for reverse path; `observability-first-debugging` for monitoring signals.
- **Does not duplicate:** PR code review.

**Review checklist:** every required field filled with specifics.

- [ ] **Step 2: Commit**

```bash
git add skills/change-risk-evaluation/SKILL.md
git commit -m "refactor(skills): rewrite change-risk-evaluation"
```

---

## Task 22: `rollback-planning` (rewrite)

**Files:**
- Modify (full rewrite): `skills/rollback-planning/SKILL.md`

- [ ] **Step 1: Rewrite**

**Frontmatter `description`:** Use when a change is rated medium or higher risk, or touches data / infrastructure / contracts. Do NOT use for trivial changes behind a feature flag that defaults off. Covers rollback path, forward-fix vs rollback, data-change reversibility, feature-flag kill switches, time-to-rollback.

**Purpose:** Every risky change has a written rollback — before it ships, not during the incident.

**Core rules:**
1. Rollback path is written before merge. A change with no rollback path is either trivial or not mergeable.
2. Data migrations are reversible in code (`down` migration exists) or explicitly forward-only with a stated reason and a data-recovery plan.
3. A feature flag with a kill switch is the rollback mechanism for behavioural changes.
4. Time-to-rollback is measured — a rollback that takes hours is effectively no rollback; fix the path.
5. Contract/breaking changes require a period of dual support to enable rollback without downstream breakage.
6. Rehearsal: for high-risk changes, the rollback is practised in staging before prod deploy.

**Red flag topics:**
- "We'll figure out rollback if needed" → at 3am, you won't.
- "Migration is one-way, YOLO" → data recovery plan or a tested `down`.

**Good vs bad snippets:** (feature-flag rollback vs deploy-revert-only; reversible migration vs one-way)

**Deep-dive sections:**
- `## Rollback mechanism taxonomy`
- `## Data migration reversibility`
- `## Feature flags as rollback`
- `## Dual-support windows`
- `## Rehearsal for high-risk`

**Interactions:**
- **Owns:** rollback planning.
- **Hands off to:** `change-risk-evaluation` for risk rating that triggers planning; `infra-safe-change` for infra reversibility; `prisma-data-access-guard` for migration reversibility.
- **Does not duplicate:** deploy automation.

**Review checklist:** rollback path documented, tested/rehearsed where required, time-to-rollback estimated.

- [ ] **Step 2: Commit**

```bash
git add skills/rollback-planning/SKILL.md
git commit -m "refactor(skills): rewrite rollback-planning"
```

---

## Task 23: `infra-safe-change` (rewrite)

**Files:**
- Modify (full rewrite): `skills/infra-safe-change/SKILL.md`

- [ ] **Step 1: Rewrite**

**Frontmatter `description`:** Use when modifying Terraform, CloudFormation, CDK, or any IaC that provisions cloud resources — especially state stores, networking, IAM, and compute scaling. Do NOT use for application-level AWS SDK calls (use `aws-deploy-safety`). Covers IaC review, state management, drift detection, destructive plan detection, IAM policies, networking changes.

**Purpose:** Infra changes land all at once and often can't be undone quickly. This skill catches destructive plans before apply.

**Core rules:**
1. Every `terraform plan` is read fully before apply — destructive actions (delete, force_new) block merge without justification.
2. State is remote, versioned, and locked (S3 + DynamoDB, or Terraform Cloud). Never local state in CI.
3. IAM changes follow least privilege. `*` on `Action` or `Resource` is flagged.
4. Networking changes (security groups, subnets, routes) are reviewed by someone who can describe the blast radius.
5. Drift between code and reality is treated as a bug — either reconcile or document why the drift is allowed.
6. Destructive changes to stateful resources (RDS, S3 with data, DynamoDB) use `prevent_destroy` + manual override.
7. Secrets are not stored in IaC state; references only.

**Red flag topics:**
- "The plan has a delete but it's fine" → describe what's being deleted, explicitly.
- "IAM wildcard for simplicity" → never for production.
- "State file committed for now" → secrets leak.

**Good vs bad snippets:** (lifecycle `prevent_destroy` on RDS good; unguarded RDS bad; scoped IAM good; `*` IAM bad)

**Deep-dive sections:**
- `## Plan reading discipline`
- `## Remote state + locking`
- `## IAM least privilege`
- `## Destructive operations on stateful resources`
- `## Drift detection`

**Interactions:**
- **Owns:** IaC change review.
- **Hands off to:** `aws-deploy-safety` for application deploy concerns; `secrets-and-config-safety` for secret references; `cicd-pipeline-safety` for pipeline-level role assumption.
- **Does not duplicate:** Terraform style linting (`tflint`).

**Review checklist:** every destructive plan annotated, every IAM change scoped, state backend verified.

- [ ] **Step 2: Commit**

```bash
git add skills/infra-safe-change/SKILL.md
git commit -m "refactor(skills): rewrite infra-safe-change"
```

---

## Task 24: `aws-deploy-safety` (rewrite)

**Files:**
- Modify (full rewrite): `skills/aws-deploy-safety/SKILL.md`

- [ ] **Step 1: Rewrite**

**Frontmatter `description`:** Use when deploying to AWS (ECS Fargate, Lambda, App Runner) or changing deploy-related AWS resources (task definitions, Lambda config, secrets references, roles consumed at runtime). Do NOT use for IaC review (use `infra-safe-change`) or for CI pipeline integrity (use `cicd-pipeline-safety`). Covers deploy strategies, task role discipline, Secrets Manager integration, health checks, rolling vs blue-green, zero-downtime migrations.

**Purpose:** Make AWS deploys boring — safe defaults, predictable rollout, fast recovery.

**Core rules:**
1. Task/function execution roles are distinct from task roles; neither uses `*` actions.
2. Secrets injected via Secrets Manager ARN references in task definition or Lambda env, not plaintext values.
3. ECS deploys use rolling with `minimumHealthyPercent` / `maximumPercent` set explicitly; or blue/green via CodeDeploy for higher-risk services.
4. Lambda deploys use aliases + traffic shifting (linear or canary) for user-facing functions.
5. Health checks reflect real readiness (DB connectivity, critical deps), not just `/ping`.
6. Schema migrations run before app rollout and are backwards-compatible with the previous version (expand/contract).
7. Log retention is set explicitly (CloudWatch Logs retention) — no default "never expire".

**Red flag topics:**
- "One role for everything, easier" → blast radius on compromise.
- "Plaintext secret in task def" → secret in state and logs.
- "/ping says 200, deploy is fine" → health check means nothing.

**Good vs bad snippets:** (Secrets Manager ARN in task def vs plaintext; readiness probe hitting DB vs static 200)

**Deep-dive sections:**
- `## ECS rolling deploy parameters`
- `## Lambda alias + traffic shift`
- `## Health check design`
- `## Expand/contract schema migrations`
- `## Log retention`

**Interactions:**
- **Owns:** AWS-level deploy mechanics.
- **Hands off to:** `infra-safe-change` for provisioning those resources; `secrets-and-config-safety` for app-side secret fetching; `rollback-planning` for the rollback trigger and path.
- **Does not duplicate:** pipeline concerns.

**Review checklist:** deploy strategy named, roles scoped, secrets via ARN, health check reflects readiness, migration is expand/contract.

- [ ] **Step 2: Commit**

```bash
git add skills/aws-deploy-safety/SKILL.md
git commit -m "refactor(skills): rewrite aws-deploy-safety"
```

---

## Task 25: `cicd-pipeline-safety` (new)

**Files:**
- Create: `skills/cicd-pipeline-safety/SKILL.md`

- [ ] **Step 1: Write**

**Frontmatter `description`:** Use when modifying GitHub Actions workflows, reusable workflows, required-check configuration, or promotion logic between environments. Do NOT use for application deploy mechanics (use `aws-deploy-safety`). Covers OIDC to AWS, secret scoping, required checks, branch protection, artifact integrity, environment promotion, third-party action pinning.

**Purpose:** The CI pipeline is a production system. Its failures become silent regressions.

**Core rules:**
1. AWS access uses OIDC (`aws-actions/configure-aws-credentials` with a GitHub OIDC role), never long-lived access keys.
2. Third-party actions are pinned to a commit SHA, not a tag. Tags can be moved.
3. Secrets are scoped by environment (`environments/prod` vs `environments/staging`); no shared blob.
4. Required checks on the default branch include: type-check, unit, integration, build. No merge without them.
5. Pull requests from forks don't receive secrets (`pull_request` trigger, not `pull_request_target` unless audited).
6. Deployments to prod require an explicit `environments/prod` approval gate.
7. Build artifacts are versioned and traceable to the commit and workflow run (upload + retention).

**Red flag topics:**
- "Long-lived AWS key in secret" → rotate-hell and blast radius; use OIDC.
- "`uses: someaction/foo@v1`" → tag can be reassigned; pin SHA.
- "pull_request_target for convenience" → untrusted code with secrets.

**Good vs bad snippets:** (OIDC role assumption; action pinned to SHA; environment with approval)

**Deep-dive sections:**
- `## OIDC to AWS setup`
- `## Third-party action pinning`
- `## Secret scoping by environment`
- `## Required-check configuration`
- `## Fork PR safety (pull_request vs pull_request_target)`
- `## Artifact integrity and retention`

**Interactions:**
- **Owns:** pipeline integrity.
- **Hands off to:** `aws-deploy-safety` for what the deploy does; `supply-chain-and-dependencies` for dep scanning in the pipeline.
- **Does not duplicate:** IaC for those AWS resources.

**Review checklist:** OIDC used, actions SHA-pinned, secrets scoped, required checks enforced, environment gates present.

- [ ] **Step 2: Commit**

```bash
git add skills/cicd-pipeline-safety/SKILL.md
git commit -m "feat(skills): add cicd-pipeline-safety"
```

---

## Task 26: `supply-chain-and-dependencies` (new)

**Files:**
- Create: `skills/supply-chain-and-dependencies/SKILL.md`

- [ ] **Step 1: Write**

**Frontmatter `description`:** Use when adding, upgrading, or pinning a dependency; or when reviewing lockfile churn, CVE reports, or license changes. Do NOT use for internal package imports (use `architecture-guard`). Covers lockfile discipline, SCA, pinned versions, license policy, peer-dep drift, typosquat detection.

**Purpose:** Every `pnpm add` is a supply-chain decision. This skill keeps them honest.

**Core rules:**
1. A lockfile exists (`pnpm-lock.yaml`) and is committed; `install` in CI uses `--frozen-lockfile`.
2. Direct dependencies are pinned or narrowly ranged (^1.2.3 ok; `*` / `latest` never).
3. SCA runs in CI (npm audit, Dependabot, or Renovate + vulnerability alerts). High/critical CVEs block merge.
4. New dependencies are evaluated: maintenance status, download count, alternatives, size.
5. License policy enforced — GPL/AGPL only with explicit approval; unlicensed packages rejected.
6. Peer-dep warnings in install output are resolved, not ignored.
7. No `postinstall` scripts from unknown packages. If added, reviewed explicitly.

**Red flag topics:**
- "Version bumped `npm audit fix --force`" → reviews every change before accepting.
- "`latest` so we always get new" → supply-chain attack vector.
- "Peer dep warning is harmless" → sometimes it's a real runtime bug waiting.

**Good vs bad snippets:** (pinned version good; `latest` bad; `--frozen-lockfile` CI)

**Deep-dive sections:**
- `## Lockfile discipline`
- `## SCA in CI`
- `## Licence policy`
- `## Evaluating new dependencies`
- `## Supply-chain red flags (typosquats, new maintainers, post-install)`

**Interactions:**
- **Owns:** dependency policy.
- **Hands off to:** `cicd-pipeline-safety` for where the check runs; `performance-budget-guard` for bundle impact of a new dep.
- **Does not duplicate:** `_baseline`'s stack pick.

**Review checklist:** lockfile committed, CI frozen, SCA enabled, every new dep justified.

- [ ] **Step 2: Commit**

```bash
git add skills/supply-chain-and-dependencies/SKILL.md
git commit -m "feat(skills): add supply-chain-and-dependencies"
```

---

## Task 27: `observability-first-debugging` (rewrite)

**Files:**
- Modify (full rewrite): `skills/observability-first-debugging/SKILL.md`

- [ ] **Step 1: Rewrite**

**Frontmatter `description`:** Use when debugging a production or staging issue, or when adding code to a hot path that should be observable. Do NOT use for local-only debugging of new code (use your IDE). Covers logs/metrics/traces-first method, structured logging, correlation ID propagation, alarm design.

**Purpose:** Debug production by reading the system, not by guessing. And write code that can be debugged that way.

**Core rules:**
1. Start with logs → metrics → traces. Do not reach for `console.log` patches in prod.
2. Every log line is structured JSON with `requestId`, `service`, `level`, and relevant fields — never "user 123 clicked foo" free text only.
3. A single request gets a correlation ID at the edge; every downstream log carries it.
4. Metrics exist for every handler: latency histogram, error rate, throughput. Alerts are based on p95/p99 + error rate, not p50.
5. Traces span across services. Critical paths are instrumented.
6. Alarms have runbooks. An alarm that fires without a runbook is an incident-amplifier.
7. Error reports include: what the user was doing, request id, timestamp, input shape (non-PII), downstream error cause chain.

**Red flag topics:**
- "Just `console.log` and redeploy" → you're coding blind.
- "Logs are strings, grep works" → for one request at 3am, that's a nightmare.
- "Alarm on p50 latency" → tail is where users suffer.

**Good vs bad snippets:** (structured Pino log; correlation id via middleware; histogram metric)

**Deep-dive sections:**
- `## Structured logging (Pino) setup`
- `## Correlation IDs end-to-end`
- `## Metrics that matter`
- `## Tracing critical paths`
- `## Alarm design + runbooks`
- `## Debugging playbook`

**Interactions:**
- **Owns:** observability culture and patterns.
- **Hands off to:** `resilience-and-error-handling` for *when* to log errors; `change-risk-evaluation` for what to watch on deploy.
- **Does not duplicate:** vendor-specific setup docs.

**Review checklist:** every handler has structured logs + metrics + correlation id; every alarm has a runbook.

- [ ] **Step 2: Commit**

```bash
git add skills/observability-first-debugging/SKILL.md
git commit -m "refactor(skills): rewrite observability-first-debugging"
```

---

## Task 28: `mobile-implementation-guard` (rewrite)

**Files:**
- Modify (full rewrite): `skills/mobile-implementation-guard/SKILL.md`

- [ ] **Step 1: Rewrite**

**Frontmatter `description`:** Use when writing or reviewing React Native + Expo mobile code — screens, navigation, native module usage, OTA updates. Do NOT use for web React (use `frontend-implementation-guard`). Covers RN/Expo structure, navigation patterns, native module boundaries, EAS Build / EAS Update, platform-specific behaviour, offline UX.

**Purpose:** Keep the mobile app's structure predictable, native boundaries thin, and updates safe on both stores.

**Core rules:**
1. Use Expo managed workflow unless a specific native feature requires bare; document the reason if bare.
2. Navigation (React Navigation) lives in a dedicated layer. Screens don't import each other directly — deep links and nav params only.
3. Native modules are wrapped by a single TypeScript adapter per module. Screens never call native APIs directly.
4. Platform-specific branches (`Platform.OS`) are rare and centralised in adapters, not scattered in screens.
5. Offline UX: every screen has a defined offline state (cached data, queued writes, clear error message).
6. EAS Updates (OTA) respect the store policy — JS-only changes; native changes require a new build.
7. Permissions prompts are requested at the moment of use, not on app start, and the UI explains *why* before asking.

**Red flag topics:**
- "Screen imports screen" → nav graph falls apart.
- "Platform.if for every component" → fragment the codebase into two.
- "OTA native change" → store rejection.

**Good vs bad snippets:** (single native adapter; just-in-time permission prompt; offline queue)

**Deep-dive sections:**
- `## Expo managed vs bare`
- `## Navigation architecture`
- `## Native module adapter pattern`
- `## Platform-specific behaviour (iOS/Android)`
- `## Offline UX`
- `## EAS Build and EAS Update`
- `## Permissions flow`

**Interactions:**
- **Owns:** RN/Expo structure.
- **Hands off to:** `accessibility-guard` (mobile a11y — TalkBack/VoiceOver); `state-integrity-check` for offline sync; `integration-contract-safety` for API contracts.
- **Does not duplicate:** web React concerns.

**Review checklist:** per rule, PASS / CONCERN / NOT APPLICABLE; list every direct screen-to-screen import and every native call outside an adapter.

- [ ] **Step 2: Commit**

```bash
git add skills/mobile-implementation-guard/SKILL.md
git commit -m "refactor(skills): rewrite mobile-implementation-guard"
```

---

## Final verification

- [ ] **Step 1: Confirm all 25 domain skills + `_baseline` exist**

Run: `ls skills | wc -l` — expect at least 26 entries (25 + `_baseline`, plus any that existed before and were kept).

Run: `for d in skills/*/; do test -f "$d/SKILL.md" || echo "missing: $d"; done` — expect no output.

- [ ] **Step 2: Confirm frontmatter on every skill**

Run: `for f in skills/*/SKILL.md; do head -1 "$f" | grep -q '^---' || echo "bad frontmatter: $f"; done` — expect no output.

- [ ] **Step 3: Confirm no placeholder leftovers**

Run: `grep -rIn --include='SKILL.md' -E '\bTBD\b|\bTODO\b|fill in|placeholder' skills/` — expect no output.

- [ ] **Step 4: Confirm every domain skill references `_baseline`**

Run: `for f in skills/*/SKILL.md; do case "$f" in *_baseline*) ;; *) grep -q 'Assumes `_baseline`' "$f" || echo "missing baseline ref: $f" ;; esac; done` — expect no output.

- [ ] **Step 5: Tag the milestone**

```bash
git tag -a skills-overhaul-v1 -m "Skills library overhaul: 25 skills + _baseline"
```

---

## Self-review notes

- Every skill task explicitly specifies frontmatter description, core rule topics with a `*Why:*` expectation, red flag topics, snippet topics, deep-dive section headings, interaction map, and review checklist scope — no placeholders.
- Every spec requirement in the design doc (sections 3, 4, 5, 6, 7, 8, 9) maps to at least one task: template → Task 2 + each skill task; inventory → Tasks 4–28; baseline → Task 1; stack pinning → Task 1; interaction map → each skill task's "Interactions"; execution batches → task ordering; out-of-scope items have no tasks.
- Type-consistency check: `_baseline` topics (TypeScript, security, observability, testing, a11y, performance, resilience, stack) are referenced identically in each domain skill's "Assumes" line.
- No task depends on code that's defined in a later task — `_baseline` (Task 1) is the only cross-task dependency and comes first.
