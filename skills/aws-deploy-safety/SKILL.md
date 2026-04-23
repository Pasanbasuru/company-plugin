---
name: aws-deploy-safety
description: Use when deploying to AWS (ECS Fargate, Lambda, App Runner) or changing deploy-related AWS resources (task definitions, Lambda config, secrets references, roles consumed at runtime). Do NOT use for IaC review (use `infra-safe-change`) or for CI pipeline integrity (use `cicd-pipeline-safety`). Covers deploy strategies, task role discipline, Secrets Manager integration, health checks, rolling vs blue-green, zero-downtime migrations.
allowed-tools: Read, Grep, Glob, Bash
---

# AWS deploy safety

## Purpose & scope

Make AWS deploys boring — safe defaults, predictable rollout, fast recovery. This skill applies at the moment a change is pushed toward a running service: a new task definition revision, a Lambda `$LATEST` promotion, an App Runner deployment, or a secrets reference swap. It does not replace infrastructure provisioning review (`infra-safe-change`) or pipeline integrity checks (`cicd-pipeline-safety`); it owns the deploy mechanics layer between the two.

## Assumes `_baseline`. Adds:

AWS-specific deploy mechanics — rolling vs blue/green strategy, Lambda alias traffic shifting, health check readiness design, expand/contract migrations, and CloudWatch log retention at deploy time.

## Core rules

1. **Task and function execution roles are distinct; neither grants `*` actions.** — *Why:* a single overpermissioned role means a compromised container or function can read every secret, write to every bucket, and call every API in the account. Separating task role (what the app needs) from execution role (what ECS/Lambda needs to start the container — ECR pull, Secrets Manager fetch, CloudWatch Logs write) limits blast radius to one surface.

2. **Secrets are injected via Secrets Manager ARN references in the task definition `secrets` field (or Lambda environment resolved at deploy time), never as plaintext in the `environment` field.** — *Why:* plaintext values are stored in the task definition JSON, visible in CloudTrail, the ECS console, and any CI log that prints the definition. A Secrets Manager ARN reference means the value is fetched by the ECS agent at container launch and never materialises in state files or logs.

3. **ECS rolling deploys set `minimumHealthyPercent` and `maximumPercent` explicitly; higher-risk services use CodeDeploy blue/green.** — *Why:* AWS defaults (`minimumHealthyPercent: 100`, `maximumPercent: 200`) work for small clusters but can stall on single-instance services or exhaust capacity on large ones. Explicit values are a contract. Blue/green adds a stable test traffic window and an instant rollback path without re-deploying.

4. **Lambda user-facing functions are promoted through an alias with traffic shifting (linear or canary), not by pointing traffic directly at `$LATEST`.** — *Why:* `$LATEST` is mutable — every publish overwrites it. An alias is a stable pointer; weighted routing lets you shift 10 % of traffic to the new version, watch error rates for 10 minutes, then shift the rest or roll back by resetting the alias weight to 0 % for the new version.

5. **Health checks reflect real readiness — DB connectivity, critical dependency reachability — not just a static HTTP 200.** — *Why:* a health check that always returns 200 during container startup means ECS (and the ALB) marks the task healthy before the application can actually serve requests. Under load this produces a surge of 502s until the app finishes initialising. A readiness probe that verifies a DB connection catches misconfigured credentials, wrong endpoint, and network ACL problems before real traffic arrives.

6. **Schema migrations run before app rollout and are backwards-compatible with the previous version (expand/contract pattern).** — *Why:* deploying a new app version that assumes a column exists before the migration has run causes immediate 500s. Running a migration that drops or renames a column while the old app version is still handling requests causes the same. Expand/contract separates the risk: add without breaking, then deploy, then clean up.

7. **Log group retention is set explicitly (CloudWatch Logs retention policy) — no group is left at the default "never expire".** — *Why:* unset retention means logs accumulate indefinitely. CloudWatch Logs storage is billed per GB; a verbose service can silently accumulate significant cost over months. Explicit retention (30 days for non-compliance workloads, 90–365 days where audit trails are required) is a deployment contract, not an afterthought.

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

