---
name: test-strategy-enforcement
description: Use when adding tests, changing testing patterns, or reviewing a PR's test plan. Do NOT use for missing-coverage analysis (use `coverage-gap-detection`) or for risk assessment (use `change-risk-evaluation`). Covers test pyramid, unit vs integration vs e2e split, flake hygiene, test data, mocks vs real services.
allowed-tools: Read, Grep, Glob, Bash
---

# Test strategy enforcement

## Purpose & scope

Keep the test portfolio useful — fast where it matters, real where correctness requires it, minimal where it doesn't.

## Core rules

1. **Unit tests are pure — no DB, no network, no filesystem. Target < 50 ms each.** — *Why:* slow or IO-bound unit tests are not unit tests; they are integration tests without the benefit of a real environment. Speed is what makes a unit suite worth running on every keystroke.
2. **Integration tests hit a real DB (testcontainers Postgres) and a real HTTP stack. No mocked Prisma, no mocked Nest controllers.** — *Why:* mocking Prisma detaches the test from SQL behavior, migration state, and constraint enforcement. A test that passes against a mock but fails against the real DB is worse than no test.
3. **E2E tests (Playwright) cover a short list of critical user journeys, not every edge case.** — *Why:* E2E tests are expensive to author, slow to run, and brittle against UI change. They exist to prove the system assembles correctly, not to exhaustively test logic.
4. **Mocks are for third parties your team does not own — payment gateways, email providers, external APIs. Do not mock your own services.** — *Why:* mocking owned services lets the wiring between them go untested. The mock will drift from reality and the suite will give false confidence.
5. **Test data is built with factories (Fishery, or plain builder functions), not rigid JSON fixtures — each test defines only what matters.** — *Why:* fixtures force every test to maintain irrelevant fields. When the schema changes, fixtures all break at once. Factories produce a valid default and let the test override exactly the fields under scrutiny.
6. **Tests are deterministic — seed randomness, freeze time with `vi.useFakeTimers()`, never rely on real clocks or wall time.** — *Why:* a test that passes at 11:59 PM but fails at midnight is a flake factory. Fake timers let you assert on exact relative durations without sleep.
7. **Flaky tests are quarantined and fixed or deleted within the sprint — never left as "pending" or silently retried.** — *Why:* a flaky test teaches the team to ignore red builds. Once engineers start reflexively re-running CI without investigating, signal is lost and real failures hide in the noise.

## Red flags

| Thought | Reality |
|---|---|
| "I mocked Prisma, the test is fast" | Repository tests must use real Prisma against a real DB. The mock cannot enforce FK constraints, trigger cascade behavior, or fail on migration drift. |
| "Just snapshot it" | Snapshot tests rot silently. Reviewers rubber-stamp diffs they do not read. Use explicit assertions on the values that actually matter. |
| "Sleep(500) until it passes" | `sleep` converts a race condition into a flake factory. Use `vi.useFakeTimers()` or `waitFor` with an explicit condition instead. |

## Good vs bad

### Testcontainers Postgres integration test vs mocked Prisma

Bad — the test never touches a real database:
```ts
// mocked Prisma — migration state, constraints, and SQL behavior all invisible
vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findFirst: vi.fn().mockResolvedValue({ id: 'ord-1', status: 'PENDING' }),
    },
  },
}));

it('returns the pending order', async () => {
  const result = await getLatestPendingOrder('cust-1');
  expect(result?.status).toBe('PENDING');
});
```

Good — runs against a real Postgres container:
```ts
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  process.env.DATABASE_URL = container.getConnectionUri();
  execSync('npx prisma migrate deploy', { env: process.env });
  prisma = new PrismaClient();
});

afterAll(async () => {
  await prisma.$disconnect();
  await container.stop();
});

it('returns the latest pending order for a customer', async () => {
  const customer = await prisma.customer.create({ data: { email: 'a@test.com' } });
  await prisma.order.createMany({
    data: [
      { customerId: customer.id, status: 'PAID',    createdAt: new Date('2024-01-01') },
      { customerId: customer.id, status: 'PENDING', createdAt: new Date('2024-01-02') },
    ],
  });

  const result = await getLatestPendingOrder(customer.id);

  expect(result?.status).toBe('PENDING');
  expect(result?.createdAt.toISOString()).toBe('2024-01-02T00:00:00.000Z');
});
```

### Factory + override vs rigid JSON fixture

Bad — fixture breaks when any unrelated field changes:
```ts
// fixtures/order.json
{
  "id": "ord-1",
  "customerId": "cust-1",
  "status": "PENDING",
  "total": 99.99,
  "currency": "USD",
  "shippingAddressId": "addr-1",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}

// test
const order = JSON.parse(readFileSync('fixtures/order.json', 'utf-8'));
it('calculates tax', () => {
  expect(calculateTax(order)).toBe(9.00);
});
```

