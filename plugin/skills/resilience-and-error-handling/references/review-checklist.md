# Resilience and error handling — PR review checklist (full form)

Use this file when producing a complete resilience review report. The lean `SKILL.md` lists only the section headings and shape; this file provides the full checklist coverage table, required explicit scans, and severity definitions.

---

## Review report structure

### Summary

One line: pass / concerns / blocking issues. Name the reviewed surface (service, module, or file set) and the overall verdict in a single sentence so a reader can scan the result without reading further.

### Findings

Start with the **external call inventory**: for each network call found, one table row — `file:line`, has timeout (yes/no), has retry (yes/no), idempotency key present for POSTs (yes/no/N/A). This factual scan precedes interpretation.

Then one bullet per finding, in this shape:

- `path/to/file.ts:42` — **severity** (blocking | concern | info) — *category* (timeout | retry | idempotency | circuit-breaker | error-boundary | typed-error | user-message | fire-and-forget) — what is wrong, recommended fix.

Include concrete file:line references. Identify missing timeouts, bare `catch (e) {}` blocks, fire-and-forget `void somePromise()`, missing error boundaries, and untyped catches where `.message` is accessed on `unknown`.

### Safer alternative

Resilience-specific guidance for the specific risk found. Standard text for common findings:

- **Unbounded retries on third-party API hiccups:** prefer a circuit breaker with a fallback value over retrying indefinitely — an open circuit fast-fails in under 1 ms whereas an unbounded retry loop exhausts connection-pool slots.
- **Fail-open defaults (no timeout, implicit SDK timeout):** prefer an explicit `AbortController` timeout plus a graceful-degradation handler over relying on the SDK or OS default — the default is often 0 (no timeout) or implementation-defined and can silently hold connections indefinitely.
- **Stringly-typed error checks (`error.message.includes(...)`):** prefer a typed error hierarchy with narrowed `catch (e: unknown)` — `instanceof` checks are refactoring-safe and IDE-navigable; string matching breaks silently on message rewording.
- **Fire-and-forget `void promise`:** prefer a supervised background task using `AbortController` + structured logging of rejections — unhandled rejections terminate newer Node runtimes and look like success to monitoring.
- **At-most-once POSTs that silently double-charge on transient 5xx:** prefer an idempotency-key-guarded retry — generate the key once before the retry loop, pass it in the `Idempotency-Key` header on every attempt, and the server deduplicates the side effect.

### Checklist coverage

Mark each Core rule as PASS / CONCERN / NOT APPLICABLE with a short justification. See the full coverage table below.

---

## Checklist coverage table

| # | Rule | Status | Notes |
|---|------|--------|-------|
| 1 | Every network call has an explicit timeout (AbortController or equivalent); no call relies on the SDK or OS default. | PASS / CONCERN / N/A | |
| 2 | Retries use exponential backoff with full jitter, a max-attempts cap, a max-delay cap, and a correct retryability predicate (no retrying 4xx except 408 and 429). | PASS / CONCERN / N/A | |
| 3 | External POSTs include a stable idempotency key generated once before the retry loop and reused across retries for the same logical operation. | PASS / CONCERN / N/A | |
| 4 | Third-party integrations sit behind a circuit breaker; when open the breaker fast-fails with a meaningful fallback or typed `CircuitOpenError` rather than propagating silently. | PASS / CONCERN / N/A | |
| 5 | React error boundaries wrap individual feature surfaces; a crashed feature does not propagate to the app root; async errors use `showBoundary`. | PASS / CONCERN / N/A | |
| 6 | Errors are typed — `Result<T, E>` for recoverable failures or a typed exception hierarchy; `catch (e: unknown)` always narrows before accessing any property. | PASS / CONCERN / N/A | |
| 7 | User-facing error messages are actionable and never leak internals (stack traces, DB errors, service names, internal URLs). | PASS / CONCERN / N/A | |
| 8 | No fire-and-forget promises; every background async operation is awaited, has `.catch` with structured logging attached, or is enqueued via a durable mechanism. | PASS / CONCERN / N/A | |

---

## Required explicit scans

In addition to the rule-by-rule table, every review must explicitly scan for these common failure patterns:

- **Missing timeout** — grep for `fetch(`, `axios.`, `got(`, `request(`, SDK client method calls (e.g., `s3.getObject`, `dynamodb.send`). For each call site, verify a timeout is set explicitly (e.g., `AbortSignal.timeout`, `AbortController`, `timeout:` option, `timeoutMs:` wrapper). Flag any without one.
- **Bare catch swallowing errors** — grep for `catch` blocks that return `null`, `undefined`, or `[] as any` without a typed check. A `catch (e: unknown)` that accesses `e.message` without narrowing is also a finding.
- **Fire-and-forget** — grep for `void ` followed by an async call, and for `.then(` without `.catch(`. Each is a finding unless the promise is from a library that handles its own rejections (e.g., an event emitter that surfaces to `process.on('unhandledRejection')`).
- **Missing circuit breaker** — for calls to third-party APIs, payment processors, CRM systems, and external enrichment services, verify a circuit breaker (opossum or equivalent) wraps the raw call. A service-to-service call behind a mesh sidecar (Envoy, Linkerd) may satisfy this at the infrastructure layer — note that explicitly.
- **Missing error boundary** — for React feature surfaces (feeds, panels, sidebars, modals, forms), grep for `ErrorBoundary` usage. A surface missing a boundary where a crash could blank the whole page is a blocking finding.
- **No idempotency key on retried POSTs** — for every `POST` or mutation call inside a retry loop, verify an idempotency key is generated before the loop, passed with the request, and not regenerated on each attempt.
- **Leaked internals in user-facing responses** — grep for `error.message`, `error.stack`, `err.detail`, service hostnames, and DB error strings in HTTP response bodies or frontend error state. Any of these reaching the browser is a blocking finding.
- **Non-retryable 4xx retried** — verify `retryOn` predicates exclude 400, 401, 403, 404, 422. Retrying these wastes quota, masks bugs, and can cause unintended side effects.

---

## Severity definitions

| Severity | Meaning |
|----------|---------|
| **blocking** | A gap that permits data corruption, double-charging, silent data loss, leaked internals (security), or total page/app crash under normal operating conditions. Must be fixed before merge. |
| **concern** | A pattern that degrades reliability or observability without an immediate correctness or security path — e.g., missing circuit breaker on a non-critical integration, missing timeout on a read-only call, fire-and-forget on a non-critical background log flush. Should be fixed; flag if deferred. |
| **info** | A best-practice gap with no current reliability or security impact — e.g., slightly too-generous timeout values, error boundary placed at a coarser granularity than ideal, `Result` not used where a typed exception would also be acceptable. Address opportunistically. |
