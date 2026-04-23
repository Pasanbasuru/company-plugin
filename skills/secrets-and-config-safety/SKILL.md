---
name: secrets-and-config-safety
description: Use when touching environment variables, secret references, or config that varies across environments. Do NOT use for IAM policy review (use `infra-safe-change`) or runtime observability (use `observability-first-debugging`). Covers secret sourcing, env var discipline, config drift, client-vs-server env boundaries, secret rotation awareness.
allowed-tools: Read, Grep, Glob, Bash
---

# Secrets and config safety

## Purpose & scope

Keep secrets out of source, out of logs, and out of the client bundle; keep config predictable across environments. This skill covers the application-code layer: how secrets are sourced, how environment variables are validated at startup, how Next.js client/server boundaries are respected, and how config values that change per environment are managed without drifting. It does not cover how Secrets Manager or Parameter Store are provisioned (that is `infra-safe-change`) or how CI pipelines inject secrets (that is `cicd-pipeline-safety`).

## Assumes `_baseline`. Adds:

Application-level secret sourcing and config discipline — Zod env validation at startup, Next.js `NEXT_PUBLIC_*` boundary enforcement, secret rotation-ready patterns, and config store vs env var separation.

## Core rules

1. **Secrets come from AWS Secrets Manager (runtime pull) or are injected at deploy time — never committed, never in plaintext env files in the repo.** — *Why:* a secret committed even once is permanent — git history is not erased by deletion; anyone with repo access, past or present, can recover it. Deploy-time injection via the platform (ECS task definition, Lambda environment, Vercel env) keeps the plaintext off disk and out of version control entirely.
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
  datasources: { db: { url: process.env.DATABASE_URL } }, // undefined if missing — Prisma will throw at query time, not startup
});

// payments.service.ts
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' });
// The non-null assertion silences TypeScript; a missing key produces an opaque Stripe error
```

Good — single validated env module imported everywhere:
```ts
// lib/env.ts  — validated once at module load; process exits immediately if schema fails
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

```ts
// database.service.ts
import { env } from '../lib/env';

const client = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
// If DATABASE_URL was missing the process would have exited before reaching this line.
```

### Secrets Manager fetch with cache TTL vs baked into image

Bad — secret baked into the Docker image at build time via a build arg:
```dockerfile
# Dockerfile
ARG PAYMENT_API_KEY
ENV PAYMENT_API_KEY=$PAYMENT_API_KEY
# Key is now frozen into a specific image layer. Rotating means rebuilding and redeploying.
# docker build --build-arg PAYMENT_API_KEY=sk_live_... .
```

Good — secret fetched at runtime from AWS Secrets Manager with an in-process TTL cache:
```ts
// lib/secrets.ts
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: process.env.AWS_REGION ?? 'eu-west-1' });

interface CacheEntry {
  value: string;
  expiresAt: number; // epoch ms
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes — short enough to pick up a rotation

export async function getSecret(secretName: string): Promise<string> {
  const now = Date.now();
  const cached = cache.get(secretName);

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await client.send(command);

  if (!response.SecretString) {
    throw new Error(`Secret ${secretName} has no string value`);
  }

  cache.set(secretName, { value: response.SecretString, expiresAt: now + TTL_MS });
  return response.SecretString;
}
```

```ts
// payments.service.ts
import { getSecret } from '../lib/secrets';
import Stripe from 'stripe';

export async function getStripeClient(): Promise<Stripe> {
  const key = await getSecret('prod/payments/stripe-secret-key');
  return new Stripe(key, { apiVersion: '2024-04-10' });
}
// After rotation, the next call after TTL expiry fetches the new value automatically.
```

## Env validation pattern (Zod at startup)

The single most impactful change an application can make to env-var discipline is centralising all `process.env` reads into one module that validates the full schema at process startup. The pattern is straightforward: define a Zod schema that lists every variable the application needs, call `safeParse(process.env)`, and either export the strongly-typed result or call `process.exit(1)` with a clear diagnostic if validation fails.

