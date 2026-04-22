---
name: integration-contract-safety
description: Use when changing a public HTTP API, webhook payload, event schema, or any boundary another team/service depends on. Do NOT use for internal intra-module calls (use `nestjs-service-boundary-guard`). Covers API versioning, breaking-change detection, schema evolution, webhook/event contracts, consumer migration.
allowed-tools: Read, Grep, Glob, Bash
---

# Integration contract safety

## Purpose & scope

Prevent silent breaking changes across service boundaries — consumers find out in production otherwise. This skill governs every point where code crosses a team or service line: REST/HTTP APIs, webhooks, async event payloads, and machine-readable schema files. It prescribes how to distinguish additive changes from breaking ones, how to version and sign payloads, and how to keep contract tests wired in CI so breakage is caught before deployment.

## Assumes `_baseline`. Adds:

cross-service contract discipline — versioning, breaking-change taxonomy, webhook signing, event schema evolution, and contract testing.

## Core rules

1. **Breaking changes require a new major version or a documented migration window.** — *Why:* consumers cannot adapt to changes they do not know about; an undeclared break in production is an outage for someone else's team.
2. **Additive changes are only non-breaking when consumers provably ignore unknown fields.** — *Why:* the "it's just a new field" assumption fails when a consumer deserialises into a strict schema, a typed code-generated client, or a discriminated union; verify the contract assumption before claiming additive safety.
3. **Every public API has a machine-readable contract (OpenAPI 3.1, JSON Schema, or equivalent) and changes to the contract are reviewed before code is merged.** — *Why:* prose documentation drifts; a machine-readable schema can be linted, diffed, and used to generate client stubs, eliminating ambiguity.
4. **Webhook consumers receive signed payloads; signature verification is mandatory before any processing.** — *Why:* without signature verification, any party that learns the endpoint URL can replay or forge events, turning the webhook into an unauthenticated command channel.
5. **Event schemas carry an explicit `schemaVersion` field; consumers tolerate unknown versions by logging and discarding, never crashing.** — *Why:* producers and consumers deploy independently; a consumer receiving a version it has never seen must degrade gracefully rather than cascade-fail.
6. **Deprecations are signalled with a `Deprecation` response header (RFC 8594) or a documented sunset date; silent removals are forbidden.** — *Why:* silent removal gives consumers zero time to adapt and makes postmortems harder because the change is invisible in the API response.
7. **Contract tests (Pact or schema-driven generated-client tests) run in CI on every push and block merge on failure.** — *Why:* manual cross-team coordination is slow and error-prone; automated contract verification catches mismatches before they reach any shared environment.

## Red flags

| Thought | Reality |
|---|---|
| "Small rename, no one uses that field" | Someone does — field removal is one of the most common sources of silent production breakage across service boundaries. |
| "Webhook validation is slow, skip the signature check" | Skipping verification turns the endpoint into an open command channel; replay attacks cost one HTTP request. |
| "We have a version in the URL, we can handle breaks later" | A version number without a migration plan is cosmetic — consumers on the old version are still broken the moment semantics change under them. |

## Good vs bad

### Additive optional field vs type change

Bad:
```ts
// BEFORE
interface OrderCreatedEvent {
  orderId: string;
  total: number; // was a number
}

// AFTER — type change breaks any consumer that stored or compared the value
interface OrderCreatedEvent {
  orderId: string;
  total: string; // changed to string — silent breakage for typed consumers
}
```

Good:
```ts
// BEFORE
interface OrderCreatedEvent {
  orderId: string;
  total: number;
}

// AFTER — additive change: new optional field, existing fields untouched
interface OrderCreatedEvent {
  orderId: string;
  total: number;
  currency?: string; // optional new field; consumers that ignore unknown fields are unaffected
}
```

### Signed webhook verification vs trust on path

