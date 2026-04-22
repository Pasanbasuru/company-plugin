---
name: regression-risk-check
description: Use when a PR touches shared utilities, high-traffic endpoints, data-layer code, or migration-bearing files — to assess blast radius of regressions. Do NOT use for overall release risk (use `change-risk-evaluation`) or missing tests (use `coverage-gap-detection`). Covers blast-radius analysis, call-site scanning, cross-feature impact.
---

A change's risk is defined by what else it touches. This skill makes that concrete.

## Assumes `_baseline`. Adds:

Blast-radius analysis — importer graph enumeration, change classification (internal/API-compat/breaking/behavioural), query-plan regression detection, and spooky-action-at-a-distance surface identification.

## Core rules

**Rule 1 — Map every importer before claiming the change is isolated.**
Run `git log --follow -p -- <file>` to understand the file's history, then grep or use `ts-morph` to enumerate every module that imports from the changed file. If the importer count exceeds roughly ten modules, treat blast radius as high and say so explicitly. A single shared utility re-exported through an index barrel can silently reach dozens of consumers — verify the full re-export chain, not just direct imports.

*Why:* Engineers routinely underestimate coupling because they think about what they changed, not about who depends on the change. Naming the importers turns intuition into evidence.

**Rule 2 — Classify every change before assessing impact.**
Categorise each changed export as one of: internal (not exported), API-compatible (same signature, same observable behaviour), API-breaking (signature or contract changed), or behavioural (signature unchanged, observable results differ). These categories drive the rest of the analysis — each demands a different response.

*Why:* The category determines who is affected and what action is required. Conflating "API-compatible" with "behavioural change" is the most common source of silent regressions, because callers see no type error yet produce wrong results.

**Rule 3 — For API-breaking changes, enumerate every consumer and its migration path.**
Use `ts-morph` for AST-level analysis to find all call sites of the changed function or type, not just text-grep matches. List each consumer and state whether it needs updating, whether it is covered by tests, and whether there is a deprecation window available. If any consumer is in a separate deployment unit (another service, a public SDK, a mobile app), flag the coordination cost explicitly.

*Why:* Breaking changes without an exhaustive consumer list produce ad-hoc breakage discovered at runtime. The migration plan must exist before the PR merges, not after.

**Rule 4 — Flag behavioural changes as hidden-breakage risk even when signatures are unchanged.**
Behavioural changes are the hardest regression class: TypeScript, linters, and contract tests all pass, but callers receive different results. Require explicit evidence — unit tests with before/after assertions, or a documented invariant — that the new behaviour is correct for every consumer, not just the primary use case.

*Why:* A utility that previously returned `null` on empty input and now returns `[]` will break every caller that null-checked the result. Neither the type system nor integration tests typically catch this class of regression until a downstream feature fails silently in production.

**Rule 5 — Data-layer changes require a query-plan diff or benchmark on production-sized data.**
Any change to a Prisma schema, raw SQL, index definition, or query shape must be accompanied by a Postgres `EXPLAIN (ANALYZE, BUFFERS)` diff between the old and new query on a dataset that represents production volume. Check for sequential scans where index scans existed before, for increased shared-hit estimates, and for plan regressions introduced by new filter predicates or join reordering.

*Why:* A query that performs acceptably on a developer's 1 000-row sample can produce a full table scan on a 10 M-row production table. Schema migrations and new indexes are also irreversible in many cases — a missed plan regression is a production incident, not a follow-up ticket.

**Rule 6 — Check for spooky action at a distance before signing off.**
Changes to shared state (in-memory caches, singleton services, global middleware, environment-variable readers, DI container configuration) affect every consumer simultaneously, including consumers that did not change and are not listed in the PR. Verify whether the changed code touches any of these surfaces. If it does, the blast radius is the entire application or service, regardless of how targeted the diff looks.

*Why:* A middleware change that adds a header, a singleton cache that changes its TTL, or a config reader that alters its fallback value are each invisible to grep-based importer scans, yet they alter the runtime environment of every request. These are the changes most likely to produce intermittent, hard-to-attribute regressions.

---

## Red flags

| Signal | Why it is dangerous |
|---|---|
| "Tiny refactor, low risk" without an importer count | Risk is determined by the caller graph, not by diff size. Count the callers first, then make the claim. |
| "Signature unchanged, behaviour same" without test evidence | Behavioural equivalence is an assertion, not a default. Require a test or a documented invariant to back it. |
| "It's just internal" for a file touched by barrel re-exports | Internals have callers too. A private implementation detail surfaced through an index export becomes an implicit public API. |

---

## Good vs bad: PR description