The benefits compound. First, the startup check transforms a class of silent runtime failures — missing key producing `undefined`, wrong format causing a downstream parse error — into a loud, immediate boot failure with a precise error message. Second, the exported `env` object is typed exactly to its schema: `env.DATABASE_URL` is `string`, never `string | undefined`, so consumers need no defensive coding. Third, the schema serves as the authoritative documentation of every external dependency: a new developer reading `lib/env.ts` knows exactly what they need to configure before running the service. Fourth, it removes the temptation to scatter `process.env.FOO ?? 'default'` logic across dozens of files, each with slightly different fallback behaviour.

Practical details: use `z.string().url()` for URLs to catch malformed values early; use `z.string().min(1)` for opaque secrets where you cannot validate format but want to reject empty strings; use `z.enum([...])` for variables with a fixed value set; use `.default(...)` only for truly optional config that has a safe default — do not use defaults to paper over missing required secrets. If the application runs in multiple modes (server vs worker vs migration), consider separate schema exports that include only the variables relevant to each mode, so a worker does not fail to start because `SMTP_HOST` is missing when it never sends email.

For monorepos or Next.js apps with multiple deployment targets (server, edge, browser), define separate validated env objects per target. Never import the server env schema in client-side code: even if you do not use the exported value, the import itself may pull `process.env` references into the bundle. In Next.js, place the server env module under `src/lib/env.server.ts` and ensure it is never imported from a file in `app/` that could be rendered on the client.

## Next.js `NEXT_PUBLIC_*` discipline

Next.js uses the `NEXT_PUBLIC_` prefix as a build-time signal that a variable is safe to inline into the client-side JavaScript bundle. During the build, the Next.js compiler scans source files for `process.env.NEXT_PUBLIC_*` references and replaces them with their literal values, in the same way Webpack's `DefinePlugin` works. The critical implication is that the replacement happens at build time: the value is frozen into the bundle and shipped to every browser that loads the page, regardless of who they are.

This means `NEXT_PUBLIC_*` is the correct prefix only for values that you would be comfortable publishing in a public repository: the base URL of your own API, a Stripe publishable key (which is designed to be public), a PostHog project key. It is never the correct prefix for Stripe secret keys, database credentials, internal service URLs that should not be discoverable from the client, feature-flag SDK server-side keys, or any value that grants access to a system.

A common mistake is adding `NEXT_PUBLIC_` to a variable to silence a "process.env is not defined" error in a client component, without realising the fix makes the value public. The right fix for a client component that needs a secret is to move the secret access to a Server Component, a Server Action, or an API Route, and pass only the non-sensitive result to the client.

Every `NEXT_PUBLIC_*` variable added to the codebase should be reviewed in the PR with the question: "Would I be comfortable if this value appeared in a public GitHub search?" If the answer is no, it must not be `NEXT_PUBLIC_*`.

```ts
// next.config.ts — acceptable NEXT_PUBLIC_* usage
// These are genuinely public values: the frontend API base URL and the Stripe publishable key.
// Neither grants server-side access; both are designed to be client-visible.

const nextConfig = {
  env: {
    // Do NOT add secrets here — this is equivalent to NEXT_PUBLIC_* for the build.
  },
};

// In a component:
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
// This is correct — the publishable key is intended for client use.

// WRONG — server-only secret accidentally exposed:
// const client = new Stripe(process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY!);
// ^ This compiles and works, but puts your secret key in every visitor's browser.
```

For the server-side env validation in a Next.js application, call `EnvSchema.parse(process.env)` inside a file that is only imported by server code. Using the `server-only` package from npm provides a hard build-time error if the module is accidentally imported in a client component:

```ts
// lib/env.server.ts
import 'server-only'; // build error if imported in a client component

import { z } from 'zod';

const ServerEnvSchema = z.object({
  DATABASE_URL:        z.string().url(),
  STRIPE_SECRET_KEY:   z.string().min(1),
  NEXTAUTH_SECRET:     z.string().min(32),
  SECRETS_MANAGER_ARN: z.string().optional(),
});

const _result = ServerEnvSchema.safeParse(process.env);
if (!_result.success) {
  throw new Error(`Server env validation failed:\n${JSON.stringify(_result.error.flatten(), null, 2)}`);
}

export const serverEnv = _result.data;
```

## Secret rotation-ready patterns

