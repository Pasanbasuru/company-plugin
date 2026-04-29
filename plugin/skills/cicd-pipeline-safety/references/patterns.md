# CI/CD pipeline safety — deep dives

Reference for implementation details. The lean `SKILL.md` states the Core rules; this file explains *how* to apply them with YAML examples, IAM policies, and walkthrough patterns.

---

## OIDC to AWS setup

GitHub Actions and AWS support OpenID Connect federation: GitHub acts as the identity provider (IdP), and AWS trusts JWTs it issues, exchanging them for short-lived STS credentials. No static credentials are stored anywhere.

**Step 1 — create the OIDC provider in AWS (once per account):**

```hcl
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}
```

The thumbprint is the SHA-1 fingerprint of the root CA certificate for `token.actions.githubusercontent.com`. AWS documents the current value; verify it against the live certificate chain if you are provisioning this manually.

**Step 2 — create the IAM role with a trust policy that enforces subject conditions:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:my-org/my-repo:environment:production"
        }
      }
    }
  ]
}
```

The `sub` condition is the critical lock. Without it, any repository in the world could assume the role. With it, only workflows running in `my-org/my-repo` against the `production` environment can obtain credentials. You can also restrict by branch (`ref:refs/heads/main`) instead of environment, or combine both. Use the most specific condition your pipeline allows.

**Step 3 — add `permissions: id-token: write` to the workflow job:**

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write   # allows the runner to request a JWT from GitHub's OIDC endpoint
      contents: read    # minimum needed for checkout
    steps:
      - uses: aws-actions/configure-aws-credentials@010d0da01d0b5a38af31e9c3470dbfdabdecca3a  # v4.0.1
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions-deploy-prod
          aws-region: eu-west-1
```

The `id-token: write` permission is required; without it the runner cannot call `https://token.actions.githubusercontent.com/`. The token is never written to disk or exposed in logs — the `aws-actions/configure-aws-credentials` action exchanges it directly with STS and injects the resulting short-lived credentials as environment variables for subsequent steps.

**Role per environment, not per repository.** Create `github-actions-deploy-staging` and `github-actions-deploy-prod` as separate roles with separate trust policies and separate permission sets. The staging role might allow `ecs:UpdateService` on staging clusters only; the production role adds the production cluster but requires the `environment:production` subject condition. This prevents a workflow bug or a staging workflow misconfiguration from reaching production credentials.

---

## Third-party action pinning

Any `uses:` reference that is not `actions/` (the official GitHub-maintained namespace) or your own organisation's namespace is a third-party action. Even official actions should be SHA-pinned if pipeline integrity is a requirement.

**Why tags are insufficient.** A Git tag is a pointer to a commit. The pointer can be moved — `git tag -f v3 <new-sha>` followed by `git push --force origin v3` replaces what `@v3` points to silently. GitHub does not prevent tag force-pushes on public repositories. Supply-chain attacks (e.g. the `tj-actions/changed-files` incident) exploit exactly this: the attacker gains write access to the action's repository and moves the tag to a commit that exfiltrates secrets.

**How to find the SHA for a tag.** Navigate to the action's repository on GitHub, switch to the tag, and copy the full 40-character commit hash from the URL or the commit view. Alternatively:

```bash
git ls-remote https://github.com/actions/checkout refs/tags/v4
# 11bd71901bbe5b1630ceea73d27597364c9af683  refs/tags/v4^{}
```

The `^{}` entry is the dereferenced commit SHA (the commit the tag points to, not the tag object itself). Use that SHA in the `uses:` field.

**Leave a comment with the tag for human reviewability:**

```yaml
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
```

**Automate updates with Dependabot.** Add to `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    commit-message:
      prefix: "chore(deps)"
```

Dependabot opens PRs that update the SHA and the comment simultaneously. You review the diff, see the tag bump from `v4.2.1` to `v4.2.2`, check the release notes, and merge. You never manually hunt down SHAs.

**Docker image pinning.** The same principle applies to `docker://` references and to `FROM` lines in Dockerfiles used within CI. Pin to a digest (`image@sha256:...`) rather than a tag for any base image used in security-sensitive build steps.

### Action pinned to full SHA vs mutable tag

