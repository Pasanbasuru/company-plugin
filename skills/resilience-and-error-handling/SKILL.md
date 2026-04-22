---
name: resilience-and-error-handling
description: Use when code calls a network service, handles an error, sets a timeout, implements a retry, or exposes a user-facing failure path. Do NOT use for queue-specific retry semantics (use `queue-and-retry-safety`). Covers timeouts, retry with jitter, circuit breakers, error boundaries, idempotency of external calls, graceful degradation, typed errors.
allowed-tools: Read, Grep, Glob, Bash
---

# Resilience and error handling

## Purpose & scope

Software fails. Networks partition, third-party services degrade, edge cases reach production at 3 AM, and tail latency is always worse than median. Code that assumes the happy path breaks users when assumptions are violated. This skill prescribes the patterns that make code fail *well*: bounded waits, safe retries, fast-fail under load, isolated failure surfaces, and typed error contracts that force the caller to handle every outcome.

Apply this skill whenever you touch a `fetch` call, an HTTP client, an SDK integration, a `try/catch` block, a React component that can throw, or any function that returns a recoverable failure alongside a success path.

## Assumes `_baseline`. Adds:

In-process resilience patterns — explicit timeouts, exponential backoff with jitter, idempotency keys for external POSTs, circuit breakers with fallbacks, React error boundaries, typed error contracts, and graceful degradation strategies.

## Core rules

1. **Every network call has an explicit timeout.** No call uses the default (infinite) timeout. — *Why:* a slow upstream will exhaust the thread pool, connection pool, or Lambda concurrency and turn a partial outage into a total one. Tail latency is not an edge case; it is a normal operating condition at scale.

2. **Retries use exponential backoff with full jitter, a max-attempts cap, and a max-delay cap. Not all errors are retryable — 4xx responses (except 408 and 429) are not.** — *Why:* naive fixed-interval retries produce thundering herds that hammer a recovering service; jitter spreads load. Retrying a 400 Bad Request is pointless and wastes quota; retrying a 503 is correct. Cap the delay to avoid multi-minute waits that degrade user experience beyond recovery.

3. **External POSTs include an idempotency key so a retry does not duplicate the side effect.** The key must be stable across retries for the same logical operation. — *Why:* a network timeout on a POST may mean the server received and processed the request before the connection dropped. Retrying without an idempotency key charges the card twice, creates duplicate orders, or sends duplicate notifications.

4. **Third-party integrations sit behind a circuit breaker. When the circuit is open, the call fast-fails with a fallback or a user-visible degraded state rather than queuing up slow failures.** — *Why:* without a circuit breaker, every request to a failed integration pays the full timeout cost before failing. At high request rates this fills the event loop with pending timers and degrades every feature in the application, not just the one using the broken integration.

5. **React error boundaries wrap individual feature surfaces. A crashed feature does not crash the page or the app.** — *Why:* a single unguarded `throw` inside a React subtree unmounts the entire component tree above it. Users see a blank screen instead of a partially functional page. Feature-level boundaries contain the blast radius and allow recovery UI (retry button, fallback content) per feature.

6. **Errors are typed — either `Result<T, E>` discriminated unions for recoverable failures or a typed exception hierarchy for bugs and unrecoverable states. `catch (e: unknown)` always narrows before accessing properties.** — *Why:* an untyped `catch` block that logs and moves on silently hides the failure from the caller. Typed errors force the caller to handle every outcome; narrowing before access prevents `Cannot read properties of undefined` crashes inside error handlers.

7. **User-facing error messages are actionable and never leak internals.** Messages tell users what to do ("Try again", "Contact support with reference XYZ") — not what went wrong internally. Stack traces, database errors, and internal service names never reach the browser. — *Why:* leaked internals are an information disclosure vulnerability and a poor user experience simultaneously. An actionable message reduces support load.

8. **Background work has a supervisor or lifecycle owner — no fire-and-forget promises.** `void someAsyncFn()` is banned. Either `await` the call, attach a `.catch` with structured logging, or enqueue the work through a durable mechanism. — *Why:* an unhandled promise rejection in Node.js terminates the process in newer runtimes. Even where it doesn't, a silently swallowed failure looks like success to every monitoring tool.