Secret rotation is the practice of periodically replacing a credential with a new one — typically automated via AWS Secrets Manager rotation lambdas, database-native rotation, or a secrets management platform. Rotation fails silently when the consuming application holds the old secret in memory indefinitely. Writing rotation-ready code means the application will pick up the new value within a bounded time window without requiring a restart or a redeploy.

The core pattern is a short-lived in-process cache backed by an async fetch. Rather than reading a secret once at module load and binding it to a module-level variable, the application checks a cache entry on each use. If the cache entry is present and its TTL has not expired, the cached value is returned. If the TTL has expired (or no entry exists), a fresh fetch is issued to Secrets Manager, the cache is updated, and the new value is returned. The TTL should be short enough to pick up a rotation within one TTL window — 5 minutes is a reasonable default for most credentials — but long enough to avoid hammering Secrets Manager on every request (which would be both slow and expensive).

For database credentials, the pattern involves rebuilding the connection pool when the fetched credentials differ from the ones currently in use. A practical approach is to wrap the Prisma (or pg/mysql2) client in a factory that compares the current DSN against the cached one; if they differ, the old pool is drained and a new one is opened. This is more complex than a simple TTL cache but is necessary for credentials that the database itself invalidates on rotation.

Avoid these rotation anti-patterns: reading the secret once at `module` scope with `const secret = await getSecret(...)` (this runs once at import time and never refreshes); storing the secret in a long-lived singleton that is constructed at startup and never recreated; using `process.env` as the cache (env vars are frozen at process start and cannot be mutated in place by an external system).

```ts
// lib/db-secret.ts — rotation-ready database credentials
import { getSecret } from './secrets';
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;
let currentDsn: string | null = null;

export async function getPrismaClient(): Promise<PrismaClient> {
  const secret = await getSecret('prod/db/credentials'); // uses 5-min TTL cache from secrets.ts
  const creds  = JSON.parse(secret) as { username: string; password: string; host: string; dbname: string };
  const dsn    = `postgresql://${creds.username}:${creds.password}@${creds.host}/${creds.dbname}`;

  if (prisma && dsn === currentDsn) {
    return prisma; // credentials unchanged — reuse the pool
  }

  if (prisma) {
    await prisma.$disconnect(); // drain old pool before rebuilding
  }

  prisma     = new PrismaClient({ datasources: { db: { url: dsn } } });
  currentDsn = dsn;
  return prisma;
}
```

## Config store vs env vars

Environment variables are the right mechanism for values that vary per deployment instance: the database DSN for this specific environment, the log level for this tier, the port the server listens on. They are set at deploy time, visible to the process, and reasonable to manage at a small scale. Their limits become apparent when the same flag needs different values for different users within the same deployment, when a flag needs to change without a deploy, or when audit history of config changes matters.

A config store — AWS Systems Manager Parameter Store, AWS AppConfig, LaunchDarkly, Statsig, or a similar system — decouples config from deployment. A parameter in Parameter Store can be updated without touching the application's deployment descriptor; the application polls or receives a push notification and applies the change at runtime. This is the correct home for feature flags, per-tenant limits, rate-limit thresholds, A/B test weights, and any other value that the product team needs to change frequently or independently of a code deploy.

The practical dividing line: if the question is "which database does this environment connect to?", that is an env var. If the question is "should new users see the redesigned onboarding flow?", that is a feature flag in a config store. Mixing the two — putting feature flags in `.env` files — creates a world where changing a flag requires a deploy, operations cannot make a quick change without involving engineering, and the history of flag changes is buried in git commits rather than in the config platform's audit log.

For Parameter Store specifically, prefer the SSM `getParameter` API with `WithDecryption: true` for `SecureString` parameters. SecureString parameters are encrypted at rest with a KMS key you control; they are not as robust as Secrets Manager (which handles rotation and versioning natively) but are appropriate for config values that are sensitive but not credentials (e.g. a third-party webhook signing secret that does not rotate on a schedule). Plain `String` or `StringList` parameters are fine for non-sensitive config like feature flags and numeric thresholds.

```ts
// lib/config.ts — thin wrapper around SSM Parameter Store for feature flags and non-secret config
import {
  SSMClient,
  GetParameterCommand,
  GetParametersByPathCommand,
} from '@aws-sdk/client-ssm';

