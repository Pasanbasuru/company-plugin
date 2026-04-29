# Infra safe change — deep dives

Reference for implementation details. The lean `SKILL.md` states the Core rules; this file explains *how* to apply them with full workflows, command references, and worked patterns.

---

## Plan reading discipline

`terraform plan` outputs a complete, deterministic diff between your state and your configuration. Reading it is not optional — it is the final safety gate before infrastructure changes.

The review workflow uses a saved plan to guarantee that what you reviewed is exactly what gets applied:

```bash
# 1. Generate and save the plan
terraform plan -out=tfplan.binary

# 2. Convert to human-readable form for review
terraform show tfplan.binary

# 3. In CI, use JSON output for automated destructive-action detection
terraform show -json tfplan.binary | jq '
  .resource_changes[]
  | select(.change.actions[] | test("delete|create"))
  | { address: .address, actions: .change.actions }
'

# 4. Apply only the saved plan — not a fresh plan that may differ
terraform apply tfplan.binary
```

The `-out` / `apply` split is critical. Without it, `terraform apply` generates a new plan at apply time. If the working directory or remote state changed between your review and the apply, you may apply a different diff from the one you reviewed. The saved plan eliminates this race condition.

### Change categories

When reading a plan, categorise each resource change:

- **`+` (create):** New resource. Review for correctness and security, but not inherently dangerous.
- **`~` (update in-place):** Attribute change on an existing resource. Usually safe; check for `forces replacement` annotations which elevate this to a destroy + create.
- **`-` (destroy):** Resource deletion. Always requires written justification unless it is a scratch resource (e.g., a test Lambda with no data).
- **`-/+` (destroy then create, forces replacement):** The old resource is deleted and a new one is created. Stateful resources (`aws_db_instance`, `aws_s3_bucket`, `aws_dynamodb_table`) must never have this in a production plan without a verified backup and explicit approval.

The `forces replacement` annotation identifies which attribute change is triggering the destroy. Common triggers: changing `identifier` on an RDS instance, changing `name` on many resource types, changing `engine_version` without a snapshot policy, or moving a resource between modules without `terraform state mv`.

### CDK equivalent

In CDK, the equivalent is `cdk diff`. The `[REPLACE]` annotation marks forced replacements, and `[DELETE]` marks removals. The same review discipline applies: every `[REPLACE]` and `[DELETE]` on a stateful resource requires justification before `cdk deploy`.

---

## Remote state + locking

State is the source of truth for what Terraform believes exists. If state is wrong, all subsequent plans are wrong. If two applies run concurrently against the same state, they corrupt each other.

The canonical remote backend for AWS-hosted infrastructure is S3 + DynamoDB:

```hcl
terraform {
  backend "s3" {
    bucket         = "acme-terraform-state"
    key            = "prod/orders-service/terraform.tfstate"
    region         = "eu-west-1"
    encrypt        = true
    kms_key_id     = "arn:aws:kms:eu-west-1:123456789012:key/mrk-abc123"

    # DynamoDB table for state locking
    dynamodb_table = "acme-terraform-state-locks"
  }
}
```

Key properties:

- `encrypt = true` + `kms_key_id`: state at rest is encrypted with a customer-managed KMS key. Without this, secrets that leak into state (module outputs, computed values) are readable by anyone with S3 read access.
- `dynamodb_table`: DynamoDB's conditional writes provide pessimistic locking. A lock is acquired before any operation that modifies state and released on completion. If a CI job is killed mid-apply, the lock persists and must be manually released with `terraform force-unlock <lock-id>` — investigate the incomplete apply before doing so.
- `key` path: use a namespaced path (`<env>/<service>/terraform.tfstate`) so that each service and environment has isolated state. A single monolithic state file for all production infrastructure is a blast-radius maximiser.

### State operations

Commands needed during incident response or refactoring:

```bash
# List all resources tracked in state
terraform state list

# Inspect a specific resource's state (useful when plan shows unexpected diff)
terraform state show aws_db_instance.main

# Move a resource to a new address after a module refactor (avoids destroy + create)
terraform state mv \
  module.old_name.aws_db_instance.main \
  module.new_name.aws_db_instance.main

# Remove a resource from state without destroying it (when handing off management)
terraform state rm aws_iam_role.legacy_role

# Pull state to a local file for inspection (never commit this)
terraform state pull > /tmp/state-inspection.json
```

Terraform Cloud and Terraform Enterprise provide state as a managed service with built-in locking, versioned history, and audit logs. The DynamoDB pattern is for teams self-hosting state on S3.

---

## IAM least privilege

Every IAM role, policy, and permission boundary that IaC creates is a permanent part of the account's security posture. Over-broad grants compound over time.

The least-privilege process for a new IAM role:

1. **Start with nothing.** Define the role with an empty policy. Deploy to a non-production environment.
2. **Run the service under real load.** Use AWS CloudTrail or IAM Access Analyzer to observe which API calls the service actually makes.
3. **Build the policy from observed calls.** IAM Access Analyzer's policy generation feature can produce a starting policy from CloudTrail events.
4. **Scope to specific resource ARNs.** Replace `Resource: "*"` with the actual ARN of the queue, bucket, or secret the service owns. Use ARN interpolation in Terraform to avoid hardcoding.
5. **Review with SCPs in mind.** If the account has Service Control Policies, verify the new IAM policy does not rely on actions blocked by the SCP.

