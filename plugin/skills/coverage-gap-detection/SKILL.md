---
name: coverage-gap-detection
description: Use when asked "are we testing the right things" or after a feature is complete but before merge, to find critical untested paths. Do NOT use for test authoring patterns (use `test-strategy-enforcement`). Covers critical-path identification, missing negative tests, untested error branches, edge-case discovery.
---

Coverage % lies. This skill finds the paths that *should* have tests and don't.

## Core rules

1. **Critical paths have integration tests, not just unit tests.**
   Every auth flow, payment step, and data mutation with financial or legal impact must have an integration-level test that exercises the real stack, not a mocked double.
   *Why:* Unit tests on individual functions miss the wiring. A mutation that passes unit tests can still silently corrupt data when the transaction boundary is wrong.

2. **Every `catch` branch and every error return has at least one test.**
   Scan every `try/catch`, every `if (error)`, every rejected promise, and every function that returns `{ ok: false }` or throws. Each path needs a test that reaches it.
   *Why:* Error branches are the most common site of production bugs. They are also the branches least likely to be exercised by a happy-path test suite.

3. **Every authorization decision has a "denied" test as well as a "permitted" test.**
   If the code checks `user.role === 'admin'` or calls `can(user, 'edit', resource)`, there must be a test for the case where the check fails.
   *Why:* A guard that was never tested for the denied path may have always evaluated to `true`. The happy path cannot prove the guard works.

4. **Input validation is tested at the boundary — not just valid mid-range inputs.**
   For every validated field: empty string, null/undefined, maximum-length string, unicode surrogates, negative numbers, zero, and the exact boundary values the schema defines.
   *Why:* Validators routinely have off-by-one errors, encoding blind spots, and missing null guards. Mid-range inputs never find these.

5. **Time-sensitive logic has tests at the boundary times.**
   If code checks `now > expiresAt`, `isExpired(token)`, `deadline.isBefore(now)`, or any TTL comparison, tests must cover exactly-expired, one-second-before-expiry, and one-second-after-expiry.
   *Why:* Mid-range time values give false confidence. The bug lives at the boundary.

6. **Concurrency-sensitive logic has a concurrent test or a documented justification for skipping it.**
   Transactions, optimistic-lock patterns, idempotency keys, and queued jobs that must not run twice all qualify. If a concurrent test is impractical, a code comment must explain the invariant and how it is enforced elsewhere.
   *Why:* Race conditions are invisible to single-threaded tests. Without at least one concurrent scenario, the invariant is untested by definition.

7. **UI empty state, loading state, and error state all have rendering tests.**
   Every component that conditionally renders a spinner, an empty-list message, or an error banner must have a test for each of those branches.
   *Why:* UI branches are as real as logic branches. A component that crashes on an empty array will do so in production, not in the happy-path snapshot test.

---

## Red flags

| Signal | Problem |
|---|---|
| "Coverage is 90%, we're good" | Line coverage does not distinguish critical paths from trivial getters. A 90% score with zero auth-denial tests is not good coverage. |
| "Happy path only, ship it" | Production is not the happy path. The first real user will hit an edge case or an error the suite never saw. |
| "We don't test errors, it's too hard to simulate" | Errors are where bugs live and where incident postmortems point. Difficulty is not justification; it is a smell that the code is hard to test by design. |

---

## Good vs bad

### Happy + denied + invalid-input trio vs happy-only

**Bad — happy path only:**

```ts
// Only the success case is covered. The guard and the validator are untested.
it('returns the resource when the user is permitted', async () => {
  const user = createUser({ role: 'admin' });
  const result = await getResource(user, 'resource-1');
  expect(result.id).toBe('resource-1');
});
```

**Good — happy, denied, and invalid-input trio:**

```ts
it('returns the resource when the user is permitted', async () => {
  const user = createUser({ role: 'admin' });
  const result = await getResource(user, 'resource-1');
  expect(result.id).toBe('resource-1');
});

it('throws Forbidden when the user lacks permission', async () => {
  const user = createUser({ role: 'viewer' });
  await expect(getResource(user, 'resource-1')).rejects.toThrow('Forbidden');
});

it('throws NotFound for a non-existent resource id', async () => {
  const user = createUser({ role: 'admin' });
  await expect(getResource(user, '')).rejects.toThrow('NotFound');
});

it('throws ValidationError for a null resource id', async () => {
  const user = createUser({ role: 'admin' });
  // @ts-expect-error — deliberately passing wrong type to test runtime guard
  await expect(getResource(user, null)).rejects.toThrow('ValidationError');
});
```

### Boundary-time assertion vs mid-range-only assertion

**Bad — only mid-range time tested:**