This value is stored in the task definition revision, visible in the ECS console, and emitted to CloudTrail on every `RegisterTaskDefinition` call.

Good — ARN reference resolved by the ECS agent at launch time:

```json
{
  "name": "DATABASE_URL",
  "valueFrom": "arn:aws:secretsmanager:eu-west-1:123456789012:secret:prod/app/database-url-AbCdEf"
}
```

The ECS task execution role needs `secretsmanager:GetSecretValue` on this ARN (and `kms:Decrypt` if a CMK is used). The plaintext value never appears in the task definition JSON or in CloudTrail's `RegisterTaskDefinition` event.

### Health check: readiness probe hitting DB vs static `/ping`

Bad — health check that always succeeds regardless of app state:

```typescript
// Express
app.get('/ping', (_req, res) => res.status(200).json({ ok: true }));
```

The ALB target group health check points at `/ping`. ECS marks the task healthy as soon as the HTTP listener starts. If `DATABASE_URL` is wrong the app will start returning 500s on every real request, but the health check keeps saying the task is healthy.

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

Keep `/ping` as a separate liveness endpoint (returns 200 immediately, used only by ECS task health — not the ALB) to distinguish "process is alive" from "process is ready to serve".

---

## ECS rolling deploy parameters

ECS rolling deploys are controlled by two service-level parameters and one deployment circuit breaker.

**`minimumHealthyPercent`** — the lower bound on running task count (as a percentage of desired count) during a deploy. ECS will not terminate old tasks if doing so would push the running count below this threshold.

**`maximumPercent`** — the upper bound. ECS will not launch new tasks if doing so would exceed this percentage of desired count.

Recommended defaults for a service with `desiredCount: 2`:

```hcl
deployment_configuration {
  minimum_healthy_percent = 50   # allows rolling: stop 1 old, start 1 new
  maximum_percent         = 150  # allows surge: start 1 new before stopping 1 old
}
```

For `desiredCount: 1` (dev/staging single-instance), set `minimumHealthyPercent: 0` and `maximumPercent: 200`. This is a brief downtime window but is acceptable for non-production. Never use `0/200` in production without understanding the implication: old and new versions run simultaneously during rollout.

**Deployment circuit breaker** — enable it:

```hcl
deployment_circuit_breaker {
  enable   = true
  rollback = true
}
```