## Red flags

| Thought | Reality |
|---|---|
| "I'll just retry 3 times" | Without backoff and jitter, three simultaneous retries hit the recovering service at the same instant — a thundering herd that prevents recovery. |
| "Try/catch and log it, move on" | The error is swallowed; the caller proceeds as though the operation succeeded. Data is corrupted, side effects are partial, and the symptom surfaces far from the cause. |
| "No timeout — it's usually fast" | The P99 is your 3 AM page, not the median. One slow upstream response holds a connection open for minutes and cascades into pool exhaustion. |
| "await someAsync() in a loop with no concurrency limit" | Fifty slow callers saturate the event loop. Add `p-limit` or a semaphore to cap in-flight requests. |

## Good vs bad

### Timeout + typed retry vs bare fetch

Bad — no timeout, no retry policy, untyped catch:

```typescript
// BAD: no timeout, retries on all errors, swallowed failures
async function getUser(id: string): Promise<User> {
  try {
    const res = await fetch(`https://api.example.com/users/${id}`);
    return res.json();
  } catch (e) {
    console.error('failed', e);
    return null as any;  // lie to the type system; caller assumes success
  }
}
```

Good — AbortController timeout, typed retry with jitter, typed result:

```typescript
// GOOD: bounded timeout, exponential backoff with jitter, typed Result
import { fetchWithTimeout } from './http';
import { retryWithBackoff } from './retry';
import type { Result } from './result';

type GetUserError =
  | { code: 'NOT_FOUND' }
  | { code: 'UPSTREAM_ERROR'; status: number }
  | { code: 'NETWORK_ERROR'; cause: unknown };

async function getUser(id: string): Promise<Result<User, GetUserError>> {
  return retryWithBackoff(
    () => fetchWithTimeout(`https://api.example.com/users/${id}`, { timeoutMs: 5_000 }),
    { maxAttempts: 3, retryOn: isRetryableHttpError },
  );
}
```

### Circuit breaker wrapper vs direct integration call

Bad — every call to a degraded service pays the full timeout cost:

```typescript
// BAD: no circuit breaker — 10 000 req/s × 5s timeout = 50 000 concurrent requests
// waiting in the event loop when the CRM is down
async function lookupCustomerTier(customerId: string): Promise<string> {
  const res = await fetch(`https://crm.internal/customers/${customerId}/tier`, {
    signal: AbortSignal.timeout(5_000),
  });
  return res.json();
}
```

Good — open circuit fast-fails with a safe default; closed circuit calls normally:

```typescript
// GOOD: circuit breaker; when open, returns cached/default tier in <1ms
import CircuitBreaker from 'opossum';

const crmBreaker = new CircuitBreaker(rawLookupCustomerTier, {
  timeout:             5_000,  // ms before a call is considered failed
  errorThresholdPercentage: 50, // open after 50% failures in the rolling window
  resetTimeout:        30_000, // try again after 30s
});

crmBreaker.fallback(() => 'standard');  // degrade gracefully

export async function lookupCustomerTier(customerId: string): Promise<string> {
  return crmBreaker.fire(customerId);
}
```

### Error boundary per feature vs single app-level boundary

Bad — one boundary at the root; any component crash blanks the entire page:

```tsx
// BAD: one boundary at the app root — a crash in <RecommendationPanel>
// unmounts the entire app and shows a blank error screen
function App() {
  return (
    <ErrorBoundary fallback={<p>Something went wrong</p>}>
      <Header />
      <MainContent />
      <RecommendationPanel />  {/* crashes here → whole app unmounts */}
      <Footer />
    </ErrorBoundary>
  );
}
```

Good — each independent feature has its own boundary; failures are isolated:

```tsx
// GOOD: each feature boundary is independent; a crash in one panel
// shows that panel's error UI while the rest of the page remains functional
import { ErrorBoundary } from 'react-error-boundary';