```ts
it('treats a token valid for 10 more minutes as active', () => {
  const token = createToken({ expiresAt: addMinutes(new Date(), 10) });
  expect(isTokenActive(token)).toBe(true);
});
```

**Good — boundary times covered:**

```ts
it('treats a token expiring in the future as active', () => {
  const token = createToken({ expiresAt: addSeconds(new Date(), 1) });
  expect(isTokenActive(token)).toBe(true);
});

it('treats a token expiring exactly now as inactive', () => {
  vi.useFakeTimers();
  const now = new Date('2026-01-01T12:00:00Z');
  vi.setSystemTime(now);
  const token = createToken({ expiresAt: now });
  expect(isTokenActive(token)).toBe(false);
  vi.useRealTimers();
});

it('treats an already-expired token as inactive', () => {
  const token = createToken({ expiresAt: subSeconds(new Date(), 1) });
  expect(isTokenActive(token)).toBe(false);
});
```

---

## Critical-path checklist

1. **Identify the critical paths in the change.** "this PR changes the subscription-upgrade flow, which writes to `subscriptions`, fires a webhook to Stripe, and sends a confirmation email."
2. **For each path, verify there is an integration test.** Real DB write (or transaction-rolled-back), real HTTP to a test double, real template render.
3. **Verify the failure path for each step.** What happens if the DB write succeeds but the webhook call fails? Is that tested? What happens if the email render throws?
4. **Check transaction boundaries.** If the path writes to more than one table or calls more than one external service, verify that partial failure leaves the system in a consistent state and that this is tested.
5. **Check idempotency.** If the operation can be retried (e.g., via a queue), verify that running it twice is safe and that this is tested.

---

## Negative-case discovery heuristics

| Heuristic | What to check |
|---|---|
| Scan for decision points | Every `if`, `switch`, `?.`, `??`, `\|\|`, `&&` is a branch — does the suite exercise both sides? |
| Scan for thrown errors / rejected promises | Each `throw`, `Promise.reject`, `.rejects`, error-typed return is an untested negative case until proven otherwise. |
| What if the input is wrong? | For every parameter and external data source: null, empty, wrong type, out of range, too long. |
| What if the dependency fails? | For every network/DB/SDK call: timeout, 500, malformed payload. |
| What if the user shouldn't do this? | For every action, identify the denied set and verify denial tests exist. |
| Trace errors up the stack | Verify callers surface (not swallow) low-level errors. |

---

## Authorization coverage

**Minimum coverage for any authorization check:**

```ts
describe('deletePost', () => {
  it('allows the post author to delete their own post', async () => {
    const author = await createUser();
    const post = await createPost({ authorId: author.id });
    await expect(deletePost(author, post.id)).resolves.toBeUndefined();
  });

  it('denies a non-author from deleting another user\'s post', async () => {
    const author = await createUser();
    const other = await createUser();
    const post = await createPost({ authorId: author.id });
    await expect(deletePost(other, post.id)).rejects.toThrow('Forbidden');
  });

  it('denies an unauthenticated request', async () => {
    const post = await createPost({});
    // @ts-expect-error — testing null user path
    await expect(deletePost(null, post.id)).rejects.toThrow('Unauthorized');
  });
});
```

For role-based systems, every denied role gets its own test.

Multi-tenant: explicit cross-tenant denial tests.

---

## Empty/loading/error state tests

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PostList } from './PostList';
import { usePosts } from './usePosts';

vi.mock('./usePosts');

