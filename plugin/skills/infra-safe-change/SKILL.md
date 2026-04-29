---
name: infra-safe-change
description: Use when reviewing or editing Terraform, CloudFormation, CDK, or any IaC that provisions cloud resources — especially state stores, networking, IAM, and compute scaling. Do NOT use for application-level AWS SDK calls (use `aws-deploy-safety`). Covers IaC review, state management, drift detection, destructive plan detection, IAM policies, networking changes.
allowed-tools: Read, Grep, Glob, Bash
---

# Infra safe change

## Purpose & scope

Infra changes land all at once and may not be undoable. Catches destructive plans before apply, enforces remote-state discipline, holds IAM to least-privilege. Terraform-primary; same principles apply to CDK/CloudFormation.

## Core rules

1. **Every `terraform plan` is read fully before apply — destructive actions (`-`/`forces replacement`) block merge without explicit written justification.**
   *Why:* Terraform outputs a complete diff. Grepping for errors misses deletions; written justification forces a deliberate decision.

2. **State is remote, versioned, and locked (S3 + DynamoDB or Terraform Cloud). Local state in CI is never acceptable.**
   *Why:* Local state is ephemeral and unlocked — concurrent applies corrupt it. Remote state with locking serialises and audits.

3. **IAM changes follow least privilege. A wildcard `*` on `Action` or `Resource` is flagged and must be justified.**
   *Why:* Over-broad IAM grants are the leading cause of blast-radius expansion in cloud incidents.

4. **Networking changes (security groups, subnets, NACLs, routes) are reviewed by someone who can describe the blast radius before merge.**
   *Why:* An over-permissive SG or missing route silently exposes or severs. Reviewer must understand topology, not just the diff.

5. **Drift between code and live infrastructure is treated as a bug — reconcile it or formally document why the drift is allowed.**
   *Why:* Untracked drift means your IaC no longer describes reality. The next apply may destroy manually created resources or miss configuration that's load-bearing.

6. **Destructive changes to stateful resources (RDS, S3 with data, DynamoDB) require `lifecycle { prevent_destroy = true }` plus a manual override process.**
   *Why:* Accidental deletion of a database or a populated S3 bucket can result in permanent data loss. The `prevent_destroy` lifecycle guard forces a two-step process: remove the guard, plan, review, apply — no single-step accidents.

7. **Secrets are not stored in IaC state; references to AWS Secrets Manager or Parameter Store only.**
   *Why:* State JSON is readable by anyone with S3 read on the bucket — a baked-in secret is exposed indefinitely.

## Red flags

| Signal | Why it matters |
|--------|----------------|
| "The plan has a delete but it's fine" | Describe exactly what is being deleted, why, and what data-recovery exists. If you cannot answer all three, it is not fine. |
| "IAM wildcard for simplicity" | `Action: "*"` or `Resource: "*"` on a production role is never acceptable. Scope to the exact actions and resources the service needs. |
| "State file committed for now" | Any secret ever written into a state file is now in git history. Rotate the secret, remove the state from git, move to a remote backend immediately. |

## Good vs bad

### `lifecycle { prevent_destroy = true }` on RDS vs unguarded

**Bad — unguarded RDS instance:**
```hcl
resource "aws_db_instance" "main" {
  identifier        = "prod-orders"
  engine            = "postgres"
  instance_class    = "db.t3.medium"
  allocated_storage = 100
  # No lifecycle protection — a single `terraform apply` can delete this
}
```
A rename of the resource block, a change to a `forces replacement` attribute (like `engine_version` with no snapshot policy), or a module refactor can produce a `destroy + create` in the plan.

**Good — lifecycle guard on stateful resource:**
```hcl
resource "aws_db_instance" "main" {
  identifier        = "prod-orders"
  engine            = "postgres"
  instance_class    = "db.t3.medium"
  allocated_storage = 100

  lifecycle {
    prevent_destroy       = true
    ignore_changes        = [password]       # managed via Secrets Manager rotation
  }
}
```
Plans containing `destroy` abort. Deletion requires removing the guard in a separate commit — deliberate and reviewable.

### Scoped IAM policy vs `*:*`

**Bad — wildcard action and resource:**
```hcl
resource "aws_iam_policy" "orders_service" {
  name = "orders-service-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "*"
      Resource = "*"
    }]
  })
}
```
This grants the orders service full administrative access to every AWS resource in the account.

**Good — scoped to exact actions and resources:**
```hcl
resource "aws_iam_policy" "orders_service" {
  name = "orders-service-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadOrdersQueue"
        Effect   = "Allow"
        Action   = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.orders.arn
      },
      {
        Sid      = "ReadOrdersSecret"
        Effect   = "Allow"
        Action   = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_secretsmanager_secret.orders_db.arn
      }
    ]
  })
}
```
The blast radius of a compromised token is limited to the SQS queue and the one secret the service legitimately needs.

## Interactions with other skills

- **Owns:** IaC change review, Terraform plan analysis, remote state discipline, IAM policy review in IaC context.
- **Hands off to:** `aws-deploy-safety` for application-level deploy concerns (ECS task definitions, Lambda config, runtime roles); `secrets-and-config-safety` for secret reference patterns and rotation; `change-risk-evaluation` for the rollback strategy when a destructive infra change is approved.
- **Does not duplicate:** Terraform style linting (`tflint`, `checkov`) — this skill covers review judgement, not automated linting rules.

## Review checklist

When invoked in review mode, emit a markdown report with these four sections.

### Summary

One line: overall verdict (GREEN / YELLOW / RED) and the headline risk for this IaC change.

### Findings

One bullet per finding in the form `file:line, severity, category, fix`. See `references/review-checklist.md` for the full findings format, mandatory finding rules, and well-formed examples.

### Safer alternative

Propose the least-disruptive path that preserves the intent. See `references/review-checklist.md` for standard safer-alternative text covering destructive plans, state isolation, stateful-resource lifecycle guards, `terraform state mv`, and IAM Access Analyzer.

### Checklist coverage

Map each Core rule to `PASS / CONCERN / NOT APPLICABLE` with a one-line reason. See `references/review-checklist.md` for the full coverage table, required explicit scans, and severity definitions.

- Rule 1 (plan read fully, destructive actions justified): PASS / CONCERN / NOT APPLICABLE — <reason>
- Rule 2 (remote, versioned, locked state): PASS / CONCERN / NOT APPLICABLE — <reason>
- Rule 3 (IAM least privilege, no `*` on Action/Resource): PASS / CONCERN / NOT APPLICABLE — <reason>
- Rule 4 (networking blast-radius review): PASS / CONCERN / NOT APPLICABLE — <reason>
- Rule 5 (drift reconciled or documented): PASS / CONCERN / NOT APPLICABLE — <reason>
- Rule 6 (`prevent_destroy` on stateful resources + manual override process): PASS / CONCERN / NOT APPLICABLE — <reason>
- Rule 7 (no secrets in state; Secrets Manager / Parameter Store references only): PASS / CONCERN / NOT APPLICABLE — <reason>

---

*For Terraform plan-reading walkthroughs, remote state + locking patterns, IAM least-privilege process, full stateful-resource lifecycle patterns, and drift detection commands, see `references/patterns.md`. For the complete PR review checklist with coverage table, required explicit scans, and severity definitions, see `references/review-checklist.md`.*
