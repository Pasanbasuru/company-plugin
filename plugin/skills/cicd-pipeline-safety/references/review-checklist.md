# CI/CD pipeline safety — PR review checklist (full form)

Use this file when producing a complete pipeline safety review report. The lean `SKILL.md` lists only the section headings and shape; this file provides the full checklist coverage table and severity definitions.

---

## Review report structure

### Summary

One line: pass / concerns / blocking issues. Name the reviewed surface (workflow file, environment config, branch protection) and the overall verdict in a single sentence so a reader can scan the result without reading further.

### Findings

One bullet per finding, in this shape:

- `path/to/file.yml:42` — **severity** (blocking | concern | info) — *category* (oidc | sha-pin | secret-scope | required-checks | fork-pr | env-gate | artifact) — what is wrong, recommended fix.

Flag every long-lived AWS key, every mutable action tag, every repository-level secret that should be environment-scoped, and every `pull_request_target` usage that checks out fork code — each with its exact `file:line`.

**Pipeline output belongs in this section.** If you ran `gh run view` or scraped CI logs to verify check names, append the relevant output as a fenced block or sub-list under a `**pipeline output**` paragraph. If no pipeline output was checked, note this explicitly and explain why.

### Safer alternative

Prefer GitHub OIDC federation to AWS IAM over long-lived access keys in repository secrets. Prefer SHA-pinned `uses:` references over mutable `@vN` tag references for all third-party actions. Prefer environment-scoped secrets with required-reviewer protection rules over repository-level secrets accessible to all jobs. Prefer the `pull_request` trigger (fork context, no secrets) over `pull_request_target` for fork CI runs; use the `workflow_run` two-workflow pattern when write access is genuinely needed after CI completes.

### Checklist coverage

Mark each Core rule as PASS / CONCERN / NOT APPLICABLE with a short justification.

---

## Checklist coverage table

| # | Rule | Status | Notes |
|---|------|--------|-------|
| 1 | AWS access uses OIDC via `aws-actions/configure-aws-credentials`; no long-lived `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in secrets. | PASS / CONCERN / N/A | |
| 2 | All third-party `uses:` references pinned to a full 40-character commit SHA (not a mutable tag). | PASS / CONCERN / N/A | |
| 3 | Secrets scoped to GitHub environments; no production credentials at repository level. | PASS / CONCERN / N/A | |
| 4 | Required checks on the default branch include at minimum: type-check, unit tests, integration tests, and build. | PASS / CONCERN / N/A | |
| 5 | Fork PRs use the `pull_request` trigger; `pull_request_target` is absent or has been explicitly audited for secret exposure. | PASS / CONCERN / N/A | |
| 6 | Production deploys gate on `environment: production` with required reviewers and a branch restriction to `main`. | PASS / CONCERN / N/A | |
| 7 | Build artifacts uploaded with commit SHA annotation, explicit `retention-days`, and `if-no-files-found: error`. | PASS / CONCERN / N/A | |

---

## Required explicit scans

In addition to the rule-by-rule table, every review must explicitly scan for these common failure patterns:

- **Long-lived AWS keys** — grep for `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in workflow files and GitHub secret names; flag any that are not replaced by OIDC role assumption.
- **Mutable action tags** — grep for `uses:` lines matching `@v[0-9]` patterns; every match that is not a full 40-character SHA is a finding.
- **`pull_request_target` + checkout** — flag any workflow that combines `pull_request_target` with `actions/checkout` using `ref: ${{ github.event.pull_request.head.sha }}` or similar; this is the canonical secret-exfiltration pattern.
- **Repository-level secrets for environment-specific credentials** — review Settings → Secrets → Repository secrets; any secret whose name suggests environment ownership (`PROD_*`, `STAGING_*`, `AWS_*`) should be an environment secret instead.
- **Missing environment gate on deploy jobs** — any job with a deploy step that lacks `environment:` is a finding; check for `aws-actions/configure-aws-credentials`, `kubectl apply`, `helm upgrade`, or similar deploy commands without the gate.
- **Required check completeness** — verify that branch protection on `main` lists at least `type-check`, `unit`, `integration`, and `build` as required; check that the exact job names match what the workflow file emits.
- **Artifact retention** — check `retention-days` on all `actions/upload-artifact` steps; a missing value defaults to 90 days.

---

## Severity definitions

| Severity | Meaning |
|----------|---------|
| **blocking** | A configuration that creates an active security or reliability risk — e.g., long-lived AWS keys, `pull_request_target` with unchecked fork code, production secrets at repository scope. Must be fixed before merge. |
| **concern** | A pattern that degrades pipeline integrity without an immediate exploit path — e.g., mutable action tags, missing required checks, no artifact retention period. Should be fixed; flag if deferred. |
| **info** | Best-practice gap with no current risk — e.g., missing SHA comment, sub-optimal retention period. Address opportunistically. |