describe('PostList', () => {
  it('renders a loading spinner while data is fetching', () => {
    vi.mocked(usePosts).mockReturnValue({ status: 'loading', data: undefined, error: undefined });
    render(<PostList />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders an empty-state message when there are no posts', () => {
    vi.mocked(usePosts).mockReturnValue({ status: 'success', data: [], error: undefined });
    render(<PostList />);
    expect(screen.getByText('No posts yet')).toBeInTheDocument();
  });

  it('renders the post titles when data is loaded', () => {
    vi.mocked(usePosts).mockReturnValue({
      status: 'success',
      data: [{ id: '1', title: 'Hello world' }],
      error: undefined,
    });
    render(<PostList />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders an error message when the query fails', () => {
    vi.mocked(usePosts).mockReturnValue({
      status: 'error',
      data: undefined,
      error: new Error('Network error'),
    });
    render(<PostList />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  });
});
```

Apply the same pattern to server components, suspense boundaries, and conditional UI.

---

## Time and concurrency coverage

**Time boundaries** require fake timers. Use `vi.useFakeTimers()` to pin the clock to a known value, then test one-second-before, exactly-at, and one-second-after each boundary.

```ts
describe('session expiry', () => {
  afterEach(() => vi.useRealTimers());

  it('considers a session valid one second before its expiry', () => {
    vi.useFakeTimers();
    const expiresAt = new Date('2026-06-01T10:00:00Z');
    vi.setSystemTime(new Date('2026-06-01T09:59:59Z'));
    expect(isSessionValid({ expiresAt })).toBe(true);
  });

  it('considers a session expired at exactly its expiry timestamp', () => {
    vi.useFakeTimers();
    const expiresAt = new Date('2026-06-01T10:00:00Z');
    vi.setSystemTime(expiresAt);
    expect(isSessionValid({ expiresAt })).toBe(false);
  });

  it('considers a session expired one second after its expiry', () => {
    vi.useFakeTimers();
    const expiresAt = new Date('2026-06-01T10:00:00Z');
    vi.setSystemTime(new Date('2026-06-01T10:00:01Z'));
    expect(isSessionValid({ expiresAt })).toBe(false);
  });
});
```

**Concurrency** is harder to test deterministically. The most practical approach is to fire two operations simultaneously and assert the outcome is consistent:

```ts
it('does not double-charge when two checkout requests race', async () => {
  const cart = await createCart({ userId: 'u1', total: 100 });

  // Fire both checkouts at the same instant
  const [result1, result2] = await Promise.allSettled([
    checkout(cart.id),
    checkout(cart.id),
  ]);

  const successes = [result1, result2].filter(r => r.status === 'fulfilled');
  const failures = [result1, result2].filter(r => r.status === 'rejected');

  // Exactly one should succeed; the other should be rejected as a duplicate
  expect(successes).toHaveLength(1);
  expect(failures).toHaveLength(1);

  const charges = await getChargesForCart(cart.id);
  expect(charges).toHaveLength(1);
});
```

If a concurrent test is impractical, document the invariant + production monitoring in a code comment on the function.

---

## Interactions with other skills

- **Owns:** gap-finding for existing code.
- **REQUIRED SUB-SKILL:** `global-plugin:test-strategy-enforcement` — coverage decisions only make sense through the strategy lens (which layer owns which test); consult it to translate every CONCERN into the correct test shape.
- **Hands off to:** `change-risk-evaluation` for blocker-level coverage gaps — when a gap touches a critical path (auth, payment, data mutation) and must block merge.
- **Does not duplicate:** line-coverage tooling (`vitest --coverage`). High line coverage is a prerequisite, not a substitute, for the analysis this skill performs.

---

## Review checklist

When invoked in review mode, produce a markdown report with exactly these four sections.

### Summary

One line stating whether coverage is adequate for merge, and the count of CONCERN-level gaps.

### Findings

One bullet per gap, in the form:
`<file>:<line> — <severity: blocker | concern | nit> — <category: critical-path | error-branch | authz | boundary-input | boundary-time | concurrency | ui-state> — <fix: the specific missing test, e.g. it('throws Forbidden when a viewer calls deletePost', ...)>`

A finding without a named test is not actionable — rewrite it until the `it(...)` string is concrete.

### Safer alternative

Coverage-specific alternatives the reviewer should recommend when they spot the pattern:
- Prefer **property-based tests** (fast-check, fuzzing) for business-rule coverage over snapshot tests that only pin today's output.
- Prefer **integration tests against a real Postgres** for repository code over mocked unit tests that cannot catch wiring or transaction-boundary bugs.
- Prefer **boundary-value tables** (empty, null, max-length, exact-boundary) driven by `it.each` over a single mid-range happy-path assertion.
- Prefer **fake-timer boundary tests** (one-second-before, at, one-second-after) over mid-range time assertions that hide off-by-one bugs.

### Checklist coverage

Map each of the 7 Core rules to `PASS / CONCERN / NOT APPLICABLE`. Every row must be filled.

| # | Core rule | Verdict |
|---|---|---|
| 1 | Critical paths have integration tests, not just unit tests | PASS / CONCERN / NOT APPLICABLE |
| 2 | Every `catch` branch and every error return has at least one test | PASS / CONCERN / NOT APPLICABLE |
| 3 | Every authorization decision has a "denied" test as well as a "permitted" test | PASS / CONCERN / NOT APPLICABLE |
| 4 | Input validation is tested at the boundary — not just valid mid-range inputs | PASS / CONCERN / NOT APPLICABLE |
| 5 | Time-sensitive logic has tests at the boundary times | PASS / CONCERN / NOT APPLICABLE |
| 6 | Concurrency-sensitive logic has a concurrent test or a documented justification for skipping it | PASS / CONCERN / NOT APPLICABLE |
| 7 | UI empty state, loading state, and error state all have rendering tests | PASS / CONCERN / NOT APPLICABLE |

Every CONCERN row must correspond to at least one entry in the Findings section.
