# Integration contract safety — patterns

Detailed implementation patterns for the integration-contract-safety skill. Loaded only when the SKILL.md body points here.

## OpenAPI workflow

The OpenAPI spec is the contract; the implementation conforms to it, not the other way around.

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

**Tooling:**
- `openapi-typescript` — generates TypeScript types from the spec; use them in the server handler and generated client.
- `redocly lint` or `spectral` — lint the spec for style, required fields, and deprecation consistency in CI.
- `oasdiff` — diff two spec versions and classify each change as breaking/non-breaking; run on every PR that touches `openapi.yaml`.

**PR workflow:**
1. Update `openapi.yaml` first.
2. Run `oasdiff` against the previous version and paste the output into the PR description.
3. If any change is classified as breaking, label the PR `breaking-change` and require sign-off from the consumer team before merge.
4. Generate updated TypeScript types; fix all type errors before the PR is merged.

## Contract testing

Contract tests verify producer and consumer agree on a shared contract, independent of each other's implementation — catching schema drift earlier and cheaper than end-to-end integration tests.

**Approach 1 — Pact (consumer-driven):** Pact generates a pact file from consumer tests recording the exact interactions the consumer depends on. The producer verifies the pact file in its own CI, satisfying every consumer's expectations without a running consumer service.

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
