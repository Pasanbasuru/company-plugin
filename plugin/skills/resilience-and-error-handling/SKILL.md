---
name: resilience-and-error-handling
description: Use when code calls a network service, handles an error, sets a timeout, implements a retry, or exposes a user-facing failure path. Do NOT use for queue-specific retry semantics (use `queue-and-retry-safety`). Covers timeouts, retry with jitter, circuit breakers, error boundaries, idempotency of external calls, graceful degradation, typed errors.
allowed-tools: Read, Grep, Glob, Bash
---

# Resilience and error handling

## Purpose & scope

Software fails — networks partition, third-party services degrade, tail latency is always worse than median. Code that assumes the happy path breaks users. This skill prescribes the patterns that make code fail *well*: bounded waits, safe retries, fast-fail under load, isolated failure surfaces, and typed error contracts that force callers to handle every outcome. Apply whenever you touch a `fetch` call, HTTP client, SDK integration, `try/catch`, a React component that can throw, or any function returning recoverable failure.

## Assumes `baseline-standards`. Adds:

In-process resilience patterns — explicit timeouts, exponential backoff with jitter, idempotency keys for external POSTs, circuit breakers with fallbacks, React error boundaries, typed error contracts, and graceful degradation strategies.

## Core rules

1. **Every network call has an explicit timeout.** No call uses the default (infinite) timeout. — *Why:* a slow upstream exhausts the thread pool, connection pool, or Lambda concurrency, turning a partial outage into a total one.
2. **Retries use exponential backoff with full jitter, a max-attempts cap, and a max-delay cap. Not all errors are retryable — 4xx (except 408 and 429) are not.** — *Why:* fixed-interval retries produce thundering herds; jitter spreads load. Retrying a 400 wastes quota; retrying a 503 is correct.
3. **External POSTs include an idempotency key so a retry does not duplicate the side effect.** Stable across retries for the same logical op. — *Why:* a POST timeout may mean the server processed the request before the connection dropped; retrying without a key charges twice or creates duplicates.
4. **Third-party integrations sit behind a circuit breaker. When open, calls fast-fail with a fallback or a user-visible degraded state.** — *Why:* without a breaker, every call to a failed integration pays the full timeout cost, filling the event loop and degrading every feature, not just the one using the broken integration.
5. **React error boundaries wrap individual feature surfaces. A crashed feature does not crash the page or the app.** — *Why:* an unguarded `throw` unmounts the entire tree above. Feature-level boundaries contain the blast radius and allow per-feature recovery UI.
6. **Errors are typed — `Result<T, E>` for recoverable failures or a typed exception hierarchy for bugs. `catch (e: unknown)` always narrows before accessing properties.** — *Why:* untyped catches hide failures; typed errors force callers to handle every outcome; narrowing prevents `Cannot read properties of undefined` crashes inside error handlers.
7. **User-facing error messages are actionable and never leak internals.** Tell users what to do ("Try again", "Contact support with ref XYZ"). Stack traces, DB errors, service names never reach the browser. — *Why:* leaked internals are an information-disclosure vulnerability and a poor user experience.
8. **Background work has a supervisor or lifecycle owner — no fire-and-forget promises.** `void someAsyncFn()` is banned. `await`, attach `.catch` with structured logging, or enqueue via a durable mechanism. — *Why:* unhandled promise rejections terminate newer Node runtimes; silently swallowed failures look like success to monitoring.

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

Bad — one root boundary blanks the page on any crash: `<ErrorBoundary fallback={<p>Something went wrong</p>}>{Header, MainContent, RecommendationPanel, Footer}</ErrorBoundary>`.

Good — each independent feature wraps its own boundary so failures are isolated:

```tsx
import { ErrorBoundary } from 'react-error-boundary';

function App() {
  return (
    <>
      <Header />
      <ErrorBoundary fallback={<MainContentError />}><MainContent /></ErrorBoundary>
      <ErrorBoundary fallback={<RecommendationFallback />}><RecommendationPanel /></ErrorBoundary>
      <Footer />
    </>
  );
}
```

## Timeouts

Every call to an external system needs a finite timeout — explicitly set, never SDK defaults. "External" = HTTP, gRPC, DB queries, Redis, S3, DNS. Canonical Node/browser pattern uses `AbortController`:

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