Bad:
```ts
// Trusting that the request came from the right sender based on URL path alone
app.post('/webhooks/stripe', express.json(), async (req, res) => {
  const event = req.body; // no verification — anyone who knows this URL can POST
  await processStripeEvent(event);
  res.sendStatus(200);
});
```

Good:
```ts
import crypto from 'node:crypto';

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
const TOLERANCE_SECONDS = 300; // reject replays older than 5 minutes

app.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }), // raw body needed for HMAC
  (req, res) => {
    const sigHeader = req.headers['stripe-signature'] as string | undefined;
    if (!sigHeader) return res.status(400).send('Missing signature header');

    const [timestampPart, v1Part] = sigHeader.split(',');
    const timestamp = parseInt(timestampPart.replace('t=', ''), 10);
    const receivedSig = v1Part.replace('v1=', '');

    // Replay-attack guard
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS) {
      return res.status(400).send('Timestamp outside tolerance window');
    }

    // Recompute the expected HMAC-SHA256
    const signedPayload = `${timestamp}.${req.body}`;
    const expectedSig = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(signedPayload)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const sigBuffer = Buffer.from(receivedSig, 'hex');
    const expectedBuffer = Buffer.from(expectedSig, 'hex');
    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      return res.status(400).send('Invalid signature');
    }

    const event = JSON.parse(req.body.toString());
    res.sendStatus(200); // ack before async processing to avoid webhook retries
    processStripeEvent(event).catch(console.error);
  },
);
```

### Versioned event payload with consumer tolerance vs unversioned

Bad:
```ts
// Producer — no version field; consumers cannot distinguish old from new shape
async function publishOrderShipped(orderId: string, carrier: string) {
  await eventBus.publish('order.shipped', { orderId, carrier });
}

// Consumer — crashes when shape changes
async function handleOrderShipped(raw: unknown) {
  const event = raw as { orderId: string; carrier: string }; // assertion, no guard
  await sendShippingEmail(event.orderId, event.carrier);
}
```

Good:
```ts
import { z } from 'zod';

// Discriminated union keyed on schemaVersion
const OrderShippedV1 = z.object({
  schemaVersion: z.literal(1),
  orderId: z.string().uuid(),
  carrier: z.string(),
});

const OrderShippedV2 = z.object({
  schemaVersion: z.literal(2),
  orderId: z.string().uuid(),
  carrier: z.string(),
  trackingUrl: z.string().url(), // new field in v2
});

const OrderShippedEvent = z.discriminatedUnion('schemaVersion', [
  OrderShippedV1,
  OrderShippedV2,
]);

type OrderShippedEvent = z.infer<typeof OrderShippedEvent>;

// Consumer — tolerates unknown versions gracefully
async function handleOrderShipped(raw: unknown) {
  const parsed = OrderShippedEvent.safeParse(raw);
  if (!parsed.success) {
    // Unknown or malformed version — log and discard, do not crash
    logger.warn({ raw, error: parsed.error }, 'Unrecognised order.shipped schema; skipping');
    return;
  }
  const event = parsed.data;
  const url = event.schemaVersion === 2 ? event.trackingUrl : undefined;
  await sendShippingEmail(event.orderId, event.carrier, url);
}
```

## Breaking vs additive change taxonomy

A change is **breaking** when any existing consumer, following the published contract, will encounter a runtime error or silently incorrect behaviour after the change is deployed. A change is **additive** when every existing consumer continues to work correctly without modification.

**Definitively breaking:**
- Removing a field from a response or event payload.
- Renaming a field (equivalent to remove + add).
- Changing a field's type (e.g., `number` → `string`, `string` → `string[]`).
- Adding a new **required** request field.
- Narrowing an enum: removing a previously valid value.
- Changing the semantics of a field without changing its name or type (e.g., `total` now excludes tax when it previously included it).
- Changing HTTP status codes for existing success or error conditions.
- Removing an endpoint.

