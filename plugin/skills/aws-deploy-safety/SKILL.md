---
name: aws-deploy-safety
description: Use when deploying to AWS (ECS Fargate, Lambda, App Runner) or changing deploy-related AWS resources (task definitions, Lambda config, secrets references, roles consumed at runtime). Do NOT use for IaC review (use `infra-safe-change`) or for CI pipeline integrity (use `cicd-pipeline-safety`). Covers deploy strategies, task role discipline, Secrets Manager integration, health checks, rolling vs blue-green, zero-downtime migrations.
allowed-tools: Read, Grep, Glob, Bash
---

# AWS deploy safety

## Purpose & scope

Make AWS deploys boring — safe defaults, predictable rollout, fast recovery. This skill applies at the moment a change is pushed toward a running service: a new task definition revision, a Lambda `$LATEST` promotion, an App Runner deployment, or a secrets reference swap. It does not replace infrastructure provisioning review (`infra-safe-change`) or pipeline integrity checks (`cicd-pipeline-safety`); it owns the deploy mechanics layer between the two.

## Core rules

1. **Task and function execution roles are distinct; neither grants `*` actions.** — *Why:* a single overpermissioned role means a compromised container or function can read every secret, write to every bucket, and call every API in the account. Separating task role (what the app needs) from execution role (what ECS/Lambda needs to start the container — ECR pull, Secrets Manager fetch, CloudWatch Logs write).

2. **Secrets are injected via Secrets Manager ARN references in the task definition `secrets` field (or Lambda environment resolved at deploy time), never as plaintext in the `environment` field.** — *Why:* plaintext is stored in task-definition JSON and visible in CloudTrail, console, and CI logs.

3. **ECS rolling deploys set `minimumHealthyPercent` and `maximumPercent` explicitly; higher-risk services use CodeDeploy blue/green.** — *Why:* AWS defaults (`minimumHealthyPercent: 100`, `maximumPercent: 200`) work for small clusters but can stall on single-instance services or exhaust capacity on large ones. Blue/green adds a stable test traffic window and an instant rollback path.

4. **Lambda user-facing functions are promoted through an alias with traffic shifting (linear or canary), not by pointing traffic directly at `$LATEST`.** — *Why:* `$LATEST` is mutable; aliases are stable. Weighted aliasing canaries 10%, watches errors, then cuts over or resets.

5. **Health checks reflect real readiness — DB connectivity, critical dependency reachability — not just a static HTTP 200.** — *Why:* Static-200 health checks mark tasks healthy before the app can serve, producing 502 surges. A real readiness probe catches bad creds, wrong endpoints, ACL issues at deploy time.

6. **Schema migrations run before app rollout and are backwards-compatible with the previous version (expand/contract pattern).** — *Why:* Deploying new app before migration → 500s; dropping a column while old app serves → 500s. Expand/contract separates the risk.

7. **Log group retention is set explicitly (CloudWatch Logs retention policy) — no group is left at the default "never expire".** — *Why:* unset retention means logs accumulate indefinitely. CloudWatch Logs storage is billed per GB; a verbose service can silently accumulate significant cost over months. Explicit retention (30 days for non-compliance workloads, 90–365 days where audit trails are required).

## Red flags

| Thought | Reality |
|---|---|
| "One role for everything — easier to manage" | Blast radius on compromise spans the entire account. A bug in one service can exfiltrate every secret. |
| "Plaintext secret in the `environment` block of the task definition" | The secret lives in ECS task definition state, CloudTrail, and any CI log that prints the JSON. Rotation does not help until the task definition is also updated. |
| "`/ping` returns 200, so the deploy is fine" | The health check says the process is listening, not that it can serve requests. A misconfigured DB URL, missing secret, or half-initialised cache will be invisible until real traffic hits the 500 paths. |

## Good vs bad

### Secrets: Secrets Manager ARN vs plaintext in environment

Bad — secret value is embedded in the task definition:

```json
{
  "name": "DATABASE_URL",
  "value": "postgres://app:hunter2@prod-db.cluster.example.com:5432/app"
}
```

Good — ARN reference resolved by the ECS agent at launch time:

```json
{
  "name": "DATABASE_URL",
  "valueFrom": "arn:aws:secretsmanager:eu-west-1:123456789012:secret:prod/app/database-url-AbCdEf"
}
```

The ECS task execution role needs `secretsmanager:GetSecretValue` on this ARN (and `kms:Decrypt` if a CMK is used).

### Health check: readiness probe hitting DB vs static `/ping`

Bad — health check that always succeeds regardless of app state:

```typescript
// Express
app.get('/ping', (_req, res) => res.status(200).json({ ok: true }));
```