`AbortSignal.timeout(ms)` (Node 17.3+) is a shorthand but doesn't cancel the timer, so explicit `AbortController` is clearer in long-lived server code. Always `clearTimeout` in `finally`.

**Choosing values.** Timeout must be below the caller's, minus processing overhead. Typical layering: API gateway 30 s, service-to-service 10 s, DB query 5 s. < 500 ms risks false timeouts; > 30 s ties up requests too long. Set per call-site; reads can tolerate shorter than writes; fan-out endpoints need longer than point-lookups.

## Retry with backoff + jitter

Retries fit transient failures (network timeouts, 503, 429, 408) — not client errors (400, 401, 403, 404, 422). Canonical implementation: exponential backoff with **full jitter** (randomize the entire delay, not just a fraction):

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

**Full jitter beats equal jitter** — equal jitter (`base + rand * base`) still clusters retries near `base` at high concurrency; full jitter samples uniformly in `[0, cap]`, maximally desynchronising. (AWS "Exponential Backoff And Jitter", 2015.)

**Respect `Retry-After`.** Use the header value as the delay when a 429 carries one; ignoring it wastes rate-limit budget.

**Idempotency is a precondition for retries.** POSTs need an idempotency key (next section); DB writes rely on `ON CONFLICT DO NOTHING` or `upsert`. Never retry a non-idempotent op without an idempotency mechanism.

## Idempotency in external POSTs

A POST timeout may mean the server processed the request before the connection dropped. An idempotency key is a client-generated stable identifier the server uses to deduplicate retries — preventing double charges, duplicate emails, duplicate records.

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

The key must be **stable across retries** for the same logical op and **unique across different ops**. A UUID generated once before the retry loop satisfies both; one generated inside `fn` defeats deduplication.

**Server-side contract.** Requires server support — verify the target service documents semantics (supported endpoints, retention, collision behaviour). Stripe, Braintree, most modern payment processors offer this. Internal services without it must be made idempotent at the DB layer (unique constraint, conditional write) before wrapping in a retry loop.