Good — factory provides valid defaults; test overrides only what matters:
```ts
import { Factory } from 'fishery';
import type { Order } from '@prisma/client';

const orderFactory = Factory.define<Order>(() => ({
  id:                `ord-${Math.random().toString(36).slice(2)}`,
  customerId:        'cust-default',
  status:            'PENDING',
  total:             100,
  currency:          'USD',
  shippingAddressId: 'addr-default',
  createdAt:         new Date('2024-01-01'),
  updatedAt:         new Date('2024-01-01'),
}));

it('calculates 9% tax on a USD order', () => {
  const order = orderFactory.build({ total: 100, currency: 'USD' });
  expect(calculateTax(order)).toBe(9);
});

it('calculates 25% VAT on a EUR order', () => {
  const order = orderFactory.build({ total: 100, currency: 'EUR' });
  expect(calculateTax(order)).toBe(25);
});
```

### `vi.useFakeTimers()` with advance vs sleep

Bad — sleep introduces wall-time dependency and slows the suite:
```ts
it('expires a session after 15 minutes', async () => {
  const session = createSession();
  await new Promise((r) => setTimeout(r, 900_000)); // 15 min — nobody actually waits this
  expect(isExpired(session)).toBe(true);
});
```

Good — fake timers advance instantly with no real wall time:
```ts
it('expires a session after 15 minutes', () => {
  vi.useFakeTimers();
  const session = createSession();

  vi.advanceTimersByTime(14 * 60 * 1000); // 14 min
  expect(isExpired(session)).toBe(false);

  vi.advanceTimersByTime(60 * 1000); // +1 min = 15 min total
  expect(isExpired(session)).toBe(true);

  vi.useRealTimers();
});
```

---

## Test pyramid (concrete ratios)

A healthy backend service in this codebase should aim for roughly **70 % unit / 25 % integration / 5 % e2e** by test count.

| Pattern | Symptom | Fix |
|---|---|---|
| Too many unit tests | Refactors break tests; coverage of integration paths is thin | Replace with integration tests at trust boundaries |
| Too many integration tests | Slow CI; flake | Move pure-logic checks to unit |
| Too many e2e tests | Long feedback loop; brittle to UI churn | Cap to critical user flows |

Concretely, for a NestJS service with Prisma:
- Unit tests belong in `*.spec.ts` files co-located with the module. They import the class under test directly, inject stub dependencies, and complete in under 50 ms each.
- Integration tests belong in `*.integration.spec.ts` or a dedicated `test/integration/` directory. They spin up a Testcontainers Postgres instance, run migrations, and exercise the full NestJS application with `supertest` or NestJS's `Test.createTestingModule`.
- E2E tests belong in `test/e2e/` and run against a fully deployed instance (staging, or a local `docker-compose` stack). They use Playwright and cover 5–10 critical journeys maximum.

---

## Testcontainers setup for Postgres

Use `@testcontainers/postgresql` (from the `testcontainers` monorepo).

**Per-test isolation:** wrap each test in a transaction that rolls back.

```ts
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

// established in beforeAll (container already started)
beforeEach(async () => {
  await prisma.$executeRaw`BEGIN`;
});

afterEach(async () => {
  await prisma.$executeRaw`ROLLBACK`;
});
```

Provide the same `PrismaClient` to the NestJS test module so both share the transaction:

```ts
const module = await Test.createTestingModule({
  providers: [
    OrderService,
    { provide: PrismaService, useValue: prisma }, // shared instance
  ],
}).compile();
```

Set `DATABASE_URL` in Vitest `globalSetup` before any test module imports Prisma:

```ts
// vitest.global-setup.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';

export default async function setup() {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  process.env.DATABASE_URL = container.getConnectionUri();
  execSync('npx prisma migrate deploy', { env: process.env });
  return async () => container.stop();
}
```

Then in `vitest.config.ts`:
```ts
export default defineConfig({
  test: {
    globalSetup: ['./vitest.global-setup.ts'],
  },
});
```

---

## Factories and test data

Use **Fishery** (`fishery` on npm) for structured factory definitions.

```ts
// test/factories/customer.factory.ts
import { Factory } from 'fishery';
import type { Customer } from '@prisma/client';

export const customerFactory = Factory.define<Customer>(({ sequence }) => ({
  id:        `cust-${sequence}`,
  email:     `customer-${sequence}@example.com`,
  name:      'Test Customer',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}));

// test/factories/order.factory.ts
import { Factory } from 'fishery';
import type { Order } from '@prisma/client';

export const orderFactory = Factory.define<Order>(({ sequence }) => ({
  id:                `ord-${sequence}`,
  customerId:        'cust-default',
  status:            'PENDING',
  total:             100,
  currency:          'USD',
  shippingAddressId: null,
  createdAt:         new Date('2024-01-01'),
  updatedAt:         new Date('2024-01-01'),
}));
```

For integration tests that need DB rows, add a `create` helper that calls Prisma:

```ts
// test/factories/order.factory.ts (extended)
import { PrismaClient } from '@prisma/client';

export function makeOrderFactory(prisma: PrismaClient) {
  return {
    create: (overrides: Partial<Order> = {}) =>
      prisma.order.create({ data: { ...orderFactory.build(), ...overrides } }),
  };
}
```

Keep factories honest: if a default value would violate a DB constraint, fix the factory default rather than adding `try/catch` in the test.