function App() {
  return (
    <>
      <Header />
      <ErrorBoundary fallback={<MainContentError />}>
        <MainContent />
      </ErrorBoundary>
      <ErrorBoundary fallback={<RecommendationFallback />}>
        <RecommendationPanel />
      </ErrorBoundary>
      <Footer />
    </>
  );
}
```

## Timeouts

Every call to an external system must have a finite timeout. "External" includes HTTP APIs, gRPC services, database queries, Redis commands, S3 operations, and DNS lookups. "Finite" means you set it explicitly — never rely on a framework or SDK default.

The canonical Node.js / browser pattern uses `AbortController`:

```typescript
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs: number },
): Promise<Response> {
  const { timeoutMs, ...rest } = options;
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...rest, signal: controller.signal });
    if (!response.ok) {
      throw new UpstreamError(response.status, url);
    }
    return response;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new TimeoutError(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timerId);
  }
}
```

`AbortSignal.timeout(ms)` is available in Node 17.3+ and modern browsers as a shorthand — but it does not cancel the `clearTimeout` side of the timer, so an explicit `AbortController` pattern is clearer in long-lived server code. Always clear the timer in a `finally` block to prevent memory leaks.

**Choosing timeout values.** The timeout must be below the caller's own timeout (the one your caller set on you), minus processing overhead. A common layering: API gateway → 30 s, service-to-service → 10 s, database query → 5 s. Anything tighter than 500 ms risks false timeouts under normal load spikes. Anything looser than 30 s means a failing dependency holds a request open for half a minute.

**Different timeouts for different operations.** Read operations (GET) can tolerate shorter timeouts than write operations (POST/PUT) because writes may need time to persist. Search endpoints that fan out to multiple indices may need longer timeouts than point-lookup endpoints. Set these per call-site, not globally.

## Retry with backoff + jitter

Retries are appropriate for transient failures: network timeouts, 503 Service Unavailable, 429 Too Many Requests, and 408 Request Timeout. They are not appropriate for client errors (400, 401, 403, 404, 422) — these will not succeed on retry and burning quota attempting them is wasteful.

The canonical implementation uses exponential backoff with **full jitter** (randomize the entire delay, not just a fraction of it):

```typescript
export type RetryOptions = {
  maxAttempts:  number;  // total attempts including the first
  baseDelayMs:  number;  // starting delay before the second attempt
  maxDelayMs:   number;  // cap to prevent multi-minute waits
  retryOn:      (err: unknown) => boolean;
};

export async function retryWithBackoff<T>(
  fn:      () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { maxAttempts, baseDelayMs, maxDelayMs, retryOn } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const isLast = attempt === maxAttempts;
      if (isLast || !retryOn(err)) throw err;

      // Full jitter: delay is random in [0, min(cap, base * 2^attempt)]
      const exponentialCap = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const jitteredDelay  = Math.random() * exponentialCap;

      await sleep(jitteredDelay);
    }
  }

  throw lastError; // unreachable, but satisfies the type checker
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Determine retryability from the error type
export function isRetryableHttpError(err: unknown): boolean {
  if (err instanceof TimeoutError)   return true;
  if (err instanceof UpstreamError)  return err.status === 429 || err.status === 503 || err.status === 408;
  if (err instanceof TypeError)      return true;  // fetch network failure
  return false;
}
```

**Why full jitter beats equal jitter.** Equal jitter adds a random fraction to the exponential base (`base + rand * base`). Full jitter samples uniformly between zero and the cap. At high concurrency, equal jitter still clusters many retries near `base`. Full jitter maximally desynchronizes them. AWS's "Exponential Backoff And Jitter" blog post (2015) remains the definitive reference.

**Respecting `Retry-After`.** When a 429 response carries a `Retry-After` header (seconds or HTTP-date), use that value as the delay instead of the computed backoff. Ignoring it wastes your rate-limit budget on retries that will also be rejected.

**Idempotency and retries.** Retries are only safe when the operation is idempotent or when the side effect has not yet occurred. For external POSTs, attach an idempotency key (see the next section) before retrying. For database writes, rely on `ON CONFLICT DO NOTHING` or `upsert`. Never retry a non-idempotent operation without an idempotency mechanism.

## Idempotency in external POSTs

When a POST request times out or the connection drops, the server may or may not have processed it. Retrying without an idempotency key risks executing the side effect twice: charging the card, sending the email, creating the record. An idempotency key is a client-generated stable identifier for the logical operation that the server uses to deduplicate.

```typescript
import { randomUUID } from 'crypto';

