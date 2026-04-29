---
name: secrets-and-config-safety
description: Use when touching environment variables, secret references, or config that varies across environments. Do NOT use for IAM policy review (use `infra-safe-change`) or runtime observability (use `observability-first-debugging`). Covers secret sourcing, env var discipline, config drift, client-vs-server env boundaries, secret rotation awareness.
allowed-tools: Read, Grep, Glob, Bash
---

# Secrets and config safety

## Purpose & scope

Keep secrets out of source, out of logs, and out of the client bundle; keep config predictable across environments. Covers application-code layer: sourcing, startup validation, Next.js client/server boundaries, per-env config.

## Core rules

1. **Secrets come from AWS Secrets Manager (runtime pull) or are injected at deploy time — never committed, never in plaintext env files in the repo.** — *Why:* git history is forever; deploy-time injection keeps plaintext off disk.
2. **`.env.example` (or equivalent) is committed; real `.env` files are `.gitignore`d and never shared in chat.** — *Why:* an example file documents every required variable without leaking values; sharing in chat pastes the secret into a transcript that may be retained, searched, or exposed by the platform.
3. **Env vars are validated on startup with Zod — fail fast with a clear message if missing.** — *Why:* a service that starts with a missing or malformed secret silently falls back to `undefined`, producing cryptic runtime errors far from the source; fail-fast surfaces the misconfiguration at deploy time, not at 3 AM during an incident.
4. **Next.js: server-only secrets never go in `NEXT_PUBLIC_*`. Every `NEXT_PUBLIC_*` variable is reviewed before merge.** — *Why:* `NEXT_PUBLIC_*` values are inlined into the client bundle at build time and shipped to every browser; any secret placed there is immediately public, regardless of what the variable name implies.
5. **No secret reaches a log line. Log the *fact* of a secret's presence, not its value.** — *Why:* logs are frequently shipped to centralised stores (CloudWatch, Datadog, Splunk) with broader access than the application itself; a single `console.log(config)` can spray every API key to anyone with log access.
6. **Rotation is assumed: code reads secrets fresh (or via a cache with TTL), not once at process start, for credentials that can be rotated.** — *Why:* a secret cached indefinitely at boot continues serving the old value after rotation, breaking the service; a short-lived in-process cache (e.g. 5-minute TTL) handles rotation smoothly with one recheck per TTL window.
7. **Feature flags and config that differs by environment lives in a config store (Parameter Store, LaunchDarkly, etc.), not hard-coded.** — *Why:* hard-coded feature flags become orphaned constants no-one dares delete; a config store provides audit history, per-environment overrides, and the ability to change behaviour without a deploy.

## Red flags

| Thought | Reality |
|---|---|
| "I'll commit it, we rotate later" | Later never comes. The secret is now in git history permanently, and rotation requires every consumer to update — which is always deprioritised. |
| "It's just staging, paste it in chat" | Staging secrets propagate: they're reused, screen-shared, and sometimes accidentally promoted to production config. Treat staging secrets as production-grade. |
| "Caching the secret at boot is fine" | Rotation breaks the service. The old value stays in memory until the process restarts, which may be hours or days later depending on deployment cadence. |

## Good vs bad

### Zod-validated env at startup vs direct `process.env` access

Bad — scattered, unvalidated `process.env` reads throughout the codebase:

```ts
// database.service.ts
const client = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }, // undefined if missing
});

// payments.service.ts
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' });
// The non-null assertion silences TypeScript; a missing key produces an opaque Stripe error
```

Good — single validated env module imported everywhere:

```ts
// lib/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL:      z.string().url(),
  STRIPE_SECRET_KEY: z.string().min(1),
  AWS_REGION:        z.string().default('eu-west-1'),
  LOG_LEVEL:         z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = z.infer<typeof EnvSchema>;

const _parsed = EnvSchema.safeParse(process.env);

if (!_parsed.success) {
  console.error('❌ Invalid environment variables:\n', _parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env: Env = _parsed.data;
```

For full patterns (Next.js `server-only` guard, rotation-ready Prisma pool, SSM Parameter Store wrapper, `NEXT_PUBLIC_*` deep dive), see `references/patterns.md`.

## Interactions with other skills

- **Owns:** secret sourcing and env/config discipline in application code.
- **Hands off to:** `infra-safe-change` for how Secrets Manager and Parameter Store are provisioned and which IAM roles have access; `aws-deploy-safety` for role-based fetch permissions at the ECS task/Lambda function level; `cicd-pipeline-safety` for CI secret injection and preventing secrets from appearing in build logs.
- **Does not duplicate:** `auth-and-permissions-safety`'s session and token handling; `observability-first-debugging`'s log analysis.

## Review checklist

### Summary

One line: pass / concerns / blocking issues. Name the reviewed surface and the overall verdict in a single sentence.

### Findings

One bullet per finding: `path/to/file.ts:line` — **severity** (blocking | concern | info) — *category* (unvalidated-env | next-public-leak | next-public-review | committed-secret | rotation-blind | logged-secret | hard-coded-config | gitignore-missing) — what is wrong, recommended fix. Fold env-var and `NEXT_PUBLIC_*` inventory observations in here rather than separate tables.

### Safer alternative

Secrets-specific higher-leverage move for each finding. See `references/review-checklist.md` for standard safer-alternative text covering rotating credentials in ECS, Parameter Store SecureString, Server Actions over `NEXT_PUBLIC_*`, and feature flags in config stores.

### Checklist coverage

Mark each of the 7 Core rules PASS / CONCERN / NOT APPLICABLE with a one-line justification. See `references/review-checklist.md` for the full coverage table, required explicit scans, and severity definitions.

---

*For full implementation deep-dives (Zod env module, Next.js `NEXT_PUBLIC_*` discipline, Secrets Manager TTL cache, rotation-ready Prisma pool, SSM Parameter Store wrapper), see `references/patterns.md`. For the complete PR review checklist with coverage table, required explicit scans, and severity definitions, see `references/review-checklist.md`.*
