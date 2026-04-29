---
name: cicd-pipeline-safety
description: Use when reviewing or editing GitHub Actions workflows, reusable workflows, required-check configuration, or promotion logic between environments. Do NOT use for application deploy mechanics (use `aws-deploy-safety`). Covers OIDC to AWS, secret scoping, required checks, branch protection, artifact integrity, environment promotion, third-party action pinning.
allowed-tools: Read, Grep, Glob, Bash
---

# CI/CD pipeline safety

## Purpose & scope

The CI pipeline is a production system. Its failures become silent regressions — a flipped tag poisons every subsequent deploy, a leaked secret persists in logs long after rotation, and a `pull_request_target` misconfiguration hands untrusted code the keys to your cloud account. This skill applies whenever a GitHub Actions workflow file, reusable workflow, environment configuration, or branch protection rule is created or modified. It does not own what the deploy does once it reaches AWS (use `aws-deploy-safety`) or how third-party dependencies are kept current (use `supply-chain-and-dependencies`); it owns pipeline integrity from trigger to artifact.

## Core rules

1. **AWS access uses OIDC via `aws-actions/configure-aws-credentials`, never long-lived `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` secrets.** — *Why:* long-lived keys are static credentials that persist in GitHub's encrypted secret store indefinitely; they rotate manually, appear in support requests and CI logs when misconfigured, and their blast radius is bounded only by the IAM policy attached — which is often wider than intended. OIDC issues a short-lived token scoped to a single workflow run; the token expires automatically, cannot be extracted from the run, and the IAM role's trust policy can enforce `sub` conditions that restrict which repo, branch, and environment can assume it.

2. **Third-party actions are pinned to a full 40-character commit SHA, not a mutable tag.** — *Why:* a tag like `@v3` is a mutable pointer — the action author can push a new commit to that tag at any time, silently replacing the code your workflow executes. Pinning to a SHA makes the action immutable: the exact bytes that ran in review are the exact bytes that run in production. Dependabot can still propose SHA updates with a human-readable tag in the comment, preserving reviewability without sacrificing immutability.

3. **Secrets are scoped to GitHub environments (`environments/prod`, `environments/staging`); no single repository-level secret blob serves all jobs.** — *Why:* a repository-level secret is accessible to any workflow that runs in that repository, including those triggered by fork PRs or low-trust branches. Environment secrets are only injected when the job explicitly references that environment and the environment's protection rules (required reviewers, branch restrictions) are satisfied. Blast radius on a compromised workflow is limited to the environment it was allowed to access.

4. **Required checks on the default branch include at minimum: type-check, unit tests, integration tests, and build. No merge is possible without all checks passing.** — *Why:* branch protection without required checks is decorative. A green merge button without type-check passing means a TypeScript error can reach the default branch; without integration tests, a broken API contract ships silently. Required checks enforce the invariant that the merge queue only admits code that has been mechanically verified to meet the project's quality bar.

5. **Pull requests from forks use the `pull_request` trigger, not `pull_request_target`, unless the workflow has been explicitly audited for secret leakage.** — *Why:* `pull_request_target` runs in the context of the base branch, with access to repository secrets and environment variables, even when the PR comes from an untrusted fork. A malicious PR can modify workflow files or scripts that `pull_request_target` then executes with elevated permissions. `pull_request` runs in the fork's context — secrets are withheld, and the GITHUB_TOKEN has read-only permissions by default.

6. **Deployments to `prod` require an explicit `environment: production` block with required reviewers and a branch restriction to `main`.** — *Why:* without an environment gate, any workflow that satisfies its trigger conditions can deploy to production — including a branch push, a failed test suite that somehow still reaches the deploy job, or an automated dependency bump. Required reviewers add a human checkpoint; branch restrictions ensure only commits that have passed the full merge queue reach the production environment.

7. **Build artifacts are uploaded with `actions/upload-artifact`, annotated with the commit SHA and run ID, and given an explicit retention period.** — *Why:* an artifact that cannot be traced to its source commit is useless for incident investigation. An artifact stored at the default 90-day retention may hold sensitive build outputs (compiled binaries, bundled source maps, dependency lock files) well past the point of usefulness. Explicit retention and SHA annotation are a deployment contract: the artifact that will be deployed is exactly the one produced by commit `abc123`, run `987654321`, and it will be gone in 30 days.