**Bad:** tag reference that can be silently replaced:

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
- uses: docker/build-push-action@v5
```

**Good:** SHA pin with a comment showing the human-readable tag for reviewability:

```yaml
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683        # v4.2.2
- uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af      # v4.1.0
- uses: docker/build-push-action@4f58ea79220b3119b80523148a428a765b09e0a1  # v6.9.0
```

---

## Secret scoping by environment

GitHub secrets exist at three scopes: organisation, repository, and environment. Environment secrets are the most restrictive and are the correct choice for anything that touches a production or staging system.

**Environment secrets vs repository secrets — the difference that matters.** A repository secret is injected into any workflow job that references `${{ secrets.NAME }}`, regardless of branch, trigger, or job context. An environment secret is only injected when the job declares `environment: <name>` and all of that environment's protection rules are satisfied at runtime. If a required reviewer has not approved, the job waits — the secret is never injected into a waiting job.

**Setting up an environment correctly:**

1. Go to **Settings → Environments → New environment**. Name it `production`.
2. Under **Deployment protection rules**, add **Required reviewers** (at least one person who is not the PR author).
3. Under **Deployment branches**, select **Selected branches** and add the pattern `main`. This prevents the environment from being targeted by feature branches or forks.
4. Under **Environment secrets**, add `AWS_ROLE_ARN`, `DEPLOY_KEY`, or whatever credentials the production deploy needs. Do not duplicate these at the repository level.

**Referencing the environment in the workflow:**

```yaml
jobs:
  deploy-prod:
    runs-on: ubuntu-latest
    environment: production         # triggers protection rules; injects env secrets
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: aws-actions/configure-aws-credentials@010d0da01d0b5a38af31e9c3470dbfdabdecca3a  # v4.0.1
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}   # environment secret
          aws-region: eu-west-1
```

**Parallel environments for staging.** Create a `staging` environment with no required reviewers (to allow automated deploys) but with a branch restriction to `develop` or a release branch pattern. The staging role ARN lives in the `staging` environment secrets; the production role ARN lives in `production`. A workflow that accidentally or maliciously targets `environment: production` will be gated by the reviewer requirement.

### Environment with required reviewers vs unscoped repository secret

**Bad:** deploy key accessible to any workflow job, no approval gate:

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}   # repository-level secret, no gate
        run: ./scripts/deploy.sh
```

**Good:** secret scoped to the `production` environment, which requires a reviewer approval and is restricted to the `main` branch:

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production                        # requires approval; branch-restricted
    steps:
      - name: Deploy
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}   # environment secret, only injected after gate
        run: ./scripts/deploy.sh
```

Configure the environment in **Settings → Environments → production**: add required reviewers, set "Deployment branches" to `Selected branches: main`, and add the secret there rather than at the repository level.

---

## Required-check configuration

Branch protection required checks are the enforcement mechanism that gives the CI pipeline meaning. Without them, a failed type-check or a broken integration test is advisory — it appears red in the UI but does not prevent merging.

**Configuring required checks via the GitHub UI.** Go to **Settings → Branches → Add rule** (or edit the existing rule for `main`). Enable:

- **Require status checks to pass before merging**
- **Require branches to be up to date before merging** (this prevents a scenario where a check passed on an old base commit but would fail on the current `main`)

Add the specific check names. These must match the job names or step names as they appear in the Actions UI exactly — a typo means the check is never satisfied.

Minimum required checks for a TypeScript/Node.js service:

| Check name | What it covers |
|---|---|
| `type-check` | `tsc --noEmit` — no TypeScript errors on the compiled codebase |
| `unit` | Unit test suite — fast, no external dependencies |
| `integration` | Integration tests — verifies DB queries, API contracts, queue interactions |
| `build` | Production build succeeds — bundler, compilation, asset generation |

**Reusable workflow pattern.** Define the checks in a caller workflow that invokes reusable workflows, so the check names are stable across branches:

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [main]

jobs:
  type-check:
    uses: ./.github/workflows/_type-check.yml

  unit:
    uses: ./.github/workflows/_unit-tests.yml

  integration:
    uses: ./.github/workflows/_integration-tests.yml

  build:
    uses: ./.github/workflows/_build.yml
```

The required checks in branch protection reference `type-check`, `unit`, `integration`, and `build` — the caller job names. The reusable workflows can be updated independently without changing the check names that branch protection depends on.

**Merge queue.** For repositories with high PR throughput, enable **Require merge queue** alongside required checks. The merge queue serialises merges and re-runs required checks against the combined state of queued PRs, eliminating the window where two passing PRs that conflict in their combined effect are both merged.