**Additive (non-breaking when consumers ignore unknown fields):**
- Adding a new optional response field.
- Adding a new endpoint.
- Adding a new enum value — only non-breaking if consumers use an `else`/`default` branch for unknown values; consumers with exhaustive switches will fail.
- Relaxing a validation rule (e.g., increasing a max-length).
- Adding a new optional request field with a sensible default.

**Behavioural (hard to classify automatically — requires human review):**
- Changing the order of elements in an array response when consumers assumed stable ordering.
- Changing retry or rate-limit semantics.
- Altering idempotency guarantees.
- Changing error message text when consumers parse it programmatically.

Before claiming a change is additive, answer: does every known consumer use a tolerant reader pattern (e.g., struct tags with `omitempty`, Zod with `.passthrough()`, OpenAPI `additionalProperties: true`)? If you cannot verify this for all consumers, treat the change as potentially breaking.

## OpenAPI workflow

The OpenAPI spec is the contract document; the implementation must conform to it, not the other way around.

**Schema-first approach:**

```yaml
# openapi.yaml — excerpt showing a versioned endpoint and deprecation signal
openapi: "3.1.0"
info:
  title: Orders API
  version: "2.0.0"
paths:
  /v1/orders/{orderId}:
    get:
      deprecated: true
      summary: Get order (deprecated — use /v2/orders/{orderId})
      parameters:
        - name: orderId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        "200":
          description: Order
          headers:
            Deprecation:
              description: RFC 8594 deprecation date
              schema:
                type: string
                example: "Sun, 01 Jun 2026 00:00:00 GMT"
            Sunset:
              description: RFC 8594 removal date
              schema:
                type: string
                example: "Mon, 01 Sep 2026 00:00:00 GMT"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/OrderV1"
  /v2/orders/{orderId}:
    get:
      summary: Get order
      parameters:
        - name: orderId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/OrderV2"
components:
  schemas:
    OrderV1:
      type: object
      required: [orderId, total]
      properties:
        orderId: { type: string, format: uuid }
        total:   { type: number }
    OrderV2:
      type: object
      required: [orderId, total, currency]
      properties:
        orderId:  { type: string, format: uuid }
        total:    { type: number }
        currency: { type: string, example: "USD" }
```

**Tooling recommendations:**
- `openapi-typescript` — generates TypeScript types from the spec; use them in the server handler and generated client.
- `redocly lint` or `spectral` — lint the spec for style, required fields, and deprecation consistency in CI.
- `oasdiff` — diff two spec versions and classify each change as breaking/non-breaking; run on every PR that touches `openapi.yaml`.

**PR workflow:**
1. Update `openapi.yaml` first.
2. Run `oasdiff` against the previous version and paste the output into the PR description.
3. If any change is classified as breaking, label the PR `breaking-change` and require sign-off from the consumer team before merge.
4. Generate updated TypeScript types; fix all type errors before the PR is merged.

## Webhook signing and verification

Webhooks are outbound HTTP POST requests from your service to a consumer's URL. Because the consumer's endpoint is publicly reachable, any actor that discovers it can POST arbitrary payloads. Signature verification is the only reliable defence.

**HMAC-SHA256 pattern (Node.js `node:crypto`):**

The producer signs the raw request body concatenated with a timestamp. The consumer recomputes the HMAC and compares using a constant-time function to prevent timing-oracle attacks.