// Generate once per logical operation; reuse across retries for the same operation
export function createIdempotencyKey(): string {
  return randomUUID();
}

async function chargePayment(
  customerId:     string,
  amountCents:    number,
  idempotencyKey: string,  // caller generates this before entering the retry loop
): Promise<PaymentResult> {
  const response = await fetchWithTimeout('https://payments.internal/charges', {
    method:    'POST',
    timeoutMs: 10_000,
    headers: {
      'Content-Type':   'application/json',
      'Idempotency-Key': idempotencyKey,       // standard header name; also 'X-Idempotency-Key'
    },
    body: JSON.stringify({ customerId, amountCents }),
  });

  return response.json() as Promise<PaymentResult>;
}

// At the call site — idempotency key is created before the retry loop
const key = createIdempotencyKey();
const result = await retryWithBackoff(
  () => chargePayment(customerId, amount, key),
  { maxAttempts: 3, baseDelayMs: 200, maxDelayMs: 5_000, retryOn: isRetryableHttpError },
);
```

The key must be **stable across retries** for the same logical operation and **unique across different operations**. A UUID generated once before the retry loop satisfies both requirements. A UUID generated fresh inside `fn` would be different on each attempt, defeating deduplication entirely.

**Server-side contract.** Relying on idempotency keys requires server support. Before integrating, verify that the target service documents idempotency key semantics: which endpoints support it, how long keys are retained, and whether a key collision between different operations returns an error or silently reuses the stored result. Stripe, Braintree, and most modern payment processors offer this. Internal services that do not support it must be made idempotent at the database layer (unique constraint, conditional write) before wrapping in a retry loop.

**Key scope and TTL.** Keys are scoped to a single operation type — a key used for a charge should not be reused for a refund of the same amount. Most servers expire keys after 24 hours to 7 days. If a user explicitly requests the same operation again (e.g., submits the form a second time), generate a new key.

## Circuit breakers

A circuit breaker is a proxy that tracks the failure rate of a downstream dependency and stops forwarding calls when the failure rate crosses a threshold, giving the dependency time to recover. In the open state, calls fast-fail (typically in under 1 ms) rather than waiting out the timeout. After a reset interval, the breaker transitions to half-open and allows a probe request through; if it succeeds, the circuit closes.

The three states — closed, open, half-open — map directly to the dependency's health:

- **Closed:** normal operation; all calls are forwarded; failures are counted.
- **Open:** dependency is unhealthy; all calls fast-fail with the fallback; no load is sent.
- **Half-open:** a single probe call is allowed; success → closed; failure → open again.

**Using opossum (Node.js):**

```typescript
import CircuitBreaker from 'opossum';

// Wrap the raw function (not the module export — the breaker IS the export)
async function rawCallInventoryService(skuId: string): Promise<number> {
  const res = await fetchWithTimeout(`https://inventory.internal/sku/${skuId}/stock`, {
    timeoutMs: 3_000,
  });
  return res.json();
}

export const inventoryBreaker = new CircuitBreaker(rawCallInventoryService, {
  timeout:                  3_000,   // treat calls taking longer as failures
  errorThresholdPercentage: 50,      // open after 50% of calls fail in the rolling window
  resetTimeout:             15_000,  // try half-open after 15s
  volumeThreshold:          5,       // need at least 5 calls before the %threshold matters
});

// Fallback: return 0 (treat item as out-of-stock) instead of propagating the error
inventoryBreaker.fallback((_skuId: string) => 0);