**Scope and TTL.** Keys are scoped to a single op type (don't reuse a charge key for a refund). Servers typically expire keys after 24 h – 7 d. If a user explicitly re-submits, generate a new key.

## Circuit breakers

A circuit breaker tracks failure rate and stops forwarding calls when the rate crosses a threshold, letting the dependency recover. Three states:

- **Closed:** normal; forward all; count failures.
- **Open:** fast-fail via fallback; no load sent; wait for reset interval.
- **Half-open:** one probe allowed; success → closed; failure → open.

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

**Inline without a library.** A minimal state-machine (closed/open/half-open) tracks `failureCount` and `nextAttemptAt`; on `fire`, skip to fallback if `open && now < nextAttemptAt`, otherwise try and update state on success/failure. Use opossum in production — the inline pattern is only for dependency-restricted environments.

**Placement.** One breaker per dependency, not per call site — features sharing a dependency share a breaker so failures observed by any feature count toward tripping. Per-call-site breakers trip too slowly.

**Fallbacks.** Every breaker must have one: cached value, safe default (empty list, zero stock, "unknown"), or degraded UI. If no meaningful fallback exists, throw a typed `CircuitOpenError` rather than returning incorrect data silently.

## React error boundaries

React renders synchronously; an unhandled `throw` during render or a lifecycle method unwinds the tree to the nearest class-based boundary. Without one, the throw propagates to the root, which unmounts the entire app.

React requires the boundary to be a class (`getDerivedStateFromError` + `componentDidCatch`); use the `react-error-boundary` library rather than hand-rolling:

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

**Boundaries don't catch async errors.** Throws inside `useEffect` callbacks or unhandled async flows bypass boundaries. Use `useErrorBoundary().showBoundary(err)` or set component state to an error value and render the fallback.

**Granularity.** One boundary per independent feature surface (feed, sidebar widget, modal, form). Not at every leaf (hides aggregate failures), not only at root (blanks the page on any error). Rule: if the feature can meaningfully degrade without breaking core page flow, it gets its own boundary.

## Typed errors (Result vs exception hierarchy)

Two complementary patterns.

**`Result<T, E>` for recoverable, expected failures** — business rule failures, not-found lookups, validation errors, quota exhaustion. Returning `Result` makes every failure case part of the signature so callers can't ignore them.

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
    throw err;  // unexpected — let it propagate
  }
}
// Call site: `if (!result.ok) switch (result.error.code) { ... }` — TS narrows `result.value` to Product on the happy path.
```

**Typed exception hierarchy for bugs and unrecoverable states.** Infrastructure outages, programming errors, precondition violations. They propagate naturally without requiring every intermediate function to relay a `Result`:

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

**Choosing.** `Result` when the caller must handle every path and failure is a normal outcome. Typed exceptions when the call stack above should handle it generically (global handler, error boundary). Mixing is correct and common — `fetchProduct` above returns `Result` for expected failures, throws for unexpected ones.

## Graceful degradation patterns

Reduced but correct functionality when a dependency is unavailable — protecting user experience and revenue-critical paths from non-critical dependencies.

**Pattern 1: Cache-and-serve-stale.** Cache third-party/slow responses (Redis, in-memory LRU). When the live call fails or the circuit is open, serve the cache entry even past TTL. Flag stale if callers need to know.

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

**Pattern 2: Feature flags as a kill switch.** Wrap non-critical integrations behind a flag: `if (!flags.isEnabled('loyalty-enrichment')) return order;` disables them without a deploy — valuable for new, unbattle-tested integrations. On breaker open, return the un-enriched value and continue.

**Pattern 3: Partial response.** An API aggregating multiple sources returns what it has and marks missing sections (`null`, empty array, typed sentinel) rather than failing the entire response because one upstream is down.

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

`Promise.allSettled` (not `Promise.all`) is the right primitive — no short-circuit on first rejection.

**Pattern 4: Read-only mode.** When write dependencies (DB primary, payment processor) are unavailable, shift the app read-only: present cached content, disable mutations with UI indication, queue mutations for later. Higher complexity, appropriate where revenue continuity during write outages matters.

## Interactions with other skills

- **Owns:** in-process resilience — timeouts, retry, circuit breakers, error boundaries, typed errors, graceful degradation.
- **Hands off to:** `queue-and-retry-safety` (queue-level retry, at-least-once delivery); `observability-first-debugging` (what/how to log failures and trace them); `integration-contract-safety` (how upstream contracts shape retry/timeout strategy).
- **Does not duplicate:** `frontend-implementation-guard` (component structure); `queue-and-retry-safety` (DLQ, visibility timeout).

## Review checklist

Produce a markdown report with these sections:

1. **Summary** — one line: pass / concerns / blocking issues.
2. **External call inventory** — for each network call: file:line, has timeout (yes/no), has retry (yes/no), idempotency key present for POSTs (yes/no/N/A).
3. **Findings** — per issue: *File:line, severity (blocking | concern | info), rule violated, what's wrong, recommended fix*.
4. **Safer alternative** — for each finding, propose a resilience-specific safer path rather than just "add a try/catch." Examples: prefer circuit breakers with fallback values over unbounded retries for 3rd-party API hiccups; prefer explicit timeout + graceful-degradation handler over fail-open defaults; prefer typed error hierarchies with narrowed `catch (e: unknown)` over stringly-typed `error.message` checks; prefer a supervised background task (AbortController + logged failure) over fire-and-forget `void promise`; prefer an idempotency-key-guarded retry over at-most-once POSTs that silently double-charge on transient 5xx.
5. **Checklist coverage** — for each of the 8 core rules, mark: PASS / CONCERN / NOT APPLICABLE.
   - Rule 1: Every network call has an explicit timeout
   - Rule 2: Retries use exponential backoff with jitter, max-attempts cap, and correct retryability check
   - Rule 3: External POSTs include a stable idempotency key
   - Rule 4: Third-party integrations sit behind a circuit breaker with a fallback
   - Rule 5: React error boundaries wrap individual feature surfaces
   - Rule 6: Errors are typed; `catch (e: unknown)` narrows before access
   - Rule 7: User-facing messages are actionable and leak no internals
   - Rule 8: No fire-and-forget promises; all background work has a supervisor