**Bad — "small change" claim with no evidence**

> This PR refactors the `formatDate` utility. It's a small internal change, low risk, no callers should be affected.

This tells a reviewer nothing. There is no importer list, no classification of the change, no confirmation that the observable outputs are identical.

**Good — explicit blast-radius list**

> **Changed file:** `src/utils/formatDate.ts`
>
> **Change type:** Behavioural — locale fallback now uses `en-GB` instead of the system locale when `process.env.LOCALE` is unset.
>
> **Importers (8):**
> - `InvoiceService` — renders locale-aware dates on PDF output. Verified: always passes explicit locale, unaffected.
> - `ReportScheduler` — uses default locale on cron-triggered exports. **Affected.** Updated to pass `en-GB` explicitly.
> - `NotificationFormatter` — email date strings. Verified: locale passed via config. Unaffected.
> - `AuditLogSerializer` — ISO-8601 only, locale-invariant. Unaffected.
> - (4 more listed in the PR body)
>
> **Query-plan impact:** None — no data-layer changes.
> **Spooky-action risk:** None — no shared state or middleware touched.

The second form gives a reviewer the information they need to approve or challenge the assessment. It converts a vibes claim into a verifiable checklist.

---

## Blast radius estimation

Blast radius is the set of modules, services, and features that can produce different observable behaviour as a result of this change. Estimating it accurately is the first step of any regression-risk analysis.

Start with the directly changed file. Use `git log --follow -- <file>` to confirm the file's identity has been stable (renames and moves can cause importer scans to miss historical consumers). Then enumerate direct importers: grep the codebase for import paths or require calls that resolve to the changed file, or use `ts-morph`'s `ReferenceFinder` for a fully type-resolved call graph that accounts for TypeScript path aliases and barrel re-exports.

Barrel re-exports deserve special attention. If `src/utils/index.ts` re-exports the changed function, every module that imports from `src/utils` is an indirect consumer. Walk the re-export chain one level at a time until you reach concrete call sites or hit a boundary (a service entry point, a public package export, or a test file).

Once the importer list is complete, categorise the blast radius:

- **Contained** (1–3 importers, all in the same feature module, all under test): the PR can proceed with targeted regression testing of those importers.
- **Moderate** (4–10 importers, or importers spanning multiple features): require explicit verification of each importer in the PR description, and ensure the test plan covers the cross-feature surface.
- **High** (> 10 importers, or any importer in a separate deployment unit): escalate to senior review, require a staged rollout or feature flag, and consider whether the change should be split into a backward-compatible shim followed by a migration.

For changes that touch cross-service contracts — shared libraries consumed by multiple backend services, or SDK packages with external consumers — add the coordination cost to the blast-radius assessment. A breaking change that requires simultaneous deployment of two services is a higher-risk event than a self-contained change within a single service.

---

## Change classification (internal / API-compat / breaking / behavioural)

Every changed export falls into one of four categories. Apply them per export, not per file — a single file can contain changes of multiple types.

**Internal:** The symbol is not exported from the module boundary. No consumer outside the file can observe the change. Blast radius is limited to the file itself (and its tests). Verify by checking that no barrel re-export surfaces the symbol.

**API-compatible:** The exported signature is unchanged and the observable contract — return values, thrown exceptions, side effects, timing — is identical to before. Consumers require no changes. Confirm with a unit test that exercises the changed code path with production-representative inputs and asserts the same outputs as before the change.

**API-breaking:** A public signature changes: a parameter is added, removed, or retyped; a return type narrows or widens; an exception type changes; an optional field becomes required. Every consumer must be updated or provided a migration shim. Use `ts-morph` to enumerate all call sites. TypeScript will surface many of these as compile errors, but JavaScript consumers, dynamic call sites (`obj[method]()`), and runtime-only contracts (JSON payloads, event shapes) will not produce type errors and must be found by other means.

**Behavioural:** The signature is identical to before but the function produces different results for some input. This is the most dangerous class. TypeScript, ESLint, and integration tests that only assert "the endpoint returns 200" will all pass while production callers silently receive wrong data. Detection requires: (a) explicit before/after unit tests with concrete input/output assertions, (b) a documented invariant stating what the old behaviour was and why the new behaviour is correct, and (c) review of every importer to confirm it does not depend on the old behaviour.

When in doubt, classify a change as behavioural rather than API-compatible. The cost of treating a safe change conservatively is a few extra tests. The cost of treating a behavioural change as safe is a production regression.

---

## Schema and query-plan impact

