---
name: resilience-and-error-handling
description: Use when reviewing or designing code that calls a network service, handles an error, sets a timeout, implements a retry, or exposes a user-facing failure path. Do NOT use for queue-specific retry semantics (use `queue-and-retry-safety`). Covers timeouts, retry with jitter, circuit breakers, error boundaries, idempotency of external calls, graceful degradation, typed errors.
allowed-tools: Read, Grep, Glob, Bash
---

# Resilience and error handling

## Purpose & scope

Networks partition; tail latency dominates. Make code fail well — bounded waits, safe retries, isolated failure surfaces, typed errors. Apply whenever you touch a `fetch` call, HTTP client, SDK integration, `try/catch`, a React component that can throw, or any function returning recoverable failure.

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

Bad — one root boundary, any crash blanks the page: `<ErrorBoundary fallback={<p>Something went wrong</p>}>{Header, MainContent, RecommendationPanel, Footer}</ErrorBoundary>`.

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

For full implementation details (timeout utility, `retryWithBackoff` with full jitter, idempotency key patterns, opossum breaker with state events, `react-error-boundary` with `useErrorBoundary`, `Result<T,E>` type and typed exception hierarchy, graceful degradation patterns), see `references/patterns.md`.

## Interactions with other skills

- **Owns:** in-process resilience — timeouts, retry, circuit breakers, error boundaries, typed errors, graceful degradation.
- **Hands off to:** `queue-and-retry-safety` (queue-level retry, at-least-once delivery); `observability-first-debugging` (what/how to log failures and trace them); `integration-contract-safety` (how upstream contracts shape retry/timeout strategy).
- **Does not duplicate:** `frontend-implementation-guard` (component structure); `queue-and-retry-safety` (DLQ, visibility timeout).

## Review checklist

### Summary

One line: pass / concerns / blocking issues. Name the reviewed surface and the overall verdict in a single sentence.

### Findings

One bullet per finding: `path/to/file.ts:42` — **severity** (blocking | concern | info) — *category* (timeout | retry | idempotency | circuit-breaker | error-boundary | typed-error | user-message | fire-and-forget) — what is wrong, recommended fix. Include the external call inventory (file:line, timeout yes/no, retry yes/no, idempotency key yes/no/N/A) as a table within this section.

### Safer alternative

Resilience-specific safer path for each finding. See `references/review-checklist.md` for the standard safer-alternative text covering unbounded retries, fail-open defaults, stringly-typed error checks, fire-and-forget promises, and at-most-once POSTs.

### Checklist coverage

Mark each of the 8 Core rules PASS / CONCERN / NOT APPLICABLE with a one-line justification. See `references/review-checklist.md` for the full coverage table, required explicit scans, and severity definitions.

---

*For full implementation deep-dives (timeout utility, retryWithBackoff, idempotency key patterns, opossum circuit breaker, React error boundaries, Result type, graceful degradation), see `references/patterns.md`. For the complete PR review checklist with coverage table, required explicit scans, and severity definitions, see `references/review-checklist.md`.*
