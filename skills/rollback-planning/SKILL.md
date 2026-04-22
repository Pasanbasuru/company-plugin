---
description: Use when a change is rated medium or higher risk, or touches data / infrastructure / contracts. Do NOT use for trivial changes behind a feature flag that defaults off. Covers rollback path, forward-fix vs rollback, data-change reversibility, feature-flag kill switches, time-to-rollback.
---

Every risky change has a written rollback — before it ships, not during the incident.

## Assumes `_baseline`. Adds:

Rollback design discipline — rollback mechanism taxonomy (flag/deploy/migration/contract), data migration reversibility requirements, feature-flag kill-switch design, time-to-rollback measurement, dual-support windows, and high-risk staging rehearsal.

## Core rules

1. **Rollback path is written before merge.** A change with no rollback path is either trivial or not mergeable.
   *Why:* Designing rollback under pressure at 3am produces the wrong plan or no plan. Writing it before merge forces you to think through failure modes while you still have full context.

2. **Data migrations are reversible in code, or explicitly forward-only with a stated reason and a data-recovery plan.** A `down` migration must exist and must be tested unless you consciously declare the migration irreversible and document why.
   *Why:* A broken `up` migration with no `down` forces a manual recovery that is slow, error-prone, and likely to cause data loss under pressure.

3. **A feature flag with a kill switch is the rollback mechanism for behavioural changes.** If you are changing runtime behaviour, the flag is not a nice-to-have — it is the rollback path.
   *Why:* Reverting a deploy can take 10–30 minutes and may inadvertently revert unrelated changes that landed in the same artifact. Flipping a flag is near-instant and surgical.

4. **Time-to-rollback is measured.** A rollback that takes hours is effectively no rollback — fix the deployment pipeline, not the runbook.
   *Why:* The window between detecting an incident and customer impact is usually minutes. If your rollback takes longer than that window, you need a faster mechanism.

5. **Contract/breaking changes require a period of dual support to enable rollback without downstream breakage.** You cannot roll back a producer if the consumer already requires the new format and has no fallback.
   *Why:* Rollback of one service in a tightly coupled pair can break the other. Dual support gives you a safe window to roll back either side independently.

6. **Rehearsal: for high-risk changes, the rollback is practised in staging before the production deploy.** Running the rollback once in staging costs minutes; discovering it does not work in prod costs hours.
   *Why:* Rollback scripts, migration `down` steps, and flag toggles all have their own bugs. Find them when the stakes are low.

## Red flags

| Signal | Why it matters |
|--------|----------------|
| "We'll figure out rollback if needed" | At 3am with users affected, you will not have the mental bandwidth or the context to design a rollback. The plan must exist before you ship. |
| "Migration is one-way, YOLO" | A one-way migration without a data-recovery plan means any bug in the migration permanently corrupts or loses data. Either write a tested `down`, or write a formal recovery procedure and get it reviewed. |

## Good vs bad

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

### Reversible migration vs one-way migration

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

---

## Review checklist

- [ ] Rollback path is documented before merge (not "TBD").
- [ ] If data migration: `down` migration exists and has been run locally against a copy of the schema.
- [ ] If behavioural change: a feature flag with a kill switch is in place, defaulting off.
- [ ] Time-to-rollback has been estimated; if it exceeds 15 minutes, a faster mechanism is required.
- [ ] If contract change: dual-support window is planned with a defined end date.
- [ ] For high-risk changes: rollback rehearsed in staging; outcome documented.
