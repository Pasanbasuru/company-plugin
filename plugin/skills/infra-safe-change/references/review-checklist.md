# Infra safe change — PR review checklist (full form)

Use this file when producing a complete IaC review report. The lean `SKILL.md` lists the four section headings and their shape; this file provides the full coverage table, required explicit scans, and severity definitions.

---

## Review report structure

### Summary

One line: overall verdict (GREEN / YELLOW / RED) and the headline risk for this IaC change.

### Findings

One bullet per finding in the form `file:line, severity, category, fix`.

Shape: `<path>:<line>, <blocker|major|minor>, <destructive-plan|state-backend|iam|networking|stateful-guard|secrets|drift>, <one-sentence fix>`

**Well-formed examples:**

- `modules/rds/main.tf:12, blocker, stateful-guard, add lifecycle { prevent_destroy = true } to aws_db_instance.main before merge`
- `environments/prod/backend.tf:1, blocker, state-backend, missing backend block — state is local; add S3 + DynamoDB backend before any CI apply`
- `modules/orders/iam.tf:8, blocker, iam, Action: "*" on orders-service role — scope to the specific SQS and Secrets Manager ARNs the service needs`
- `modules/vpc/sg.tf:34, major, networking, ingress rule 0.0.0.0/0 on port 5432 — restrict to internal CIDR or application SG only`
- `environments/prod/rds.tf:20, blocker, stateful-guard, -/+ forces replacement on aws_db_instance.main with no snapshot or justification — block merge until data-recovery plan is documented`

**Mandatory findings:**

- Every destructive action (`-`, `-/+`) in the plan must appear here with justification, no-data-loss confirmation, and recovery plan — or be called out as missing.
- `prevent_destroy = true` absent on a stateful resource (RDS, DynamoDB, S3 with data) is a blocker.
- Remote backend missing or using local state in CI is a blocker.
- IAM `Action: "*"` or `Resource: "*"` is a blocker unless explicitly justified.
- Secret literals in IaC variables or state (not Secrets Manager / Parameter Store references) is a blocker.
- Networking changes without a reviewer who can describe the blast radius is a major finding.
- Unresolved drift (unmanaged, managed+drifted, or deleted-outside-Terraform) is a major finding.

### Safer alternative

Propose the least-disruptive path that preserves the intent. Standard safer-alternative text for common findings:

- **Destructive plan detected:** prefer `terraform plan -out=tfplan.binary` artifacts reviewed in the PR (with `terraform show -json` destructive-action extract) over post-apply verification — the review gate must run on the exact plan that will be applied.
- **State per env vs workspace switching:** prefer separate state files per environment and per service (`<env>/<service>/terraform.tfstate`) over workspace switches for blast-radius isolation.
- **Stateful resource lifecycle guard removal:** prefer a two-commit process (remove `prevent_destroy` / `deletion_protection` in one PR, apply the destructive change in a second PR) over bundling lifecycle-guard removal with the change itself.
- **Module refactor causing destroy + create:** prefer `terraform state mv` over destroy + create when refactoring module addresses for stateful resources.
- **Wildcard IAM:** prefer IAM Access Analyzer-generated policies scoped to observed CloudTrail calls over hand-written wildcard grants.

### Checklist coverage

Mark each of the 7 Core rules PASS / CONCERN / NOT APPLICABLE with a one-line reason. See the full coverage table below.

---

## Checklist coverage table

| # | Rule | Status | Notes |
|---|------|--------|-------|
| 1 | Every `terraform plan` read fully before apply; destructive actions (`-`/`forces replacement`) blocked from merge without explicit written justification. | PASS / CONCERN / N/A | |
| 2 | State is remote, versioned, and locked (S3 + DynamoDB or Terraform Cloud); local state in CI is never acceptable. | PASS / CONCERN / N/A | |
| 3 | IAM changes follow least privilege; wildcard `*` on `Action` or `Resource` flagged and justified. | PASS / CONCERN / N/A | |
| 4 | Networking changes (security groups, subnets, NACLs, routes) reviewed by someone who can describe the blast radius before merge. | PASS / CONCERN / N/A | |
| 5 | Drift between code and live infrastructure treated as a bug — reconciled or formally documented why allowed. | PASS / CONCERN / N/A | |
| 6 | Destructive changes to stateful resources require `lifecycle { prevent_destroy = true }` plus a manual override process. | PASS / CONCERN / N/A | |
| 7 | No secrets in IaC state; references to AWS Secrets Manager or Parameter Store only. | PASS / CONCERN / N/A | |

---

## Required explicit scans

In addition to the rule-by-rule table, every IaC review must explicitly scan for these failure patterns:

- **Destructive plan actions** — run `terraform show -json tfplan.binary | jq '.resource_changes[] | select(.change.actions[] | test("delete|create")) | {address, actions: .change.actions}'` and list every result. Each is a mandatory finding unless it is a scratch resource with no persistent data.
- **Stateful resources without `prevent_destroy`** — grep for `aws_db_instance`, `aws_dynamodb_table`, `aws_s3_bucket`, `aws_elasticache_cluster`, `aws_efs_file_system` in the diff; for each, confirm a `lifecycle { prevent_destroy = true }` block is present.
- **Local state** — grep for `backend "local"` or the absence of any `backend` block in `terraform {}` blocks. Also check CI pipeline config for `terraform apply` without a remote backend configured.
- **IAM wildcards** — grep for `Action.*\*` and `Resource.*\*` in `.tf` files. Each match is a blocker finding unless it is a bootstrap / admin role with explicit justification in a PR comment.
- **Secrets in variables** — grep for `variable` blocks with `default = ` containing what looks like a credential; grep for `sensitive = false` on variables named `*password*`, `*secret*`, `*key*`, `*token*`.
- **Manual `tfvars` with secrets** — check if any `*.tfvars` or `*.auto.tfvars` files are tracked in git with sensitive values.
- **Drift in IAM** — if the diff touches IAM modules, confirm that `terraform plan -refresh-only` was run against production and showed no unresolved drift before the change was authored.
- **CDK equivalents** — for CDK changes, run `cdk diff` and check for `[REPLACE]` and `[DELETE]` on stateful constructs (`DatabaseInstance`, `Table`, `Bucket`). Each `[REPLACE]` is equivalent to a `-/+` in Terraform.

---

## Severity definitions

| Severity | Meaning |
|----------|---------|
| **blocker** | A gap that risks data loss, exposes credentials, removes the ability to audit state changes, or ships a destructive plan without justification. Must be fixed before merge. |
| **major** | A pattern that materially degrades the security or blast-radius posture — wildcard IAM without justification, unreviewed networking change, unresolved drift. Should be fixed; escalate if deferred. |
| **minor** | A best-practice gap with no immediate exposure — missing `ignore_changes` for a rotated credential, state key naming not following `<env>/<service>` convention, `deletion_protection` present but `prevent_destroy` absent (or vice versa). Address opportunistically. |