With `rollback = true`, ECS automatically reverts to the previous stable task definition if the new tasks fail health checks during rollout. Without it, a failed deploy stalls indefinitely and requires a manual `update-service` call.

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
# (function-version stays on the old version until the full shift commit above)
```

**CodeDeploy for Lambda** automates this as `Linear10PercentEvery1Minute` or `Canary10Percent5Minutes` deployment preferences and integrates CloudWatch alarms as automatic rollback triggers. Use it for functions that back user-facing APIs or that process financial events.

**Do not shift traffic for async-only functions** (SQS consumers, EventBridge rules) using alias weights — both versions will consume from the queue simultaneously, which can cause duplicate processing if the function is not idempotent. For async functions, deploy atomically and rely on the circuit breaker + DLQ for error isolation.

---

## Health check design

AWS health checks operate at three distinct levels; conflating them leads to either false-healthy tasks or unnecessary restarts.

**Liveness** — "is the process still running?" Implemented as the ECS task health check (Docker `HEALTHCHECK` or ECS task definition `healthCheck`). Should be cheap: check that the HTTP listener is bound, or that the main process is alive. If this fails, ECS replaces the container.

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

`startPeriod` gives the container time to initialise before health check failures count against the retry limit. Set it to at least your observed P95 cold-start time.

**Readiness** — "can this instance serve traffic?" Implemented as the ALB target group health check. Should verify that the application is connected to its dependencies and ready to handle real requests. Point it at `/ready` (or `/health/ready`), not `/ping`.

ALB target group settings to tune:

- `HealthCheckIntervalSeconds: 15` — check every 15 s during deploys, not the default 30 s, so unhealthy tasks are deregistered faster.
- `HealthyThresholdCount: 2` — require 2 consecutive successes before marking healthy.
- `UnhealthyThresholdCount: 3` — tolerate 2 transient failures before pulling traffic; prevents flapping.
- `HealthCheckTimeoutSeconds: 5` — match your `/ready` endpoint's timeout.

**Startup** — a separate higher-tolerance check during the initial startup window. ALB does not have a native startup probe concept; use `startPeriod` in the ECS health check and ensure `minimumHealthyPercent` keeps old tasks alive until new ones clear the ALB readiness check.

A common mistake is checking too many dependencies in `/ready`. If a non-critical downstream service (e.g. an analytics sink) is down, the readiness check should not fail — the app can still serve requests. Only check dependencies whose failure means the endpoint cannot return a correct response.

---

## Expand/contract schema migrations

A deploy that changes the database schema while the previous app version is still running will cause downtime or data corruption unless the migration is designed to be backwards-compatible. The expand/contract pattern solves this.

**Phase 1 — expand (additive only).** The migration adds the new column, table, or index without removing or renaming anything. The old app version ignores the new column; the new app version writes to it.

Example: renaming `user.name` to `user.full_name`.

```sql
-- Phase 1 migration: add the new column, copy existing data
ALTER TABLE "user" ADD COLUMN full_name TEXT;
UPDATE "user" SET full_name = name;
```

Deploy the new app version. It reads and writes `full_name`. The old version still reads and writes `name`. Both coexist safely.

**Phase 2 — contract (cleanup).** Once the old app version is fully drained (all instances replaced), the old column is safe to remove.

```sql
-- Phase 2 migration: run after all instances are on the new version
ALTER TABLE "user" DROP COLUMN name;
```

Never combine expand and contract in a single migration that runs atomically with a deploy. The window between "migration committed" and "all containers replaced" is where concurrent old-version requests will fail if the column they depend on is already gone.

**Index creation.** Use `CREATE INDEX CONCURRENTLY` on Postgres. A standard `CREATE INDEX` takes an `AccessExclusiveLock` that blocks reads and writes for the duration. `CONCURRENTLY` takes a weaker lock and builds the index in the background — safe for a running service, though it takes longer and cannot run inside a transaction block.

**Prisma migrations.** Prisma's migration engine does not use `CONCURRENTLY` by default. For large tables, edit the generated migration SQL to use `CREATE INDEX CONCURRENTLY` and run it outside of Prisma's transaction wrapper (`--skip-generate` with a raw SQL step).

---

## Log retention

Every CloudWatch Logs log group created by an ECS service or Lambda function defaults to "Never expire" unless a retention policy is applied explicitly. Left unchecked, this becomes a cost and compliance problem.

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

**Lambda log groups** are auto-created by the Lambda service on first invocation. They are not created by your IaC unless you explicitly define them. If the log group does not exist in Terraform/CDK before the function runs, the retention policy will not be applied until you next run `terraform apply`. Prefer pre-creating the log group as an explicit resource and granting the Lambda execution role `logs:CreateLogStream` and `logs:PutLogEvents` on the pre-created group ARN.

**CloudWatch Logs Insights queries** are cheaper when the log group has a shorter retention window — fewer log events to scan. Setting retention also reduces the risk of accidentally retaining PII in application logs beyond your data retention policy.

Log metric filters and alarms (e.g. alerting on `ERROR` count exceeding a threshold) should be defined alongside the log group resource, not as separate manual console steps. An alarm without a log group resource dependency can silently fail to attach after a log group is recreated.

---

## Interactions with other skills

- **Owns:** AWS-level deploy mechanics — rolling strategy, alias traffic shifting, health check wiring, migration sequencing, secrets injection at deploy time, log retention at deploy time.
- **Hands off to:** infra-safe-change for provisioning the underlying resources (VPC, subnets, ECS cluster, Lambda function declaration, Secrets Manager secret creation).
- **Hands off to:** secrets-and-config-safety for how the application code fetches and uses secrets at runtime.
- **Hands off to:** rollback-planning for the rollback trigger criteria and the runbook path.
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