// Observe state transitions for alerting
inventoryBreaker.on('open',     () => logger.warn('inventory circuit opened'));
inventoryBreaker.on('halfOpen', () => logger.info('inventory circuit half-open probe'));
inventoryBreaker.on('close',    () => logger.info('inventory circuit closed — recovered'));
```

**Inline circuit breaker without a library.** For environments where adding a dependency is not possible, a minimal state-machine circuit breaker can be implemented inline:

```typescript
type BreakerState = 'closed' | 'open' | 'half-open';

class SimpleCircuitBreaker {
  private state:         BreakerState = 'closed';
  private failureCount:  number = 0;
  private nextAttemptAt: number = 0;

  constructor(
    private readonly threshold:    number,  // failures before opening
    private readonly resetTimeout: number,  // ms before trying half-open
  ) {}

  async fire<T>(fn: () => Promise<T>, fallback: () => T): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() < this.nextAttemptAt) return fallback();
      this.state = 'half-open';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      return fallback();
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state        = 'closed';
  }

  private onFailure(): void {
    this.failureCount++;
    if (this.state === 'half-open' || this.failureCount >= this.threshold) {
      this.state         = 'open';
      this.nextAttemptAt = Date.now() + this.resetTimeout;
    }
  }
}
```

**Circuit breaker placement.** One breaker instance per downstream dependency, not per call site. If three features call the same CRM service, they should share one breaker so that failures observed by one feature count toward opening the circuit for all three. A per-call-site breaker requires 100% failure rate in *that call site alone* to trip — too slow.

**Fallbacks.** Every circuit breaker must have a fallback. Common patterns: return a cached value, return a safe default (empty list, zero stock, "unknown" label), or render a degraded UI state. If no meaningful fallback exists, the fallback should throw a typed `CircuitOpenError` rather than returning incorrect data silently.

## React error boundaries

React renders synchronously; an unhandled `throw` during render, `useLayoutEffect`, or a lifecycle method unwinds the component tree to the nearest error boundary class component. Without a boundary, the throw propagates to the React root, which unmounts the entire application and renders nothing.

**Class component boundary (required by React):**

```tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  fallback: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  children: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
    // Log to your error tracking service (Sentry, Datadog, etc.)
    reportError(error, { componentStack: info.componentStack });
  }

  reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    if (this.state.error) {
      const { fallback } = this.props;
      return typeof fallback === 'function'
        ? fallback(this.state.error, this.reset)
        : fallback;
    }
    return this.props.children;
  }
}
```

**Using `react-error-boundary` library (recommended for new code):**

```tsx
import { ErrorBoundary, useErrorBoundary } from 'react-error-boundary';