## Red flags

| Thought | Reality |
|---|---|
| "Long-lived AWS key in a repository secret is fine — it only has the permissions it needs" | Static credentials accumulate over time: the key is copied into CI logs, engineer laptops, and Slack messages; the policy drifts; rotation is skipped during incidents. OIDC issues ephemeral tokens that expire automatically and cannot be exfiltrated from the run context. |
| "`uses: someaction/foo@v3` — the tag is pinned to a major version, that's safe enough" | Tag `v3` can be force-pushed to point at new code at any time without notice. SHA pinning is the only guarantee that the action you reviewed is the action that runs. Use Dependabot to keep SHAs current. |
| "`pull_request_target` is more convenient — it lets me comment on PRs from forks with a token that has write access" | `pull_request_target` runs with repository secrets and a writable GITHUB_TOKEN in the context of the base branch. A fork PR that modifies a reusable script or action path can hijack the elevated context. Use `pull_request` for fork CI; use a separate, tightly-scoped workflow for comment posting. |

## Good vs bad

### OIDC role assumption vs long-lived AWS credentials

Bad — static key stored as a repository secret:

```yaml
# .github/workflows/deploy.yml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v4   # mutable tag
        with:
          aws-access-key-id:     ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: eu-west-1
```

The key never expires, is stored in GitHub's secret store, and every workflow in this repo can request it.

Good — OIDC token exchanged for short-lived role credentials, action pinned to SHA:

```yaml
# .github/workflows/deploy.yml
permissions:
  id-token: write   # required to request the OIDC JWT
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production   # gates on required reviewers + branch restriction
    steps:
      - uses: aws-actions/configure-aws-credentials@010d0da01d0b5a38af31e9c3470dbfdabdecca3a  # v4.0.1
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions-deploy
          aws-region: eu-west-1
```

The OIDC JWT is minted per-run, expires after the run, and the IAM trust policy constrains which repo/branch/environment can assume the role.

## Interactions with other skills

- **Owns:** pipeline integrity — OIDC credential issuance, action supply chain, secret injection gates, required check enforcement, fork PR isolation, artifact traceability.
- **Hands off to:** `aws-deploy-safety` for what the deploy does once credentials are in scope (rolling strategy, health checks, Lambda aliases); `supply-chain-and-dependencies` for dependency scanning steps within the pipeline; `infra-safe-change` for provisioning the IAM roles, OIDC provider, and environment infrastructure that the pipeline consumes.
- **Does not duplicate:** IaC for the AWS resources the pipeline targets; application-level secrets usage at runtime (use `secrets-and-config-safety`).

## Review checklist

### Summary

One line: pass / concerns / blocking issues. Name the reviewed surface (workflow file, environment config, branch protection) and the overall verdict in a single sentence so a reader can scan the result without reading further.

### Findings

One bullet per finding: `path/to/file.yml:42` — **severity** (blocking | concern | info) — *category* (oidc | sha-pin | secret-scope | required-checks | fork-pr | env-gate | artifact) — what is wrong, recommended fix. Append pipeline output (e.g., `gh run view` output, CI log excerpts) inside this same section when it was checked to verify check names or job status.

### Safer alternative

Prefer GitHub OIDC federation over long-lived AWS access keys; prefer SHA-pinned `uses:` references over mutable `@vN` tags; prefer environment-scoped secrets with required-reviewer rules over repository-level secrets; prefer the `pull_request` trigger for fork CI over `pull_request_target`.

### Checklist coverage

Mark each Core rule PASS / CONCERN / NOT APPLICABLE with a one-line justification. See `references/review-checklist.md` for the full table, required explicit scans, and severity definitions.

---

*For detailed implementation patterns (OIDC IAM setup, SHA-pinning workflow, secret environment config, required-check patterns, fork PR safety, artifact provenance), see `references/patterns.md`. For the full PR review checklist with the coverage table and severity definitions, see `references/review-checklist.md`.*