ECS marks healthy on listener bind; bad `DATABASE_URL` returns 500 on real traffic while health check stays green.

Good — readiness check that verifies critical dependencies before accepting traffic:

```typescript
app.get('/ready', async (_req, res) => {
  try {
    await db.$queryRaw`SELECT 1`; // Prisma or pg pool
    res.status(200).json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready', reason: String(err) });
  }
});
```

Point the ALB target group health check at `/ready`. ECS will not mark the task healthy — and will not route traffic to it — until the DB connection succeeds. A failed `SELECT 1` surfaces misconfigured credentials, wrong endpoint, or a network ACL problem during the deploy, not during peak traffic.

Keep `/ping` as a separate liveness endpoint (returns 200 immediately, used only by ECS task health — not the ALB).

---

## ECS rolling deploy parameters

ECS rolling deploys are controlled by two service-level parameters and one deployment circuit breaker.

**`minimumHealthyPercent`** — minimum running tasks (% of desired) during a deploy; ECS won't terminate below this. **`maximumPercent`** — maximum running tasks; ECS won't surge above this.

Recommended defaults for a service with `desiredCount: 2`:

```hcl
deployment_configuration {
  minimum_healthy_percent = 50   # allows rolling: stop 1 old, start 1 new
  maximum_percent         = 150  # allows surge: start 1 new before stopping 1 old
}
```

For `desiredCount: 1` (dev/staging single-instance), set `minimumHealthyPercent: 0` and `maximumPercent: 200`. Brief downtime; do not use in prod.

**Deployment circuit breaker** — enable it:

```hcl
deployment_circuit_breaker {
  enable   = true
  rollback = true
}
```

ECS auto-reverts on failed health checks; without it, deploys stall.

**Blue/green via CodeDeploy** is appropriate when:
- The service handles payments, authentication, or writes that cannot be retried safely.
- You need a test traffic period (e.g. 10 % for 10 minutes) before shifting all traffic.
- Instant rollback (flip ALB listener rule back) is a hard requirement.

In blue/green, ECS registers the new task set as the green target group. CodeDeploy shifts a configurable percentage of ALB traffic to green, waits for a bake period, then shifts the rest. Rollback is a single `StopDeployment` API call — no re-deploy needed. The tradeoff is operational complexity: CodeDeploy deployment groups, AppSpec files, and IAM roles for the CodeDeploy service principal.

---

## Lambda alias + traffic shift

`$LATEST` is a mutable pointer to the most recently published code. Never route production traffic directly to `$LATEST`.

The safe pattern:

1. Publish a new version: `aws lambda publish-version --function-name my-fn` → returns `Version: "42"`.
2. Update the alias weight:

```bash
aws lambda update-alias \
  --function-name my-fn \
  --name prod \
  --routing-config '{"AdditionalVersionWeights": {"42": 0.1}}'
```

This sends 10 % of invocations to version 42, 90 % to the alias's current primary version. Monitor CloudWatch metrics for the new version's error rate and duration for a bake period (5–15 minutes for synchronous functions; at least one full queue drain cycle for async).

To complete the shift:

```bash
aws lambda update-alias \
  --function-name my-fn \
  --name prod \
  --function-version 42 \
  --routing-config '{}'
```

To roll back instantly — reset the weight to 0 for version 42 and the alias continues pointing to the previous version:

```bash
aws lambda update-alias \
  --function-name my-fn \
  --name prod \
  --routing-config '{}'
```

**CodeDeploy for Lambda** automates this as `Linear10PercentEvery1Minute` or `Canary10Percent5Minutes` deployment preferences and integrates CloudWatch alarms as automatic rollback triggers. Use it for functions that back user-facing APIs or that process financial events.

Don't shift traffic for async-only functions — both versions consume from the queue and may double-process.

---

## Health check design

AWS health checks operate at three distinct levels; conflating them leads to either false-healthy tasks or unnecessary restarts.

**Liveness** — "is the process still running?" Implemented as the ECS task health check (Docker `HEALTHCHECK` or ECS task definition `healthCheck`). Should be cheap: check that the HTTP listener is bound, or that the main process is alive.

```json
{
  "healthCheck": {
    "command": ["CMD-SHELL", "curl -f http://localhost:3000/ping || exit 1"],
    "interval": 30,
    "timeout": 5,
    "retries": 3,
    "startPeriod": 60
  }
}
```

Set `startPeriod` to at least your P95 cold-start time.

**Readiness** — "can this instance serve traffic?" Implemented as the ALB target group health check. Should verify that the application is connected to its dependencies and ready to handle real requests. Point it at `/ready` (or `/health/ready`), not `/ping`.

ALB target group settings to tune:

- `HealthCheckIntervalSeconds: 15` — check every 15 s during deploys, not the default 30 s, so unhealthy tasks are deregistered faster.
- `HealthyThresholdCount: 2` — require 2 consecutive successes before marking healthy.
- `UnhealthyThresholdCount: 3` — tolerate 2 transient failures before pulling traffic; prevents flapping.
- `HealthCheckTimeoutSeconds: 5` — match your `/ready` endpoint's timeout.

**Startup** — a separate higher-tolerance check during the initial startup window. ALB does not have a native startup probe concept; use `startPeriod` in the ECS health check and ensure `minimumHealthyPercent` keeps old tasks alive until new ones clear the ALB readiness check.

A common mistake is checking too many dependencies in `/ready`. Only check dependencies whose failure means the endpoint cannot return a correct response.

---

## Expand/contract schema migrations

**Phase 1 — expand (additive only).** The migration adds the new column, table, or index without removing or renaming anything. The old app version ignores the new column; the new app version writes to it.

Example: renaming `user.name` to `user.full_name`.

```sql
-- Phase 1 migration: add the new column, copy existing data
ALTER TABLE "user" ADD COLUMN full_name TEXT;
UPDATE "user" SET full_name = name;
```

Deploy the new app version. It reads and writes `full_name`. The old version still reads and writes `name`.

**Phase 2 — contract (cleanup).** Once the old app version is fully drained (all instances replaced), the old column is safe to remove.

```sql
-- Phase 2 migration: run after all instances are on the new version
ALTER TABLE "user" DROP COLUMN name;
```

Never combine — old containers will hit missing columns during rollout.

**Index creation.** Use `CREATE INDEX CONCURRENTLY` on Postgres. `CONCURRENTLY` takes a weaker lock and builds the index in the background — safe for a running service, though it takes longer and cannot run inside a transaction block.

**Prisma migrations.** Prisma's migration engine does not use `CONCURRENTLY` by default. For large tables, edit the generated migration SQL to use `CREATE INDEX CONCURRENTLY` and run it outside of Prisma's transaction wrapper (`--skip-generate` with a raw SQL step).

---

## Log retention

**Set retention in the task definition or IaC, not after the fact:**

```hcl
resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/my-service"
  retention_in_days = 30
}
```

Recommended retention tiers:

| Workload | Retention |
|---|---|
| Non-production (dev, staging) | 7–14 days |
| Production, non-regulated | 30 days |
| Production, audit trail required | 90–365 days (align with compliance policy) |
| Security / access logs | 365 days minimum (check your compliance framework) |

**Lambda log groups** are auto-created on first invocation. Pre-create the log group as an explicit IaC resource so retention applies from day one.

---

## Interactions with other skills

- **Owns:** AWS-level deploy mechanics — rolling strategy, alias traffic shifting, health check wiring, migration sequencing, secrets injection at deploy time, log retention at deploy time.
- **Hands off to:** infra-safe-change for provisioning the underlying resources (VPC, subnets, ECS cluster, Lambda function declaration, Secrets Manager secret creation).
- **Hands off to:** secrets-and-config-safety for how the application code fetches and uses secrets at runtime.
- **Hands off to:** change-risk-evaluation for the rollback trigger criteria and the runbook path.
- **Does not duplicate:** CI pipeline concerns (action pinning, OIDC, branch protection) — those belong to `cicd-pipeline-safety`.

## Review checklist

Produce a markdown report with these sections:

1. **Summary** — one line: pass / concerns / blocking issues.
2. **Findings** — per issue: *resource/file, severity (low/med/high), category, what is wrong, recommended fix*.
3. **Safer alternative** — if applicable, name an alternative approach and why the current one is riskier. Examples: prefer blue/green (CodeDeploy) over in-place ECS rolling updates for stateful or payment-handling workloads; prefer Secrets Manager rotation with short-lived fetched values over long-lived secret references baked into task definition revisions; prefer pre-creating the Lambda CloudWatch Logs group in IaC over letting the Lambda service auto-create it with no retention policy.
4. **Checklist coverage** — for each of the 7 core rules, mark: PASS / CONCERN / NOT APPLICABLE.
   - Rule 1: Task role and execution role are separate; neither has `*` actions
   - Rule 2: Secrets injected via Secrets Manager ARN, not plaintext in `environment`
   - Rule 3: `minimumHealthyPercent` / `maximumPercent` set explicitly; circuit breaker enabled; blue/green used where risk warrants
   - Rule 4: Lambda user-facing functions use aliases with traffic shifting
   - Rule 5: Health check verifies real readiness (DB / critical deps), not just HTTP listener liveness
   - Rule 6: Schema migrations are expand-only on first deploy; contract phase is deferred
   - Rule 7: CloudWatch Logs retention is set explicitly on all log groups