---

## Fork PR safety (pull_request vs pull_request_target)

GitHub's two primary pull-request triggers have fundamentally different security models, and confusing them is one of the most common CI pipeline vulnerabilities.

**`pull_request`** runs in the context of the fork. The GITHUB_TOKEN has read-only permissions scoped to the fork. Repository secrets are not injected. This is safe for fork contributions: the CI runs the contributor's code in an isolated context with no access to credentials.

**`pull_request_target`** runs in the context of the base repository, with the base branch's code and the base repository's secrets. It was designed to allow PRs from forks to post comments, create check runs, and label issues — actions that require write permissions. The danger: if the workflow checks out and executes code from the PR (e.g. `actions/checkout` with `ref: ${{ github.event.pull_request.head.sha }}`), that untrusted code runs with full access to secrets.

**The canonical dangerous pattern:**

```yaml
# DANGEROUS — do not do this
on:
  pull_request_target:
    types: [opened, synchronize]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
        with:
          ref: ${{ github.event.pull_request.head.sha }}   # checks out fork code
      - run: npm test   # runs fork code with repository secrets in scope
```

**Safe pattern for fork CI (tests only, no secrets needed):**

```yaml
on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    # GITHUB_TOKEN is read-only; no secrets injected
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
      - run: npm test
```

**Safe pattern for posting a comment on a fork PR (requires write access):**

```yaml
# Two-workflow approach: CI runs on pull_request, comment runs on workflow_run
on:
  workflow_run:
    workflows: [CI]
    types: [completed]

jobs:
  comment:
    runs-on: ubuntu-latest
    if: github.event.workflow_run.event == 'pull_request'
    permissions:
      pull-requests: write
    steps:
      - uses: actions/github-script@60a0d83039c74a4aee543508d2ffcb1c3799cdea  # v7.0.1
        with:
          script: |
            // Post comment using data from the completed workflow_run artifact
            // Never executes untrusted PR code in this context
```

The `workflow_run` trigger fires after the `pull_request` workflow completes, in the base repository context, but it does not execute any code from the fork. Pass data between the two workflows via artifacts.

---

## Artifact integrity and retention

Build artifacts connect a deployment to its source. Without traceability, an incident investigation cannot answer "which commit is running in production right now?"

**Upload with explicit metadata:**

```yaml
- name: Build
  run: npm run build

- name: Upload build artifact
  uses: actions/upload-artifact@6f51ac03b9356f520e9adb1b1b7802705f340c2d  # v4.1.4
  with:
    name: dist-${{ github.sha }}-${{ github.run_id }}
    path: dist/
    retention-days: 30
    if-no-files-found: error   # fail the job if the build produced nothing
```

The artifact name embeds the commit SHA and workflow run ID. When a deployed version shows anomalous behaviour, you can retrieve the exact artifact that was deployed, inspect its contents, and correlate it with the source commit.

**`if-no-files-found: error`** prevents a silent empty upload — without this, a build step that fails to produce output will upload an empty artifact and subsequent deploy steps will proceed with nothing to deploy.

**Retention policy.** The GitHub default is 90 days. For most build artifacts this is excessive and potentially a compliance concern (compiled binaries with embedded credentials or API keys in environment-specific builds). Set `retention-days: 30` for standard build outputs. For release artifacts that must be available for audit, publish to an S3 bucket or GitHub Releases instead of relying on GitHub artifact storage.

**Provenance and attestation.** For high-assurance pipelines, use `actions/attest-build-provenance` to generate a signed SLSA provenance attestation alongside the artifact:

```yaml
- uses: actions/attest-build-provenance@1c608d11d69870c2092266b3f9a6f3abbf17002c  # v1.4.3
  with:
    subject-path: dist/
```

This produces a signed attestation linking the artifact to the exact workflow run, commit, and repository. Consumers can verify the attestation with `gh attestation verify` before deploying.

**Separate artifacts per environment stage.** Do not reuse a staging build artifact for a production deploy unless the build is fully deterministic and environment-agnostic. If the build embeds environment-specific configuration (API endpoints, feature flags), rebuild for production from the same commit rather than promoting the staging artifact. The promotion pattern is acceptable only when the artifact is provably identical across environments — and that identity should be verified by comparing checksums, not assumed.