```ts
// producer.ts — sign before sending
import crypto from 'node:crypto';

export function buildWebhookHeaders(
  rawBody: string,
  secret: string,
): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedPayload = `${timestamp}.${rawBody}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return {
    'Content-Type': 'application/json',
    'X-Webhook-Timestamp': timestamp,
    'X-Webhook-Signature': `v1=${signature}`,
  };
}
```

The consumer implementation is shown in the Good vs bad section above. Key points:
- Use `express.raw()` (not `express.json()`) so the raw body bytes are available for HMAC.
- Validate the timestamp is within a tolerance window (typically 5 minutes) to block replay attacks.
- Use `crypto.timingSafeEqual` — `===` comparison leaks timing information that an attacker can exploit.
- Acknowledge with `200` before async processing; most webhook platforms retry on non-2xx responses.

**Secret rotation:** Rotate webhook secrets without downtime by accepting signatures from both the old and the new secret during a brief overlap window (e.g., 30 minutes). Publish the new secret to consumers before revoking the old one.

## Event schema versioning

Asynchronous event systems (EventBridge, SQS, Kafka, internal pub/sub) decouple producers and consumers at the cost of synchronous contract enforcement. Schema versioning is the mechanism that makes this safe.

**Key principles:**

1. Every event payload carries a top-level `schemaVersion` integer. The initial published version is `1`.
2. Producers increment `schemaVersion` on every breaking change and continue publishing both old and new versions in parallel during a migration window.
3. Consumers parse with `safeParse` (never `parse`) and discard events whose `schemaVersion` they do not recognise, emitting a structured log entry with the raw payload for forensics.
4. The Zod discriminated-union pattern (shown in Good vs bad) is the recommended implementation.

**Schema registry:** For high-volume systems, use a schema registry (AWS Glue Schema Registry, Confluent, or a Git-tracked JSON Schema file) as the single source of truth. Producers validate against the registry before publishing; consumers validate on receipt.

**Migration window procedure:**
1. Publish the new schema version as a draft; share with all known consumers.
2. Consumers deploy tolerance for the new version (even if they process it as a no-op initially).
3. Producer deploys and starts emitting the new version.
4. Consumers deploy full support.
5. After the agreed sunset date, producer stops emitting the old version.
6. Consumers remove old-version handling in a cleanup PR.

## Deprecation strategy

A deprecation is a promise to consumers: this feature works today and will be removed on a known future date. Fulfil that promise by making deprecations observable and actionable.

**HTTP API deprecations:**

- Add `Deprecation` and `Sunset` headers (RFC 8594) to every response from a deprecated endpoint.
- Log a structured warning server-side each time a deprecated endpoint is called, including the caller's identity if available. This gives you concrete data on whether any consumer is still using it.
- Document the migration path in the OpenAPI spec's `description` field for the deprecated operation.
- Set a minimum 90-day sunset window for externally consumed APIs; 30 days for internal APIs with known consumers.

```ts
// NestJS interceptor — attaches deprecation headers automatically
@Injectable()
export class DeprecationInterceptor implements NestInterceptor {
  constructor(
    private readonly sunsetDate: string, // e.g. "Mon, 01 Sep 2026 00:00:00 GMT"
    private readonly successorPath: string,
    private readonly logger: Logger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<Request>();
    this.logger.warn({
      msg: 'Deprecated endpoint called',
      path: req.path,
      method: req.method,
      caller: req.headers['x-service-name'] ?? 'unknown',
    });

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse<Response>();
        res.setHeader('Deprecation', 'true');
        res.setHeader('Sunset', this.sunsetDate);
        res.setHeader('Link', `<${this.successorPath}>; rel="successor-version"`);
      }),
    );
  }
}
```

**Event deprecations:**

- Publish a `contract.deprecated` meta-event when an event type or schema version enters deprecation. Include the event type, current version, last-supported version, and sunset timestamp.
- Maintain a deprecation registry (a simple JSON file or a Confluence page) listing every active deprecation with its sunset date and migration instructions.

## Contract testing

Contract tests verify that the producer and consumer agree on a shared contract, independently of each other's implementation. They catch schema drift earlier and more cheaply than end-to-end integration tests.

**Approach 1 — Pact (consumer-driven contract testing):**

Pact generates a "pact file" from consumer tests that records exactly which interactions the consumer depends on. The producer verifies the pact file in its own CI pipeline, ensuring it can satisfy every consumer's expectations without requiring a running consumer service.

```ts
// consumer.pact.spec.ts (Jest + @pact-foundation/pact)
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { fetchOrder } from '../src/orderClient';

