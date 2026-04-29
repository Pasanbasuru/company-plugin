# Secrets and config safety — PR review checklist (full form)

Use this file when producing a complete secrets review report. The lean `SKILL.md` lists only the section headings and shape; this file provides the full checklist coverage table, required explicit scans, and severity definitions.

---

## Review report structure

### Summary

One line: GREEN / YELLOW / RED. Name the reviewed surface (service, module, or file set) and the overall verdict in a single sentence so a reader can scan the result without reading further.

### Findings

One bullet per finding, in this shape:

- `path/to/file.ts:line` — **severity** (blocking | concern | info) — *category* (unvalidated-env | next-public-leak | next-public-review | committed-secret | rotation-blind | logged-secret | hard-coded-config | gitignore-missing) — what is wrong, recommended fix.

**Examples of well-formed findings:**

- `src/config.ts:12` — **blocking** — *unvalidated-env* — `DATABASE_URL` read via `process.env` without a schema check — fix: parse via Zod in `lib/env.server.ts` and import `env.DATABASE_URL` instead.
- `src/lib/stripe.ts:8` — **blocking** — *next-public-leak* — `NEXT_PUBLIC_STRIPE_SECRET_KEY` inlined into client bundle — fix: rename to `STRIPE_SECRET_KEY` and move access to a Server Action.
- `apps/web/next.config.ts:14` — **concern** — *next-public-review* — `NEXT_PUBLIC_API_BASE_URL` added — fix: confirm intentional public exposure in PR; acceptable for public API base URL.
- `src/payments/stripe.ts:3` — **concern** — *rotation-blind* — Stripe client constructed at module load with `process.env.STRIPE_SECRET_KEY` — fix: fetch via `getSecret()` with 5-min TTL cache.

Fold env-var and `NEXT_PUBLIC_*` inventory observations in here as individual findings rather than separate tables.

### Safer alternative

Propose the secrets-specific higher-leverage move when the diff touches credentials or rotating config. Standard text for common findings:

- **Rotating credentials injected via `environment:` block in ECS task definition:** prefer Secrets Manager references in the `secrets:` block instead — the platform resolves the ARN at task start and rotation propagates without a redeploy.
- **Plaintext `.env` file checked into the repo:** prefer Parameter Store SecureString + a scoped KMS grant — gets audit history, per-environment overrides, and encryption at rest for free.
- **`NEXT_PUBLIC_*` added to silence a client-component error:** prefer moving the secret read into a Server Action and returning only the non-sensitive result to the client.
- **Secret read once at module load:** prefer a short-TTL in-process cache (`getSecret()` with 5-min TTL) so rotation propagates within one TTL window without a restart.
- **Feature flags in `.env` files:** prefer Parameter Store or a dedicated feature-flag platform (LaunchDarkly, Statsig) — gets per-environment overrides, audit history, and no-deploy flag changes.

### Checklist coverage

Mark each of the 7 Core rules PASS / CONCERN / NOT APPLICABLE with a one-line justification. See the full coverage table below.

---

## Checklist coverage table

| # | Rule | Status | Notes |
|---|------|--------|-------|
| 1 | Secrets sourced from AWS Secrets Manager (runtime pull) or injected at deploy time — never committed, never in plaintext env files in the repo. | PASS / CONCERN / N/A | |
| 2 | `.env.example` (or equivalent) committed; real `.env` files `.gitignore`d and never shared in chat. | PASS / CONCERN / N/A | |
| 3 | Env vars validated on startup with Zod — service exits fast with a clear message if any variable is missing or malformed. | PASS / CONCERN / N/A | |
| 4 | No server-only secret in `NEXT_PUBLIC_*`; every `NEXT_PUBLIC_*` variable reviewed before merge for intentional public exposure. | PASS / CONCERN / N/A | |
| 5 | No secret value reaches a log line; only the *fact* of a secret's presence is logged, never the value itself. | PASS / CONCERN / N/A | |
| 6 | Code reads secrets fresh (or via a short-TTL cache), not once at process start, for credentials that can be rotated. | PASS / CONCERN / N/A | |
| 7 | Feature flags and per-environment config lives in a config store (Parameter Store, LaunchDarkly, etc.), not hard-coded or in `.env` files. | PASS / CONCERN / N/A | |

---

## Required explicit scans

In addition to the rule-by-rule table, every review must explicitly scan for these common failure patterns:

- **Direct `process.env` reads outside the validated env module** — grep for `process.env.` in files other than `lib/env.ts` (or equivalent). Each is a finding unless the reference is in the env module itself or a bootstrapping script that runs before the module loads.
- **`NEXT_PUBLIC_*` variable inventory** — list every `NEXT_PUBLIC_*` variable currently in the codebase and in the diff; for each, confirm the value is genuinely client-safe (publishable keys, public API base URLs) and flag any that look like server credentials.
- **Secrets logged** — grep for `console.log`, `logger.info/debug/error` and `JSON.stringify` calls that include variable names matching `*key*`, `*secret*`, `*token*`, `*password*`, `*credential*`. Flag any that might include the value rather than just a boolean/length check.
- **Secret baked at build time** — grep for `ARG` or `ENV` in Dockerfiles referencing credential names; grep for build-arg usage in CI pipeline configs. Each is a finding.
- **Module-level secret reads** — grep for `const .* = process.env` or `const .* = await getSecret(...)` at module scope (top-level `const`, outside any function). These bind the value once at import time and never refresh.
- **Missing `.gitignore` entry** — confirm `.env`, `.env.local`, `.env.*.local` are in `.gitignore`. A missing entry is a blocking finding.
- **Hard-coded feature flags** — grep for `if (true)`, `if (false)`, `const FLAG_*`, `const FEATURE_*` that are never read from a config store. Flag boolean constants that smell like orphaned flags.

---

## Severity definitions

| Severity | Meaning |
|----------|---------|
| **blocking** | A gap that exposes a secret (committed, logged, in client bundle), removes the ability to rotate without a restart, or allows the service to start with silently missing/malformed config. Must be fixed before merge. |
| **concern** | A pattern that degrades the security or operational posture without an immediate exposure path — e.g., missing rotation-ready pattern for a credential that does rotate, feature flags in `.env` instead of a config store, `NEXT_PUBLIC_*` added without a PR review note. Should be fixed; flag if deferred. |
| **info** | A best-practice gap with no current exposure — e.g., slightly overly broad Zod schema defaults, Parameter Store parameters not following the `/app/env/key` convention, missing `.env.example` entry for a new non-sensitive variable. Address opportunistically. |