### IAM anti-patterns to reject in review

- `Action: "iam:*"` on any non-bootstrap role — allows the service to create new roles and escalate its own privileges.
- `Action: "s3:*"` on `Resource: "*"` — allows listing, reading, and deleting every bucket in the account.
- `PassRole` without a condition `StringLike iam:PassedToService` — allows the service to pass any role to any AWS service, enabling privilege escalation.
- Inline policies on EC2 instances or Lambda functions instead of IAM roles — harder to audit and cannot be reused.
- `Principal: "*"` on any resource-based policy (S3 bucket policy, SQS queue policy) — makes the resource public.

### CDK IAM grants

In CDK, IAM grants are expressed through high-level methods (`bucket.grantRead(role)`, `queue.grantConsumeMessages(role)`). These generate least-privilege policies automatically. Prefer these over manually constructing `PolicyStatement` objects, and verify the generated policy in `cdk diff` output before deploying.

---

## Destructive operations on stateful resources

A stateful resource is one that holds data whose loss is not recoverable from the application layer alone: RDS instances, DynamoDB tables, S3 buckets with customer data, ElastiCache clusters that are the source of truth for a cache, and EFS volumes.

### Full RDS example with all guards

```hcl
resource "aws_db_instance" "main" {
  identifier              = "prod-orders"
  engine                  = "postgres"
  instance_class          = "db.t3.medium"
  allocated_storage       = 100
  skip_final_snapshot     = false              # take a snapshot before deletion
  final_snapshot_identifier = "prod-orders-final-${formatdate("YYYYMMDD", timestamp())}"
  backup_retention_period = 14                 # 14 days of automated daily backups
  deletion_protection     = true               # RDS-level guard, independent of Terraform

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [password]               # managed via Secrets Manager rotation
  }
}
```

`deletion_protection = true` at the RDS level is a second independent guard — even if `prevent_destroy` is removed and a `terraform apply` runs, RDS will refuse the deletion. Both must be explicitly disabled for the resource to be deleted. Use the same pattern for DynamoDB (`deletion_protection_enabled = true`).

### Forced replacement migration process

When a `forces replacement` is unavoidable — for example, migrating an RDS instance to a different engine version that requires a snapshot restore:

1. Take a manual RDS snapshot before any changes.
2. Remove `prevent_destroy` and `deletion_protection` in a dedicated commit with a PR that documents the migration.
3. Run `terraform plan`, verify the snapshot policy is in place, verify the new instance will be created correctly.
4. Apply in a maintenance window with traffic directed away from the database.
5. Restore `prevent_destroy` and `deletion_protection` on the new resource.

Never bundle a stateful resource replacement with other changes in the same PR. The blast radius of a review mistake is too high.

---

## Drift detection

Drift is the divergence between the infrastructure your IaC describes and the infrastructure that actually exists. It arises from manual console changes, direct AWS CLI modifications, external automation, and failed or partial Terraform applies.

### Built-in drift detection

```bash
# Refresh state from live infrastructure, then plan
terraform plan -refresh=true

# Refresh state only (no plan output — useful for scripting)
terraform apply -refresh-only

# Check for drift without any modifications
terraform plan -refresh=true -detailed-exitcode
# Exit code 0: no changes; 1: error; 2: changes detected (drift present)
```

### Driftctl (multi-resource scan)

Driftctl scans all resources in an AWS account against the Terraform state and reports unmanaged resources and attribute-level drift:

```bash
# Scan AWS account against Terraform state in S3
driftctl scan \
  --from tfstate+s3://acme-terraform-state/prod/orders-service/terraform.tfstate \
  --output json://drift-report.json

# Human-readable summary
driftctl scan \
  --from tfstate+s3://acme-terraform-state/prod/orders-service/terraform.tfstate \
  --output console://
```

Driftctl distinguishes between: resources in state but changed outside Terraform (managed + drifted), resources in the account but not in state (unmanaged), and resources in state that no longer exist in AWS (deleted outside Terraform).

Terraform Cloud and Terraform Enterprise include built-in continuous drift detection via health assessments. When enabled on a workspace, it runs `terraform plan -refresh-only` on a schedule and alerts when drift is detected.

### Operational posture for detected drift

1. **Unmanaged resources:** Decide whether to import them into state (`terraform import`) or document them as intentionally unmanaged. Untracked resources may be destroyed by a `terraform apply` that recreates the environment from scratch.
2. **Managed + drifted resources:** Either reconcile by updating IaC to match reality, or revert the manual change by running `terraform apply` to restore the declared state. Document the decision.
3. **Resources deleted outside Terraform:** Terraform will try to recreate them on the next apply. If the deletion was intentional, remove the resource from IaC before the next apply. If unintentional, restore from backup and investigate.

Drift in IAM policies is particularly dangerous. A policy that drifted from least-privilege to permissive in the console may not be caught until the next plan. Run `terraform plan -refresh-only` on IAM modules on a daily schedule in CI.