Data-layer changes are irreversible or expensive to revert, and they have a blast radius that extends beyond code to production data and database performance. Apply this section to any change that touches a Prisma schema file, a raw SQL migration, an index definition, or a query inside a service method.

**Schema changes.** Any column addition, removal, rename, type change, or constraint modification must be reviewed against every Prisma query that touches the affected model. Use `ts-morph` or grep to find all `prisma.<model>.findMany`, `findFirst`, `create`, `update`, and `upsert` calls. Confirm that: (a) added columns with no default do not violate existing row constraints, (b) removed or renamed columns are not referenced in any active query or serialiser, and (c) type changes do not alter the JSON representation consumed by API clients.

**Query-plan analysis.** Run Postgres `EXPLAIN (ANALYZE, BUFFERS)` against both the old and new query form on a dataset that represents production volume. Review the output for:

- Transition from `Index Scan` to `Seq Scan`: indicates a missing or unused index on the new query shape.
- Increase in `shared hit blocks` or `shared read blocks`: indicates higher memory pressure or cache miss rate.
- Increase in estimated or actual row count at a filter node: indicates a predicate that does not use a selective index.
- Plan instability between `EXPLAIN` runs: indicates statistics are stale and `ANALYZE` should be run before migration.

When adding a new index to a production table, check whether it can be created with `CREATE INDEX CONCURRENTLY` to avoid table locks. Document the expected index size and the estimated build time at production row count.

**Migration safety.** Migrations that acquire `ACCESS EXCLUSIVE` locks (column drops, type changes, constraint additions without `NOT VALID`) block all reads and writes for the duration of the migration. Flag these explicitly and require either a maintenance window or a migration strategy that avoids the lock (e.g., add column nullable first, backfill, then apply constraint with `NOT VALID` + `VALIDATE CONSTRAINT`).

---

## Spooky-action warning list

"Spooky action at a distance" refers to changes that alter the runtime environment of code that was not modified and does not appear in any importer scan. These changes are invisible to diff-based review and call-site analysis, yet they can affect every request, every background job, or every consumer of a shared service simultaneously.

Check whether the changed code touches any of the following surfaces. If it does, expand the blast radius to the full application or service regardless of how narrow the diff appears.

**In-memory caches and singletons.** A change to a cache's TTL, key format, or eviction policy affects every consumer of that cache. A change to a singleton's initialisation logic affects every code path that depends on the singleton being initialised in a particular state.

**Global middleware and interceptors.** NestJS global interceptors, Express middleware registered at the app level, and Next.js middleware applied to all routes each execute on every request. A one-line change to a global middleware can alter headers, timing, error shapes, or authentication behaviour for the entire application.

**Environment variable readers.** A function that reads `process.env.SOME_VAR` and caches the result at module load time will behave differently if the variable's presence, absence, or default value changes. Check whether the changed code is used as a module-level constant evaluated at startup.

**DI container configuration.** Changes to NestJS module providers — swapping a service implementation, changing scope from singleton to request-scoped, or altering injection tokens — affect every consumer of that provider without changing the consumer's code.

**Shared event emitters and message bus handlers.** A change to an event payload or a message schema affects every handler subscribed to that event, including handlers in other modules or services that are not listed as importers of the changed file. Cross-check with the queue-and-retry-safety skill for async blast radius.

**TypeScript declaration merging and ambient modules.** Changes to `.d.ts` files or `declare module` blocks alter the type environment globally. A change that appears to add a convenience overload can silently shadow an existing type and cause downstream type inference to resolve differently.

When any of the above surfaces is touched, the regression-risk assessment must state so explicitly, name the affected runtime scope, and require a broader test surface before the change is approved.

---

## Review checklist

For each rule, record PASS, CONCERN, or NOT APPLICABLE.

| Rule | Status | Notes |
|---|---|---|
| 1. Importer list complete and importer count stated | | |
| 2. Each changed export classified (internal / API-compat / breaking / behavioural) | | |
| 3. All consumers listed and migration plan present (API-breaking only) | | |
| 4. Behavioural equivalence evidenced by tests or documented invariant | | |
| 5. Query-plan diff or benchmark provided (data-layer changes only) | | |
| 6. Spooky-action surfaces checked and declared clear or flagged | | |

**Blast-radius report format:**

```
Changed file: <path>
Importers: <count> (<list or "see PR body">)
Classification: <internal | API-compat | breaking | behavioural>
Blast radius: <contained | moderate | high>
Data-layer impact: <none | schema change | query-plan regression risk>
Spooky-action surfaces: <none | <list of surfaces>>
Hand-off: <change-risk-evaluation for overall risk | rollback-planning for reverse path | coverage-gap-detection for test surface>
```
