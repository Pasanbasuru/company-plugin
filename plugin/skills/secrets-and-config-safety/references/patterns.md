# Secrets and config safety — deep dives

Reference for implementation details. The lean `SKILL.md` states the Core rules; this file explains *how* to apply them with full code examples, edge-case coverage, and worked patterns.

---

## Env validation pattern (Zod at startup)

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

### Why this matters

The single most impactful change an application can make to env-var discipline is centralising all `process.env` reads into one module that validates the full schema at process startup. The benefits compound:

- Startup check transforms a class of silent runtime failures — missing key producing `undefined`, wrong format causing a downstream parse error — into a loud, immediate boot failure with a precise error message.
- The exported `env` object is typed exactly to its schema: `env.DATABASE_URL` is `string`, never `string | undefined`, so consumers need no defensive coding.
- The schema serves as authoritative documentation of every external dependency.
- Removes the temptation to scatter `process.env.FOO ?? 'default'` logic across dozens of files, each with slightly different fallback behaviour.

### Practical details

- Use `z.string().url()` for URLs to catch malformed values early.
- Use `z.string().min(1)` for opaque secrets where you cannot validate format but want to reject empty strings.
- Use `z.enum([...])` for variables with a fixed value set.
- Use `.default(...)` only for truly optional config that has a safe default — do not use defaults to paper over missing required secrets.
- If the application runs in multiple modes (server vs worker vs migration), consider separate schema exports that include only the variables relevant to each mode.

For monorepos or Next.js apps with multiple deployment targets, define separate validated env objects per target. Never import the server env schema in client-side code: even if you do not use the exported value, the import itself may pull `process.env` references into the bundle. In Next.js, place the server env module under `src/lib/env.server.ts` and ensure it is never imported from a file in `app/` that could be rendered on the client.

---

## Next.js `NEXT_PUBLIC_*` discipline

Next.js uses the `NEXT_PUBLIC_` prefix as a build-time signal that a variable is safe to inline into the client-side JavaScript bundle. During the build, the Next.js compiler scans source files for `process.env.NEXT_PUBLIC_*` references and replaces them with their literal values (same mechanism as Webpack's `DefinePlugin`). The value is frozen into the bundle and shipped to every browser that loads the page.

`NEXT_PUBLIC_*` is the correct prefix **only** for values you would be comfortable publishing in a public repository: the base URL of your own API, a Stripe *publishable* key (designed to be public), a PostHog project key. It is **never** the correct prefix for Stripe *secret* keys, database credentials, internal service URLs, feature-flag SDK server-side keys, or any value that grants access to a system.

A common mistake is adding `NEXT_PUBLIC_` to a variable to silence a "process.env is not defined" error in a client component, without realising the fix makes the value public. The correct fix is to move the secret access to a Server Component, a Server Action, or an API Route, and pass only the non-sensitive result to the client.

```ts
// In a component:
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
// Correct — the publishable key is intended for client use.

// WRONG — server-only secret accidentally exposed:
// const client = new Stripe(process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY!);
// ^ This compiles and works, but puts your secret key in every visitor's browser.
```

### Server env module with `server-only`

For the server-side env validation in a Next.js application, use the `server-only` package from npm to provide a hard build-time error if the module is accidentally imported in a client component:

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

Every `NEXT_PUBLIC_*` variable added to the codebase should be reviewed in the PR with the question: "Would I be comfortable if this value appeared in a public GitHub search?" If the answer is no, it must not be `NEXT_PUBLIC_*`.

---

## Secrets Manager fetch with cache TTL vs baked into image

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

---

## Secret rotation-ready patterns

Secret rotation is the practice of periodically replacing a credential with a new one — typically automated via AWS Secrets Manager rotation lambdas, database-native rotation, or a secrets management platform. Rotation fails silently when the consuming application holds the old secret in memory indefinitely.

The core pattern is a short-lived in-process cache backed by an async fetch. Rather than reading a secret once at module load and binding it to a module-level variable, the application checks a cache entry on each use. If the cache entry is present and its TTL has not expired, the cached value is returned. If the TTL has expired (or no entry exists), a fresh fetch is issued to Secrets Manager, the cache is updated, and the new value is returned. The TTL should be short enough to pick up a rotation within one TTL window — 5 minutes is a reasonable default for most credentials.

For database credentials, the pattern involves rebuilding the connection pool when the fetched credentials differ from the ones currently in use:

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

### Rotation anti-patterns to avoid

- Reading the secret once at `module` scope with `const secret = await getSecret(...)` — this runs once at import time and never refreshes.
- Storing the secret in a long-lived singleton constructed at startup and never recreated.
- Using `process.env` as the cache — env vars are frozen at process start and cannot be mutated in place by an external system.

---

## Config store vs env vars

Environment variables are the right mechanism for values that vary per deployment instance: the database DSN for this specific environment, the log level for this tier, the port the server listens on. Their limits become apparent when:

- The same flag needs different values for different users within the same deployment.
- A flag needs to change without a deploy.
- Audit history of config changes matters.

A config store — AWS Systems Manager Parameter Store, AWS AppConfig, LaunchDarkly, Statsig — decouples config from deployment. A parameter in Parameter Store can be updated without touching the application's deployment descriptor; the application polls or receives a push notification and applies the change at runtime.

**Practical dividing line:** if the question is "which database does this environment connect to?", that is an env var. If the question is "should new users see the redesigned onboarding flow?", that is a feature flag in a config store.

For Parameter Store specifically, prefer the SSM `GetParameterCommand` with `WithDecryption: true` for `SecureString` parameters. SecureString parameters are encrypted at rest with a KMS key you control; they are appropriate for config values that are sensitive but not rotating credentials (e.g. a third-party webhook signing secret). Plain `String` or `StringList` parameters are fine for non-sensitive config like feature flags and numeric thresholds.

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

### Parameter Store hierarchy convention

Use `/app/env/key` path convention for all parameters:

- `/myapp/prod/db-url` — database URL for production
- `/myapp/prod/feature-flags/show-new-onboarding` — per-environment feature flag
- `/myapp/staging/api-key` — staging API key

This allows `GetParametersByPath` on `/myapp/prod/` to pull all production config in a single call, and enables IAM path-based access control so staging processes cannot read production secrets.
