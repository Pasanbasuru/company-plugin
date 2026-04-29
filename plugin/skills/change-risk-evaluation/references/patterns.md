# Change risk evaluation — detailed patterns

Reference companion to the lean `SKILL.md`. Load when the structured risk report needs depth on rating, blast-radius procedure, classification, deploy strategy, monitoring, rollback mechanism choice, migration reversibility, dual-support, or rehearsal.

The table of contents mirrors the Core rule groups in the SKILL.md.

- [Structured risk-report example](#structured-risk-report-example) — output shape
- [Risk-rating rubric](#risk-rating-rubric) — Group A
- [Deploy strategy selection](#deploy-strategy-selection) — Group A
- [Monitoring signal selection](#monitoring-signal-selection) — Group A
- [Stakeholder notification list](#stakeholder-notification-list) — Group A
- [Blast-radius estimation](#blast-radius-estimation) — Group B
- [Change classification (internal / API-compat / breaking / behavioural)](#change-classification-internal--api-compat--breaking--behavioural) — Group B
- [Schema and query-plan impact](#schema-and-query-plan-impact) — Group B
- [Spooky-action warning list](#spooky-action-warning-list) — Group B
- [Rollback mechanism taxonomy](#rollback-mechanism-taxonomy) — Group C
- [Data migration reversibility](#data-migration-reversibility) — Group C
- [Feature flags as rollback](#feature-flags-as-rollback) — Group C
- [Dual-support windows](#dual-support-windows) — Group C
- [Rehearsal for high-risk](#rehearsal-for-high-risk) — Group C

---

## Structured risk-report example

A complete report for a behavioural change to a high-traffic API endpoint, fully populated against the 18 rules.

**Bad — ad-hoc "low risk" vibes claim:**

> This PR adds a new field to the user profile response. Low risk, it's backwards compatible and we've tested it locally. Deploying straight to prod.

This tells an approver nothing actionable. There is no rating justification, no importer list, no monitoring plan, and no rollback trigger.

**Good — structured risk report:**

```
## Risk report

**Rating:** Medium
**Justification:** New field added to the `/users/:id` response; 3 downstream services
consume this endpoint. Two are confirmed forward-compatible; one (ReportService) uses
a strict deserialiser — verified compatible after config update in this PR.

**Affected users:** All authenticated users; profile reads affect the dashboard landing
page (~40 000 daily active users). No write path changed.

**Affected services:**
- ReportService (read, config updated in this PR)
- NotificationService (read, forward-compatible, no change needed)
- MobileApp v2.x (read, field is optional, confirmed by mobile team)

**Affected business processes:** User onboarding flow (profile completeness check),
weekly report export (ReportService consumes the new field for display only).

**Importers / classification:** 8 importers across 2 services (moderate blast radius).
Classification: behavioural (additive field; existing callers unaffected). Spooky-action
surfaces: none. Query-plan impact: none.

**Deploy strategy:** Feature flag (LaunchDarkly flag: `user-profile-extended-fields`)
- Phase 1: flag off — deploy to production, no user impact.
- Phase 2: flag on for 5 % of users — canary exposure for 30 minutes.
- Phase 3: if error rate stable, ramp to 100 % over 60 minutes.
- Kill switch: toggle flag off instantly via LaunchDarkly console to revert behaviour
  without a redeploy.

**Monitoring signals:**
- Datadog dashboard: "User Profile API — p99 latency + error rate" (link: <url>)
- CloudWatch alarm: `UserProfileEndpoint5xxRate` — fires if 5xx rate > 0.5 % over 5 min.
- CloudWatch alarm: `ReportServiceDeserialiseError` — fires on any deserialisation
  exception from ReportService; threshold: > 0 errors in 5 minutes.
- LaunchDarkly: flag evaluation metrics for `user-profile-extended-fields`.

**Rollback trigger:** If `UserProfileEndpoint5xxRate` alarm fires, or if any
`ReportServiceDeserialiseError` is observed, roll back immediately.

**Rollback path:** Toggle `user-profile-extended-fields` flag off in LaunchDarkly —
instant, no redeploy required. Estimated time-to-rollback: < 2 minutes.
If code revert is required: `git revert <sha>` + re-deploy; estimated time: ~8 minutes.
Rehearsed in staging on 2026-04-22 — flag toggle propagated within 4 seconds, smoke
tests green.

**Stakeholders notified before deploy:**
- @alice (backend lead, owns user-profile service) — approved.
- @bob (on-call engineer, week of 2026-04-22) — notified via #deployments Slack.
- @carol (ReportService owner) — confirmed compatibility, approved.
- @dave (mobile team lead) — confirmed MobileApp v2.x is unaffected.
- @support-lead — notified; no customer-facing change expected, no support brief required.
```

---

## Risk-rating rubric

The rating is a function of blast radius, reversibility, and business-process criticality. Apply the highest applicable tier — do not average them.

**Critical** — Any of the following: authentication or authorisation logic changed; payment or billing data path affected; data migration that cannot be reversed; change affects all users of a multi-tenant system simultaneously; on-call pager is the expected first signal of breakage. Critical changes require a deploy strategy that is not straight-through, a named rollback trigger agreed before deploy, and a change-advisory sign-off. Monitoring must be in place and verified before the deploy window opens.

**High** — Any of the following: change affects > 20 % of active users or > 1 000 concurrent sessions; a shared utility, middleware, or singleton is modified; an external API contract changes without a dual-support window; a feature flag is permanently removed (not toggled); a database index is dropped or a column type is changed. High-risk changes require a canary, blue/green, or feature-flag deploy, a named stakeholder per affected downstream, and a pre-agreed rollback trigger.

**Medium** — Any of the following: new field added to an existing API response consumed by ≥ 2 downstream services; background job schedule or retry behaviour changes; cache TTL or eviction policy changes; a new dependency with no prior production usage is added. Medium-risk changes should use a feature flag where possible, or a staged rollout. Monitoring signals must be named.

**Low** — All of the following: change is isolated to a single feature module with no shared-state surface; no external contract changes; blast radius is ≤ 3 importers all within the same service; the change is behind a feature flag that defaults off; rollback is a flag toggle. Low-risk changes may deploy straight-through with standard monitoring; a structured report is still recommended for audit purposes but the template may be abbreviated.

When the rating is contested, escalate to the higher tier. Underrating risk is always more costly than overrating it.

---

## Deploy strategy selection

Choose the strategy against the risk rating. Do not choose a lower-risk strategy than the rating demands without explicit written justification from the lead approver.

**Straight-through** — Deploy the new version to all instances simultaneously. Acceptable only for low-risk changes behind a feature flag that defaults off, or for changes with a blast radius limited to a single internal module with no shared-state surface. If anything breaks, the only recovery path is a revert-and-redeploy, which takes minutes. Never use straight-through for high or critical changes.

**Rolling** — Instances are replaced with the new version one at a time (or in small batches). At any point during the deploy, some instances run the old version and some run the new version. Suitable for medium-risk stateless services where the old and new versions are request-compatible. Not suitable for changes that are not backward-compatible with concurrent old-version requests (e.g., a database migration that removes a column the old version still reads).

**Canary** — A small fraction of traffic (typically 1–10 %) is routed to the new version. Monitor error rate, latency, and business metrics for the canary cohort before expanding. Suitable for high-risk user-facing changes. Requires that the routing layer supports weighted traffic splitting (e.g., AWS ALB weighted target groups, Kubernetes traffic splitting via a service mesh). Define the canary window duration and the expansion threshold before deploy — do not make them up during the deploy.

**Blue/green** — Two identical production environments; traffic is switched at the load balancer from the live (blue) environment to the new (green) environment. The blue environment remains intact and warm. Rollback is an immediate load-balancer switch, typically under 30 seconds. Use for critical changes, for changes that cannot tolerate a mixed-version state, and for deployments that require a clean cutover without gradual ramp. Blue/green requires maintaining two full environments simultaneously, which has cost implications for large infrastructure footprints.

**Feature flag (LaunchDarkly or equivalent)** — The new behaviour is deployed to all instances but remains inactive until the flag is toggled. Rollback is a flag toggle in the LaunchDarkly console with no redeploy required; estimated time-to-rollback is typically under two minutes. Feature flags are the preferred strategy for medium-to-high risk behavioural changes, A/B experiments, and changes that need a kill switch independent of the deployment pipeline. Ensure the flag is not permanent — schedule a cleanup ticket before the deploy. LaunchDarkly kill-switch procedure: navigate to the flag in the LaunchDarkly console, toggle the targeting to "Serve false" for all users, save. No infrastructure action required.

For any strategy other than straight-through, define the rollback procedure and the rollback trigger threshold before the deploy window opens. Do not improvise these during an incident.

---

## Monitoring signal selection

Monitoring signals are only useful if they are named, linked, and watched by a named person during the deploy window. "We'll watch prod" is not a signal; it is an intention that will not survive the first distraction.

**Error rate and latency** are the baseline signals for every deploy. Name the specific CloudWatch alarm or Datadog monitor, not just the metric. For a CloudWatch alarm, record the alarm name, the metric name, the threshold, and the evaluation period (e.g., `UserProfileEndpoint5xxRate` — `AWS/ApplicationELB HTTPCode_Target_5XX_Count`, threshold > 10 in 5 minutes, `TreatMissingData: notBreaching`). For a Datadog monitor, record the monitor ID and the alert condition. Link to the dashboard where both are visible together.

**Business-process signals** should accompany every change that touches a revenue path, a user-facing flow, or an SLA-bearing background job. For a checkout flow, monitor conversion rate. For a report export job, monitor job completion rate and error count. For a notification pipeline, monitor delivery rate. These signals often lag error-rate signals but catch a broader class of regression that does not produce HTTP 5xx responses (e.g., a job that completes with wrong data).

**Service-specific signals** for common patterns:

- **API endpoints:** CloudWatch `HTTPCode_Target_5XX_Count` and `TargetResponseTime` (p99) on the target group; Datadog APM service dashboard for throughput, error rate, and latency distribution.
- **Background jobs / queues:** CloudWatch `ApproximateNumberOfMessagesNotVisible` (SQS queue depth) and `NumberOfMessagesFailed`; Datadog infrastructure metric for worker CPU and memory; Dead Letter Queue depth alarm (`DLQDepth > 0`).
- **Database layer:** CloudWatch `DatabaseConnections`, `CPUUtilization`, and `ReadLatency`/`WriteLatency` on the RDS instance; Datadog Database Monitoring for slow queries and wait events; `pg_stat_activity` query count if using direct Postgres access.
- **Feature flags:** LaunchDarkly flag evaluation metrics — impression count, variation distribution, and error rate. An unexpected shift in variation distribution (e.g., the `true` cohort drops from 5 % to 0 %) is an early signal of a flag evaluation error.
- **External integrations:** Third-party API error rate and latency from the integration layer; dead-letter queue depth for async event delivery; webhook delivery failure rate if outbound webhooks are involved.

Set CloudWatch alarms to `TreatMissingData: breaching` for signals that should always be reporting. A gap in metrics is itself a signal of a problem — a service that stops emitting metrics has usually stopped working.

Verify that alarms are in `OK` state before the deploy window opens. An alarm that is already `ALARM` at deploy time provides no signal value — it must be resolved or acknowledged before the deploy proceeds.

---

## Stakeholder notification list

A stakeholder is anyone whose SLA, on-call rotation, or user-facing product is affected by a failure of the change. The notification list is agreed before deploy, not assembled during an incident.

**Always notify:**

- The **on-call engineer** for the affected service — by name, not by role. Post in the team's #deployments Slack channel with the deploy time, the risk rating, the rollback trigger, and the rollback procedure. The on-call engineer should acknowledge the message before the deploy window opens.
- The **team lead** for the service being deployed — they own the risk rating sign-off for high and critical changes.
- The **team lead for every downstream service** that is confirmed affected by blast-radius analysis. "Affected" means the downstream service may observe different behaviour, not just that it imports the changed module.

**Conditionally notify:**

- **Support lead** — notify whenever a change affects a user-facing flow, a pricing or billing path, or any feature that generates inbound support tickets. Provide a one-paragraph summary of the expected user impact and a timeline. If no user-facing change is expected, state that explicitly so support can confirm or challenge the assessment.
- **Product manager** — notify for changes that affect feature behaviour visible to end users, changes to A/B test variants, or changes that affect reported metrics used for product decisions.
- **Security team** — notify for any change to authentication, authorisation, session management, token handling, or data-access controls, regardless of how small the diff appears. Security implications are non-obvious from diff size.
- **Data / analytics team** — notify for any change that alters event shapes, tracking payloads, or database schemas that feed reporting pipelines. A schema change that looks safe for the application layer can silently break an analytics pipeline that depends on column presence.

**Escalation path for critical changes** — For critical-rated changes, notification is not sufficient. Require explicit written acknowledgement from the on-call engineer, the team lead, and every affected downstream service owner before the deploy window opens. Document the acknowledgements in the PR or the deploy ticket. If any stakeholder is unreachable, the deploy is blocked until they are reached or a named senior engineer accepts the risk in writing.

The notification list is also the call list if the rollback trigger fires. Verify that every person on the list is reachable (not on leave, not in a timezone that makes them unreachable during the deploy window) before committing to the deploy time.

---

## Blast-radius estimation

Blast radius is the set of modules, services, and features that can produce different observable behaviour as a result of this change. Estimating it accurately is the first step of any risk analysis.

Start with the directly changed file. Use `git log --follow -- <file>` to confirm the file's identity has been stable (renames and moves can cause importer scans to miss historical consumers). Then enumerate direct importers: grep the codebase for import paths or require calls that resolve to the changed file, or use `ts-morph`'s `ReferenceFinder` for a fully type-resolved call graph that accounts for TypeScript path aliases and barrel re-exports.

Barrel re-exports deserve special attention. If `src/utils/index.ts` re-exports the changed function, every module that imports from `src/utils` is an indirect consumer. Walk the re-export chain one level at a time until you reach concrete call sites or hit a boundary (a service entry point, a public package export, or a test file).

Once the importer list is complete, categorise the blast radius:

- **Contained** (1–3 importers, all in the same feature module, all under test): the PR can proceed with targeted regression testing of those importers.
- **Moderate** (4–10 importers, or importers spanning multiple features): require explicit verification of each importer in the PR description, and ensure the test plan covers the cross-feature surface.
- **High** (> 10 importers, or any importer in a separate deployment unit): escalate to senior review, require a staged rollout or feature flag, and consider whether the change should be split into a backward-compatible shim followed by a migration.

For changes that touch cross-service contracts — shared libraries consumed by multiple backend services, or SDK packages with external consumers — add the coordination cost to the blast-radius assessment. A breaking change that requires simultaneous deployment of two services is a higher-risk event than a self-contained change within a single service.

### Good vs bad: blast-radius PR description

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

When any of the above surfaces is touched, the risk assessment must state so explicitly, name the affected runtime scope, and require a broader test surface before the change is approved.

---

## Rollback mechanism taxonomy

Not all rollback mechanisms are equal. Choose based on scope, speed, and reversibility.

**Feature flag toggle** is the fastest and most surgical rollback. It changes behaviour without touching the artifact or the database. It requires the code to already have a flag-gated branch. Use this for new features, changed algorithms, third-party integrations, and any behavioural change that can be expressed as a boolean or percentage rollout. The mechanism is instant: flip the flag in the flag service (LaunchDarkly, Unleash, etc.) and the change is live within seconds for all new requests.

**Deploy rollback** reverts to a previous artifact version. On ECS, this means updating the service to point at the previous task definition revision. On Lambda, this means re-targeting the alias to the previous version. The speed depends on your deployment pipeline — 5 minutes for ECS with fast health checks, 30 seconds for Lambda alias retarget. Deploy rollback reverts all code changes in the artifact, not just the one you want to undo. This is acceptable when the entire deploy is a single logical unit, but problematic when several unrelated changes landed together.

ECS task definition rollback example:
```bash
# Get the previous task definition ARN
PREV_TASK_DEF=$(aws ecs describe-services \
  --cluster prod --services api \
  --query 'services[0].deployments[?status==`PRIMARY`].taskDefinition' \
  --output text | sed 's/:[0-9]*$//')

# Roll back by registering the previous revision as the new desired state
aws ecs update-service \
  --cluster prod \
  --service api \
  --task-definition "${PREV_TASK_DEF}:$((CURRENT_REVISION - 1))"
```

Lambda alias retarget example:
```bash
# Point the PROD alias back to the previous version
aws lambda update-alias \
  --function-name order-processor \
  --name PROD \
  --function-version $PREVIOUS_VERSION
```

**Database migration rollback** runs the `down` migration. It is only possible if the `down` exists and has been tested. It is the slowest of the three mechanisms because it touches data, may require backfilling, and may need application downtime to prevent writes during the migration. This is why the expand/contract pattern — where the schema change is split into additive and destructive phases — is strongly preferred.

**Contract rollback** rolls back a producer API or event schema to the previous version. It requires that the previous version is still deployed (blue/green or versioned endpoints) or that the new format is backward-compatible enough that consumers can still function. Without dual support in place, contract rollback breaks consumers.

---

## Data migration reversibility

The default posture is: every migration has a `down`. The burden of proof is on declaring a migration irreversible.

Prisma generates `up`/`down` in SQL migrations. Always inspect and validate both directions manually before applying to staging. Prisma's auto-generated `down` for column additions is correct, but for column renames or type changes it may be wrong or missing.

Example of a complete Prisma migration pair:
```sql
-- migration: 20240601_add_fulfilment_status

-- up
ALTER TABLE "Order" ADD COLUMN "fulfilment_status" TEXT NOT NULL DEFAULT 'pending';
CREATE INDEX "Order_fulfilment_status_idx" ON "Order"("fulfilment_status");

-- down
DROP INDEX "Order_fulfilment_status_idx";
ALTER TABLE "Order" DROP COLUMN "fulfilment_status";
```

Test the `down` in a local database before merging. Confirm it does not error, and that the application at the previous commit still functions after the `down` has been run.

When a migration genuinely cannot be reversed — for example, a destructive normalisation that merges two tables — the forward-only decision must be documented explicitly in the migration file and reviewed:
```sql
-- IRREVERSIBLE — see ADR-042
-- Reason: merges redundant address tables; old structure cannot be restored
--   without a full data export from backup.
-- Recovery plan: restore from RDS snapshot taken immediately before this migration.
-- Snapshot name convention: pre-migration-YYYYMMDD-<ticket>
-- down: intentionally omitted
```

The expand/contract pattern avoids irreversibility for most schema changes. The expand phase adds new columns or tables without removing anything. Application code is then updated to write to both old and new, and to read from new with a fallback to old. Once the expand phase has been stable in production for a defined period (typically one full deploy cycle or two weeks, whichever is longer), the contract phase removes the old columns. The contract phase migration is the only irreversible step, and by that point you have high confidence the new structure is correct.

### Reversible vs one-way migration example

**Bad — one-way migration with no fallback:**
```sql
-- up
ALTER TABLE orders DROP COLUMN legacy_status;

-- down (missing entirely)
```
If the app that reads `legacy_status` is still deployed, or if you need to roll back, the column is gone.

**Good — reversible migration using expand/contract:**
```sql
-- up: add new column, keep old one (expand phase)
ALTER TABLE orders ADD COLUMN status_v2 VARCHAR(50);
UPDATE orders SET status_v2 = legacy_status WHERE status_v2 IS NULL;

-- down: remove new column only; legacy_status is still intact
ALTER TABLE orders DROP COLUMN status_v2;
```
The old column survives until every consumer has migrated and the change has been stable in production long enough to be confident (contract phase). Only then is `legacy_status` removed in a separate migration.

---

## Feature flags as rollback

A feature flag is only a rollback mechanism if it is designed as one. Three properties are required:

1. **The old path is preserved in code.** If you deleted the old implementation when you introduced the new one, the flag is a percentage rollout gate, not a kill switch. The old implementation must remain callable until the flag is retired.

2. **The flag defaults off in production until explicitly enabled.** A flag that defaults on means a newly deployed service is already running the new code. Toggling the flag off after detecting a problem is a rollback — valid — but it is slower than never enabling it in the first place.

3. **The flag can be toggled without a deploy.** This requires an external flag service (LaunchDarkly, Unleash, AWS AppConfig) rather than an environment variable baked into the artifact. Changing an environment variable typically requires a deploy.

LaunchDarkly kill switch pattern:
```typescript
import * as LaunchDarkly from '@launchdarkly/node-server-sdk';

const client = LaunchDarkly.init(process.env.LAUNCHDARKLY_SDK_KEY!);

export async function getNewPricingEngine(userId: string): Promise<boolean> {
  const context: LaunchDarkly.LDContext = { kind: 'user', key: userId };
  // Default false — flag must be explicitly turned on per environment
  return client.variation('new-pricing-engine', context, false);
}
```

When an incident is detected, the on-call engineer disables `new-pricing-engine` in the LaunchDarkly dashboard. All subsequent requests fall through to the old path within seconds, with no deployment required.

Flag hygiene matters for rollback reliability. A flag that has not been tested in its off state for six months may have bitrotted — the old code path may have broken dependencies. Flags used as rollback mechanisms must be tested in both states during CI or staging validation as part of the deploy checklist.

### Feature-flag rollback vs deploy-revert-only

**Bad — rollback requires a full deploy revert:**
```typescript
// Behaviour is hardcoded; reverting requires redeploying the previous artifact
export async function processOrder(order: Order) {
  return newCheckoutFlow(order); // replaced old flow directly
}
```
Reverting means cherry-picking a revert commit, building, and deploying — typically 15–30 minutes minimum, and it reverts every other change in the artifact.

**Good — feature flag as kill switch:**
```typescript
import { featureFlags } from '@/lib/flags';

export async function processOrder(order: Order) {
  const useNewFlow = await featureFlags.isEnabled('new-checkout-flow', {
    userId: order.userId,
  });
  return useNewFlow ? newCheckoutFlow(order) : legacyCheckoutFlow(order);
}
```
Disabling `new-checkout-flow` in LaunchDarkly is immediate, requires no deploy, and leaves every other change in production untouched.

---

## Dual-support windows

When you change an API contract — request shape, response shape, event schema, or database-read contract shared across services — a dual-support window is the only way to make rollback of either side safe.

The pattern:

1. **Producer adds new format, keeps old format running in parallel.** Both versions respond correctly. The new format may be at a new endpoint version (`/v2/orders`) or the old endpoint may conditionally support both shapes (content negotiation, additive fields).

2. **Consumers are migrated to the new format.** Until all consumers are migrated, the producer must serve both. Time-box this: if migration takes more than two weeks, the window is too long and you should question whether the change is correctly scoped.

3. **Old format is removed.** Only after all consumers are confirmed on the new format and the system has been stable for at least one full deploy cycle.

If at any point during steps 1–2 a problem is found, you can roll back the producer without breaking any consumer, because every consumer still has the old format available. Similarly, you can roll back individual consumers without breaking the producer.

Without dual support, rolling back the producer after consumers have migrated breaks all consumers that have already adopted the new format. This creates a situation where rollback of one service forces immediate rollback of all dependents — a cascading rollback that is almost always worse than the original incident.

For event-driven systems, the same principle applies to event schemas. Old consumers must be able to read new events (backward compatibility), or the producer must publish both old and new event versions on separate topics until all consumers migrate.

---

## Rehearsal for high-risk

High-risk is defined as: any change where a failed rollback causes data loss, extended outage (more than one hour), or cascading failures across more than two services. This includes major schema migrations, auth system changes, payment flow changes, and cross-region infrastructure moves.

Rehearsal in staging consists of:

1. **Deploy the change to staging fully.** Confirm it works as intended.
2. **Execute the rollback procedure exactly as documented.** Do not improvise — use the runbook.
3. **Confirm the system returns to the pre-change state.** Automated smoke tests should pass. If they do not, the rollback procedure is broken.
4. **Document what broke during rehearsal and fix it before the production deploy.**

Rehearsal surfaces problems that code review cannot: wrong SQL syntax in the `down` migration, a missing environment variable in the rollback script, a service that does not restart cleanly after a Lambda alias retarget, or a flag that does not propagate within the expected time window.

For database migrations specifically, rehearsal should be performed on a staging database that has been seeded with production-like data volume. A migration that runs in two seconds on a 1,000-row staging table may take 45 minutes on a 50-million-row production table and hold an `ACCESS EXCLUSIVE` lock the entire time. This is a rollback blocker, not just a performance issue, because you cannot run the `down` migration while the `up` is still running.

Estimated time-to-rollback should be recorded after rehearsal and included in the deploy checklist. If the measured time exceeds the SLA for the service (typically 15 minutes for a P1 incident response), the rollback mechanism must be redesigned before the change ships.