// Feature-level fallback with retry
function RecommendationError({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div role="alert">
      <p>Recommendations are temporarily unavailable.</p>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

// Wrap each independent feature surface — not the entire app
export function RecommendationPanel() {
  return (
    <ErrorBoundary FallbackComponent={RecommendationError} onError={reportError}>
      <RecommendationContent />
    </ErrorBoundary>
  );
}

// Inside deeply nested components: throw to the nearest boundary
function RecommendationContent() {
  const { showBoundary } = useErrorBoundary();

  async function load() {
    try {
      await fetchRecommendations();
    } catch (err) {
      showBoundary(err);  // triggers the nearest ErrorBoundary fallback
    }
  }
  // ...
}
```

**Boundaries do not catch async errors.** An `async` function that throws outside of a React lifecycle (e.g., inside a `useEffect` callback that is not awaited properly) will not be caught by an error boundary. Use `useErrorBoundary().showBoundary(err)` to route async errors to the nearest boundary. Alternatively, set the component state to an error value and render the fallback from within `render`.

**Granularity guidance.** Place a boundary at each independent feature surface: a feed, a sidebar widget, a modal, a form. Do not place one at every leaf component — that is excessive and hides aggregate failures. Do not rely on a single root boundary — that blanks the entire page on any component error. A practical rule: if the feature can meaningfully degrade without breaking the core page flow, it gets its own boundary.

## Typed errors (Result vs exception hierarchy)

Two complementary patterns cover the full spectrum of failure modes.

**`Result<T, E>` for recoverable, expected failures.** Business rules that fail, not-found lookups, validation errors, and quota exhaustion are all outcomes the caller can and should handle. Returning `Result` makes every failure case part of the function signature — callers cannot accidentally ignore them.

```typescript
// Define the type once; import it everywhere
type Result<T, E> =
  | { ok: true;  value: T }
  | { ok: false; error: E };

// Error union for this specific function
type FetchProductError =
  | { code: 'NOT_FOUND';       productId: string }
  | { code: 'UPSTREAM_ERROR';  status: number }
  | { code: 'NETWORK_TIMEOUT' };

async function fetchProduct(productId: string): Promise<Result<Product, FetchProductError>> {
  try {
    const res = await fetchWithTimeout(`/products/${productId}`, { timeoutMs: 5_000 });
    if (res.status === 404) return { ok: false, error: { code: 'NOT_FOUND', productId } };
    if (!res.ok)            return { ok: false, error: { code: 'UPSTREAM_ERROR', status: res.status } };
    return { ok: true, value: await res.json() };
  } catch (err) {
    if (err instanceof TimeoutError) return { ok: false, error: { code: 'NETWORK_TIMEOUT' } };
    throw err;  // unexpected — let it propagate as an exception
  }
}

// Call site — TypeScript forces handling both branches
const result = await fetchProduct(id);
if (!result.ok) {
  switch (result.error.code) {
    case 'NOT_FOUND':      return show404(result.error.productId);
    case 'UPSTREAM_ERROR': return showServiceError(result.error.status);
    case 'NETWORK_TIMEOUT': return showRetryPrompt();
  }
}
const product = result.value;  // narrowed to Product here
```

**Typed exception hierarchy for bugs and unrecoverable states.** Infrastructure outages, programming errors, and precondition violations that indicate a bug in the caller are better modelled as typed exceptions. They propagate naturally without requiring every intermediate function to relay the `Result`:

```typescript
export class AppError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class TimeoutError    extends AppError { constructor(msg: string) { super(msg, 'TIMEOUT'); } }
export class UpstreamError   extends AppError { constructor(readonly status: number, url: string) { super(`Upstream ${status} from ${url}`, 'UPSTREAM_ERROR'); } }
export class CircuitOpenError extends AppError { constructor(dep: string) { super(`Circuit open for ${dep}`, 'CIRCUIT_OPEN'); } }

// Always narrow in catch blocks — never access .message on unknown directly
function handleError(err: unknown): void {
  if (err instanceof TimeoutError)     { logger.warn({ code: err.code }, err.message); return; }
  if (err instanceof UpstreamError)    { logger.error({ code: err.code, status: err.status }, err.message); return; }
  if (err instanceof CircuitOpenError) { logger.warn({ code: err.code }, err.message); return; }
  // Unknown errors re-throw or log at error level
  logger.error({ err }, 'Unexpected error');
  throw err;
}
```

**Choosing between them.** Use `Result` when the caller must handle every failure path and when the failure is a normal (if undesirable) outcome. Use typed exceptions when the failure indicates something the call stack above should handle generically (global error handler, error boundary) rather than at the immediate call site. Mixing both is correct and common: a function returns `Result` for expected failures and throws typed exceptions for unexpected ones, as shown in `fetchProduct` above.

## Graceful degradation patterns

Graceful degradation means the system provides reduced but correct functionality when a dependency is unavailable, rather than failing entirely. The goal is to protect user experience and revenue-critical paths from non-critical dependencies.

**Pattern 1: Cache-and-serve-stale.** Responses from third-party or slow services are cached (Redis, in-memory LRU). When the live call fails or the circuit is open, the cache entry is served even if it is past its TTL. Flag the response as stale if the caller needs to know.

```typescript
async function getProductRating(productId: string): Promise<Rating> {
  const cacheKey  = `rating:${productId}`;
  const cached    = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  try {
    const rating = await ratingsBreaker.fire(productId);
    await redis.set(cacheKey, JSON.stringify(rating), 'EX', 300);  // 5-min TTL
    return rating;
  } catch {
    // Circuit open or call failed — return a safe default
    return { average: null, count: 0, stale: true };
  }
}
```

**Pattern 2: Feature flags as a kill switch.** Wrap integrations that are non-critical to the core flow behind a feature flag. Flipping the flag disables the integration instantly without a deploy. This is especially valuable for new integrations that haven't been battle-tested in production.

```typescript
async function enrichOrderWithLoyaltyPoints(order: Order): Promise<Order> {
  if (!featureFlags.isEnabled('loyalty-points-enrichment')) {
    return order;  // skip gracefully — flag off means integration is disabled
  }
  try {
    const points = await loyaltyBreaker.fire(order.customerId);
    return { ...order, loyaltyPoints: points };
  } catch {
    return order;  // degrade: order without loyalty points is still a valid order
  }
}
```

**Pattern 3: Partial response.** An API that aggregates data from multiple sources should return the data it has and mark missing sections, rather than failing the entire response because one upstream is down. Use `null`, an empty array, or a typed sentinel to indicate missing sections.

```typescript
type DashboardData = {
  orders:       Order[];
  loyalty:      LoyaltyInfo | null;  // null = unavailable, not an error
  recommendations: Product[];        // empty array = unavailable
};

async function getDashboard(userId: string): Promise<DashboardData> {
  const [orders, loyalty, recommendations] = await Promise.allSettled([
    fetchOrders(userId),
    fetchLoyalty(userId),
    fetchRecommendations(userId),
  ]);

  return {
    orders:          orders.status      === 'fulfilled' ? orders.value      : [],
    loyalty:         loyalty.status     === 'fulfilled' ? loyalty.value     : null,
    recommendations: recommendations.status === 'fulfilled' ? recommendations.value : [],
  };
}
```

`Promise.allSettled` is the correct primitive here — unlike `Promise.all`, it does not short-circuit on the first rejection. Each call can fail independently without taking down the others.

**Pattern 4: Read-only mode.** When write dependencies (database primary, payment processor) are unavailable, shift the application to a read-only state: present cached content, disable mutating operations with a clear UI indication, and queue mutations for later processing. This is higher complexity but appropriate for applications where revenue continuity during write outages matters.

## Interactions with other skills

- **Owns:** in-process resilience patterns — timeouts, retry, circuit breakers, error boundaries, typed errors, and graceful degradation for application code.
- **Hands off to:** `queue-and-retry-safety` for queue-level retry semantics and at-least-once delivery; `observability-first-debugging` for what and how to log when failures occur and how to trace them; `integration-contract-safety` for how the upstream's contract (schema, versioning, SLA) shapes the retry and timeout strategy.
- **Does not duplicate:** `frontend-implementation-guard`'s component structure rules, or `queue-and-retry-safety`'s DLQ and visibility-timeout patterns.

## Review checklist

Produce a markdown report with these sections:

1. **Summary** — one line: pass / concerns / blocking issues.
2. **External call inventory** — for each network call: file:line, has timeout (yes/no), has retry (yes/no), idempotency key present for POSTs (yes/no/N/A).
3. **Findings** — per issue: *File:line, severity (low/med/high), rule violated, what's wrong, recommended fix*.
4. **Checklist coverage** — for each of the 8 core rules, mark: PASS / CONCERN / NOT APPLICABLE.
   - Rule 1: Every network call has an explicit timeout
   - Rule 2: Retries use exponential backoff with jitter, max-attempts cap, and correct retryability check
   - Rule 3: External POSTs include a stable idempotency key
   - Rule 4: Third-party integrations sit behind a circuit breaker with a fallback
   - Rule 5: React error boundaries wrap individual feature surfaces
   - Rule 6: Errors are typed; `catch (e: unknown)` narrows before access
   - Rule 7: User-facing messages are actionable and leak no internals
   - Rule 8: No fire-and-forget promises; all background work has a supervisor