const provider = new PactV3({
  consumer: 'ShippingService',
  provider: 'OrdersAPI',
  dir: './pacts',
});

describe('Orders API — consumer contract', () => {
  it('returns an order by ID', async () => {
    await provider.addInteraction({
      states: [{ description: 'order abc-123 exists' }],
      uponReceiving: 'a request for order abc-123',
      withRequest: {
        method: 'GET',
        path: '/v2/orders/abc-123',
      },
      willRespondWith: {
        status: 200,
        body: {
          orderId: MatchersV3.uuid(),
          total:    MatchersV3.number(),
          currency: MatchersV3.string('USD'),
        },
      },
    });

    const order = await provider.executeTest(() => fetchOrder('abc-123'));
    expect(order.orderId).toBeDefined();
  });
});
```

**Approach 2 — Schema-driven generated client tests:**

`openapi-typescript` generates a fully typed client from the OpenAPI spec. Tests written against the generated types act as implicit contract tests: if the server implementation drifts from the spec, the generated types become incorrect and TypeScript compilation fails.

```ts
// orders.contract.spec.ts — uses the generated client from openapi-typescript
import createClient from 'openapi-fetch';
import type { paths } from '../generated/openapi'; // auto-generated from openapi.yaml

const client = createClient<paths>({ baseUrl: process.env.ORDERS_API_URL });

describe('Orders API v2 contract', () => {
  it('GET /v2/orders/:id returns the expected shape', async () => {
    const { data, error } = await client.GET('/v2/orders/{orderId}', {
      params: { path: { orderId: 'abc-123' } },
    });

    expect(error).toBeUndefined();
    // TypeScript enforces data.currency exists — if the server removes it,
    // the generated type is wrong and this line becomes a compile error.
    expect(typeof data!.currency).toBe('string');
  });
});
```

**CI requirements:**
- Contract tests run on every pull request, not just on a schedule.
- Pact broker (or a Git-committed pacts directory) stores pact files so the producer can verify against the latest consumer expectations even when the consumer is not deployed.
- A failing contract test blocks merge — it is a first-class CI failure, not a flaky advisory check.

## Interactions with other skills

- **Owns:** cross-service contracts and their evolution — HTTP API shape, webhook payload signing, event schema versioning, deprecation signalling, and contract testing.
- **Hands off to:** `queue-and-retry-safety` for delivery semantics (at-least-once, DLQ, visibility timeout); `resilience-and-error-handling` for consumer retry patterns and circuit-breaker configuration; `auth-and-permissions-safety` for endpoint authorisation and API key management.
- **Does not duplicate:** `architecture-guard`'s package dependency direction (module-level, compile-time); `nestjs-service-boundary-guard`'s internal intra-module boundary enforcement.

## Review checklist (invoke when reviewing existing code)

Produce a markdown report with these sections:

1. **Summary** — one line: pass / concerns / blocking issues.
2. **Contract change classification** — for every changed interface, endpoint, webhook, or event: classify as *additive*, *breaking*, or *behavioural*; list affected consumers by name.
3. **Findings** — per issue: *File:line, severity (low/med/high), category, what's wrong, recommended fix*.
4. **Checklist coverage** — for each of the 7 core rules, mark: PASS / CONCERN / NOT APPLICABLE.
   - Rule 1: Breaking changes have a major version bump or a documented migration window
   - Rule 2: Additive changes verified as safe for all known consumers
   - Rule 3: Machine-readable contract (OpenAPI/JSON Schema) reviewed before code
   - Rule 4: Webhook payloads are signed; consumers verify before processing
   - Rule 5: Event schemas carry `schemaVersion`; consumers tolerate unknown versions
   - Rule 6: Deprecations signalled with headers/dates; no silent removals
   - Rule 7: Contract tests run in CI and block merge on failure