const ssm = new SSMClient({ region: process.env.AWS_REGION ?? 'eu-west-1' });

export async function getParameter(name: string, decrypt = false): Promise<string> {
  const command = new GetParameterCommand({ Name: name, WithDecryption: decrypt });
  const response = await ssm.send(command);

  if (!response.Parameter?.Value) {
    throw new Error(`SSM parameter not found or empty: ${name}`);
  }

  return response.Parameter.Value;
}

export async function getParametersByPath(path: string): Promise<Record<string, string>> {
  const command = new GetParametersByPathCommand({ Path: path, Recursive: true, WithDecryption: true });
  const response = await ssm.send(command);

  return Object.fromEntries(
    (response.Parameters ?? [])
      .filter((p) => p.Name && p.Value)
      .map((p) => [p.Name!.replace(path, ''), p.Value!]),
  );
}

// Usage — feature flags loaded once per request (or cached with a TTL):
// const flags = await getParametersByPath('/prod/feature-flags/');
// const showNewOnboarding = flags['/show-new-onboarding'] === 'true';
```

## Interactions with other skills

- **Owns:** secret sourcing and env/config discipline in application code.
- **Hands off to:** `infra-safe-change` for how Secrets Manager and Parameter Store are provisioned and which IAM roles have access; `aws-deploy-safety` for role-based fetch permissions at the ECS task/Lambda function level; `cicd-pipeline-safety` for CI secret injection and preventing secrets from appearing in build logs.
- **Does not duplicate:** `auth-and-permissions-safety`'s session and token handling; `observability-first-debugging`'s log analysis.

## Review checklist

Produce a markdown report with these sections:

1. **Summary** — one line: pass / concerns / blocking issues.
2. **Findings** — per issue: *file:line, severity (low/med/high), category, fix*. Fold env-var and `NEXT_PUBLIC_*` inventory observations in here as individual findings rather than separate tables. Examples:
   - `src/config.ts:12, high, unvalidated-env, DATABASE_URL read via process.env without a schema check — fix: parse via zod in lib/env.server.ts and import env.DATABASE_URL instead.`
   - `src/lib/stripe.ts:8, high, next-public-leak, NEXT_PUBLIC_STRIPE_SECRET_KEY inlined into client bundle — fix: rename to STRIPE_SECRET_KEY and move access to a Server Action.`
   - `apps/web/next.config.ts:14, med, next-public-review, NEXT_PUBLIC_API_BASE_URL added — fix: confirm intentional public exposure in PR; acceptable for public API base URL.`
   - `src/payments/stripe.ts:3, med, rotation-blind, stripe client constructed at module load with process.env.STRIPE_SECRET_KEY — fix: fetch via getSecret() with 5-min TTL cache.`
3. **Safer alternative** — propose the secrets-specific higher-leverage move when the diff touches credentials or rotating config. Examples:
   - "Prefer Secrets Manager references in the ECS task definition (`secrets:` block) over `environment:` env vars for rotating credentials — the platform resolves the ARN at task start and rotation propagates without a redeploy."
   - "Prefer Parameter Store SecureString + a scoped KMS grant over plaintext `.env` files checked into the repo — gets audit history, per-environment overrides, and encryption at rest for free."
   - "Prefer moving the secret read into a Server Action and returning only the non-sensitive result to the client over adding `NEXT_PUBLIC_*` to silence a client-component error."
4. **Checklist coverage** — for each of the 7 core rules, mark: PASS / CONCERN / NOT APPLICABLE.
   - Rule 1: Secrets sourced from Secrets Manager or deploy-time injection — not committed
   - Rule 2: `.env.example` committed; real `.env` files gitignored and not shared
   - Rule 3: Env vars validated with Zod at startup; service exits fast on misconfiguration
   - Rule 4: No server-only secret in `NEXT_PUBLIC_*`; all `NEXT_PUBLIC_*` additions reviewed
   - Rule 5: No secret value reaches a log line
   - Rule 6: Secrets are read with a cache TTL, not cached indefinitely at process start
   - Rule 7: Per-environment config lives in a config store, not hard-coded
