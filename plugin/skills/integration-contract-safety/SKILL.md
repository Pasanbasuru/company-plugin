---
name: integration-contract-safety
description: Use when reviewing or editing a public HTTP API, webhook payload, event schema, or any boundary another team/service depends on. Do NOT use for internal intra-module calls (use `nestjs-service-boundary-guard`). Covers API versioning, breaking-change detection, schema evolution, webhook/event contracts, consumer migration.
allowed-tools: Read, Grep, Glob, Bash
---

# Integration contract safety

## Purpose & scope

Prevent silent breaking changes across service boundaries. Governs every point where code crosses a team or service line: REST/HTTP APIs, webhooks, async event payloads, and machine-readable schema files. Prescribes how to distinguish additive from breaking changes, version and sign payloads, and keep contract tests wired in CI so breakage is caught before deployment.

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

Before claiming a change is additive, answer: does every known consumer use a tolerant reader pattern (e.g., struct tags with `omitempty`, Zod with `.passthrough()`, OpenAPI `additionalProperties: true`)?

## OpenAPI workflow

For the schema-first workflow (OpenAPI spec example, `openapi-typescript` / `redocly` / `oasdiff` tooling, PR procedure), see `references/patterns.md` — `OpenAPI workflow` section.

## Webhook signing and verification

Webhook endpoints are public — signature verification is the only defence.

**HMAC-SHA256 pattern:** producer signs the raw body concatenated with a timestamp; consumer recomputes the HMAC and compares via a constant-time function to prevent timing-oracle attacks.

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

The consumer implementation is shown in the Good vs bad section above.

**Secret rotation:** Rotate webhook secrets without downtime by accepting signatures from both the old and the new secret during a brief overlap window (e.g., 30 minutes).

## Event schema versioning

**Schema registry:** For high-volume systems, use a schema registry (AWS Glue Schema Registry, Confluent, or a Git-tracked JSON Schema file). Producers validate against the registry before publishing; consumers validate on receipt.

**Migration window procedure:**
1. Publish the new schema version as a draft; share with all known consumers.
2. Consumers deploy tolerance for the new version (even if they process it as a no-op initially).
3. Producer deploys and starts emitting the new version.
4. Consumers deploy full support.
5. After the agreed sunset date, producer stops emitting the old version.
6. Consumers remove old-version handling in a cleanup PR.

## Deprecation strategy

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
- Maintain a deprecation registry of active sunsets.

## Contract testing

For Pact (consumer-driven) and schema-driven generated-client test patterns plus CI requirements, see `references/patterns.md` — `Contract testing` section.

## Interactions with other skills

- **Owns:** cross-service contracts and their evolution — HTTP API shape, webhook payload signing, event schema versioning, deprecation signalling, and contract testing.
- **Hands off to:** `queue-and-retry-safety` for delivery semantics (at-least-once, DLQ, visibility timeout); `resilience-and-error-handling` for consumer retry patterns and circuit-breaker configuration; `auth-and-permissions-safety` for endpoint authorisation and API key management.
- **Does not duplicate:** `architecture-guard`'s package dependency direction (module-level, compile-time); `nestjs-service-boundary-guard`'s internal intra-module boundary enforcement.

## Review checklist (invoke when reviewing existing code)

Produce a markdown report with these sections:

1. **Summary** — one line: GREEN / YELLOW / RED, plus overall contract health.
2. **Findings** — per issue: *file:line, severity: blocking | concern | info, category, fix*. Also tag each finding's contract change class (*additive* / *breaking* / *behavioural*) and name affected consumers inline in the fix column.
3. **Safer alternative** — prefer additive schema evolution (new optional fields, tolerant readers) over breaking changes paired with version bumps; prefer consumer-driven contracts (Pact) over producer-owned OpenAPI specs for inter-service APIs where consumers are known; prefer explicit `schemaVersion` + deprecation headers over silent removal.
4. **Checklist coverage** — for each of the 7 core rules, mark: PASS / CONCERN / NOT APPLICABLE.
   - Rule 1: Breaking changes have a major version bump or a documented migration window
   - Rule 2: Additive changes verified as safe for all known consumers
   - Rule 3: Machine-readable contract (OpenAPI/JSON Schema) reviewed before code
   - Rule 4: Webhook payloads are signed; consumers verify before processing
   - Rule 5: Event schemas carry `schemaVersion`; consumers tolerate unknown versions
   - Rule 6: Deprecations signalled with headers/dates; no silent removals
   - Rule 7: Contract tests run in CI and block merge on failure