Avoid global fixtures (JSON, SQL seeds) — they couple tests and create order-dependence; only OK for never-changing reference data.

---

## Flake hunting

| Cause | Symptom | Fix |
|---|---|---|
| Timing | Intermittent timeouts; speed-dependent | Replace `setTimeout` with `vi.useFakeTimers()` or condition-based waits |
| Shared state | Order-dependent failures | Reset state in `beforeEach`; transaction-rollback |
| Non-determinism | `Date.now()`, `Math.random()`, network | Inject seeds; mock at boundary |

Seed `Math.random` if you need controlled randomness:

```ts
import seedrandom from 'seedrandom';
const rng = seedrandom('fixed-seed-for-tests');
```

**Quarantine protocol:** when a flake is identified, open a ticket, mark the test with `it.skip` (with a comment linking the ticket), and commit. Do not re-run CI repeatedly trying to get the test to pass.

**Detection tooling:** Vitest's `--reporter=verbose` and `--retry=2` flag (used sparingly) can surface flakes in CI.

---

## What to mock, what to keep real

**Mock when:**
- The dependency is a third-party service your team does not own (Stripe, SendGrid, AWS S3, Twilio). These services have rate limits, cost money per call, and cannot be reliably controlled in tests.
- The dependency has non-deterministic side effects that make assertions impossible (e.g., sending a real email, charging a real card).
- The unit under test is pure logic and the dependency is infrastructure — mock the infrastructure to keep the test fast.

**Keep real when:**
- The dependency is a service your team owns. Test it end-to-end with a real instance.
- The dependency is Prisma. Use Testcontainers. Mocking Prisma hides SQL errors, constraint violations, migration drift, and type mismatches between the Prisma client and the actual schema.
- The dependency is NestJS's module system. Use `Test.createTestingModule` with real providers; only override the outermost external dependencies.
- The dependency is the HTTP layer. Use `supertest` against a real NestJS application instance rather than calling controller methods directly.

**The concrete boundary for this codebase:**

| Layer | What to keep real | What to mock |
|---|---|---|
| Unit test (service logic) | Nothing external | PrismaService, external HTTP clients, email, queues |
| Integration test (repository / service) | Postgres (Testcontainers), NestJS DI, Prisma | Stripe, SendGrid, S3, any external API |
| E2E test (Playwright) | Full stack (app + real Postgres) | Nothing — use a dedicated test environment |

Prefer explicit `vi.fn().mockResolvedValue(...)` over `vi.mock(...)` auto-mocks (auto-mocks silently return `undefined`).

---

## Interactions with other skills

- **REQUIRED SUB-SKILL:** superpowers:test-driven-development — TDD is the upstream discipline; this skill adds pyramid / layer-split / flake-hygiene rules on top.
- **Owns:** test strategy and patterns — pyramid shape, tooling, flake hygiene, data management, mock discipline.
- **Hands off to:** `coverage-gap-detection` for identifying which paths need tests; `change-risk-evaluation` for assessing blast radius of a change.
- **Does not duplicate:** `prisma-data-access-guard`'s migration testing concerns — this skill focuses on how to structure the test, not on Prisma query correctness.

## Review checklist

Produce a markdown report with these sections:

1. **Summary** — one line: GREEN / YELLOW / RED.
2. **Findings** — per issue: *File:line, severity (low/med/high), category, what's wrong, recommended fix*.
3. **Safer alternative** — for each concern, suggest the lower-risk test pattern:
   - Prefer Testcontainers-backed integration tests over mocked Prisma/DB repository tests for data-access code.
   - Prefer contract tests (Pact) at the integration layer over e2e tests that exercise the whole stack for API contract validation.
   - Prefer fake timers (`vi.useFakeTimers()` + `advanceTimersByTime`) and deterministic clocks over `setTimeout`/sleep-based waits for flake hygiene.
   - Prefer seed factories (Fishery) with realistic distributions over ad-hoc JSON fixtures for data-dependent tests.
4. **Checklist coverage** — for each rule below, mark: PASS / CONCERN / NOT APPLICABLE.
   - Rule 1: Unit tests are pure — no DB, no network, no filesystem; each < 50 ms
   - Rule 2: Integration tests use Testcontainers Postgres — no mocked Prisma, no mocked Nest controllers
   - Rule 3: E2E tests (Playwright) cover critical journeys only — not edge cases
   - Rule 4: Mocks are for third-party owned services only — no mocks of team-owned services
   - Rule 5: Test data is built with factories (Fishery / builders) — no rigid JSON fixtures for logic tests
   - Rule 6: Time-dependent tests use `vi.useFakeTimers()` — no `sleep`, no `Date.now()` without freezing
   - Rule 7: No flaky tests left as pending or silently retried — all quarantined with a linked ticket

**Required explicit scans:**
- List every `vi.mock` of a Prisma service or team-owned service with file and line number.
- List every snapshot test (`toMatchSnapshot`, `toMatchInlineSnapshot`) in non-UI code.
- List every `setTimeout` / `sleep` call inside a test body.
