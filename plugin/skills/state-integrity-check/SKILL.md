---
name: state-integrity-check
description: Use when reviewing a change that writes data AND the UI caches or optimistically updates that data, or when cache/invalidation behaviour changes on either side. Do NOT use for pure DB write review (use `prisma-data-access-guard`) or pure UI state shape (use `frontend-implementation-guard`). Covers cache invalidation, optimistic updates, server/client divergence, stale reads.
allowed-tools: Read, Grep, Glob, Bash
---

# State integrity check

## Purpose & scope

Prevent the class of bug where the database says one thing and a user's screen says another — stale caches, missed invalidations, optimistic updates that never reconcile, and server-rendered pages that silently serve day-old data. Apply this skill whenever a mutation, server action, or API route writes data that any TanStack Query cache, Next.js full-route cache, or optimistic UI layer also holds. The goal is a single source of truth: the server's persisted state, reflected accurately and promptly to every connected client.

## Core rules

1. **Every mutation invalidates or updates the specific TanStack Query keys that depend on it — no blind `invalidateQueries()` without a `queryKey` filter.** — *Why:* blanket invalidation refetches every cached query in the application, produces unnecessary network load, and masks the real dependency graph so future regressions go undetected.
2. **Optimistic updates include an `onError` rollback that restores the previous cache snapshot and an `onSettled` refetch that reconciles with server truth.** — *Why:* without rollback, a server rejection leaves the UI permanently diverged from the database until a manual refresh.
3. **Server-returned data is the source of truth after a mutation; the mutation response is used to update the cache directly via `setQueryData` when the server returns the full updated resource.** — *Why:* trusting client-constructed state across a reload produces divergence when the server applies transforms (timestamps, computed fields, triggers) the client did not anticipate.
4. **Next.js server mutations use `revalidatePath` or `revalidateTag` explicitly; no reliance on automatic or time-based revalidation to clear data written by the current action.** — *Why:* `fetch` cache entries and full-route cache segments persist until explicitly purged; a mutation that does not call `revalidate*` will serve stale HTML to the next visitor for the duration of the cache TTL.
5. **Cross-tab synchronisation is explicit via a `BroadcastChannel` or `storage` event when the application has concurrent-tab scenarios and local mutations must reflect in sibling tabs.** — *Why:* TanStack Query's in-memory cache is process-scoped; a write in tab A is invisible to tab B's cache until that tab independently refetches.
6. **Subscription-based state (WebSocket / SSE) includes reconnect-and-replay logic; code never assumes the socket connection has stayed open across a background-tab resume or network interruption.** — *Why:* missed events during a dropped connection produce permanent divergence unless the client reconciles against the server's current state on reconnect.

## Red flags

| Thought | Reality |
|---|---|
| "I'll just invalidate everything — simpler and safe." | Blind invalidation fires a refetch for every active query in the cache, spikes network and server load proportionally to the number of open queries, and makes dependency tracing impossible when bugs appear. |
| "Optimistic update is fine without rollback — the server rarely rejects." | When the server does reject (validation error, concurrent conflict, network timeout), the UI displays data that was never committed, and the divergence persists until the user navigates away or manually refreshes. |
| "Cache TTL handles freshness — users will get fresh data within a minute." | Users see stale data for exactly the wrong duration: the mutation succeeds, the UI still shows the old value, and the user re-submits or reports a bug before the TTL expires. |

## Good vs bad

### Targeted `invalidateQueries` vs blind invalidation

Bad:
```ts
// Refires every active query in the entire app after a single order update
const mutation = useMutation({
  mutationFn: updateOrder,
  onSuccess: () => {
    queryClient.invalidateQueries(); // no filter — scorched-earth refetch
  },
});
```

Good:
```ts
const mutation = useMutation({
  mutationFn: updateOrder,
  onSuccess: (_data, variables) => {
    // Only the queries that actually depend on this order
    queryClient.invalidateQueries({
      queryKey: ['orders', variables.orderId],
    });
    queryClient.invalidateQueries({
      queryKey: ['orders', 'list'],
      exact: false,
    });
  },
});
```

### Optimistic update with rollback vs fire-and-forget

Bad:
```ts
const mutation = useMutation({
  mutationFn: updateOrderStatus,
  onMutate: async ({ orderId, status }) => {
    // Sets optimistic state but provides no way to undo it on failure
    queryClient.setQueryData(['orders', orderId], (old: Order) => ({
      ...old,
      status,
    }));
  },
  // No onError, no onSettled — UI diverges permanently on any server rejection
});
```

Good:
```ts
const mutation = useMutation({
  mutationFn: updateOrderStatus,
  onMutate: async ({ orderId, status }) => {
    // Cancel in-flight refetches that would overwrite the optimistic value
    await queryClient.cancelQueries({ queryKey: ['orders', orderId] });

    // Snapshot current state so rollback is exact, not reconstructed
    const previous = queryClient.getQueryData<Order>(['orders', orderId]);

    queryClient.setQueryData(['orders', orderId], (old: Order) => ({
      ...old,
      status,
    }));

    return { previous };
  },
  onError: (_err, { orderId }, context) => {
    if (context?.previous) {
      queryClient.setQueryData(['orders', orderId], context.previous);
    }
  },
  onSettled: (_data, _err, { orderId }) => {
    // Reconcile with server truth on both success and failure
    queryClient.invalidateQueries({ queryKey: ['orders', orderId] });
  },
});
```

### Explicit `revalidateTag` vs implicit revalidation

Bad:
```ts
// Server action writes to the DB but relies on time-based cache expiry
export async function updateOrderAction(id: string, data: UpdateOrderInput) {
  await db.order.update({ where: { id }, data });
  // No revalidation — Next.js full-route cache serves stale HTML until TTL
}
```

Good:
```ts
'use server';

export async function updateOrderAction(id: string, data: UpdateOrderInput) {
  await db.order.update({ where: { id }, data });

  // Purge all cached responses tagged with this order's data
  revalidateTag(`order:${id}`);
  // Also purge list views that include this order
  revalidateTag('orders:list');
}

// Tag the fetch that populates the cache:
const order = await fetch(`/api/orders/${id}`, {
  next: { tags: [`order:${id}`, 'orders:list'] },
});
```

## TanStack Query invalidation patterns

TanStack Query v5 builds a query graph keyed by `queryKey` arrays. Every invalidation is a cache-key operation: `invalidateQueries` marks matching keys as stale and immediately triggers background refetches for any query currently mounted by an active component. The key insight is that the invalidation scope must exactly mirror the dependency graph — no wider, no narrower. Invalidating too broadly wastes network budget and CPU deserialising responses that will be discarded; invalidating too narrowly leaves stale entries that the user sees as incorrect data until the next natural refetch.

Key naming conventions are critical for targeted invalidation. Prefer hierarchical keys such as `['orders', orderId]` for singletons and `['orders', 'list', { status, page }]` for filtered collections. The `exact: false` option on `invalidateQueries` matches any key that begins with the supplied prefix, enabling a single call to purge all list variants after a mutation that touches a resource. The standard pattern after a write is: exact invalidation for the specific entity singleton, plus prefix-based invalidation for its parent list, in the same `onSuccess` callback.

When the mutation response includes the full updated resource, use `setQueryData` to populate the singleton cache entry immediately rather than waiting for a round-trip refetch. Use the functional updater form — `queryClient.setQueryData(key, (old) => newValue)` — rather than passing the new value directly so TypeScript can infer the type from the existing cache entry and surface shape mismatches at compile time. The list query can then be allowed to refetch in the background, giving the user instant feedback on the entity view while the list catches up.

For dependent queries — where query B's data is derived from or filtered by query A's result — ensure that invalidating A also invalidates B explicitly. Do not rely on React's re-render cascade to trigger a dependent query's refetch; `invalidateQueries` is imperative and must be called for every key in the dependency chain within the same mutation callback.

## Optimistic update pattern (with rollback)

Optimistic updates trade latency for risk: the UI reflects the intended outcome immediately, and the mutation result either confirms or rejects that assumption. The three-callback pattern (`onMutate`, `onError`, `onSettled`) maps cleanly onto this contract. `onMutate` cancels competing in-flight refetches via `cancelQueries` — so a background refresh arriving after the mutation begins does not overwrite the optimistic state — then snapshots the current cache entry with `getQueryData`, writes the optimistic value with `setQueryData`, and returns the snapshot as context so `onError` and `onSettled` receive it.

`onError` receives the context returned from `onMutate` and restores the snapshot using `setQueryData`. Restoring the snapshot rather than re-running the logic that produced the optimistic write is safer because the snapshot is exactly what the user saw before the mutation, including any fields the optimistic update did not touch. `onSettled` always calls `invalidateQueries` — on both success and failure — so the cache eventually reflects server truth regardless of outcome. Do not skip the `onSettled` refetch on success: the server may have applied additional transforms (updated timestamps, auto-computed fields, trigger-generated values) not included in the mutation response or the optimistic write.

For list mutations (appending or removing items), splicing an item into or out of a paginated list cache is error-prone when cursor-based pagination is in use. In that case, prefer `setQueryData` only for the entity singleton and rely on `invalidateQueries` for the list queries rather than manually reconstructing cursor structure. The overhead of one list refetch is preferable to a subtle ordering or cursor-state bug in the optimistic list. React 19's `useOptimistic` hook is appropriate for transient render-level feedback (disabled buttons, pending row indicators) that does not need to survive component unmount or be visible to sibling components; for global shared cache state, TanStack Query's `setQueryData` remains the correct mechanism.

## Next.js revalidation (path, tag, time-based)

Next.js 15 caches server component output in the full-route cache and `fetch` responses in the per-fetch data cache. A server action that mutates data without calling `revalidatePath` or `revalidateTag` leaves both caches populated with pre-mutation state. Time-based revalidation (`next: { revalidate: 60 }`) is appropriate for read-heavy pages where occasional staleness is acceptable, but it must never be the sole freshness mechanism for pages whose data changes via an explicit user-triggered mutation — the user expects to see the result of their action immediately, not after the next TTL window.

`revalidateTag` is the preferred mechanism because it is data-scoped rather than URL-scoped. Tag all `fetch` calls and `unstable_cache` wrappers that read a resource with a consistent naming scheme (e.g., `next: { tags: ['order:${id}', 'orders:list'] }`) and call `revalidateTag` from every server action or route handler that writes that resource. This ensures correctness regardless of how many URLs embed the resource — dynamic routes, parallel route segments, and ISR pages all benefit from a single tag flush. `revalidatePath` is appropriate when the resource is tightly coupled to a single canonical URL and maintaining a tag graph would add unnecessary complexity.

On-demand revalidation is available only from server-side code: server actions, route handlers, and API routes. In a hybrid architecture where mutations originate from a TanStack Query `mutationFn` calling a client-side fetch to a route handler, the route handler must call `revalidateTag` after a successful write. The TanStack Query `onSuccess` callback then calls `invalidateQueries` for client-side cache consistency. Both steps are required; the Next.js server cache and the TanStack Query in-memory cache are independent and neither flushes the other.

## Cross-tab and WebSocket consistency

A TanStack Query cache lives in memory within a single browser tab. A user with two tabs open who performs a mutation in tab A sees the result reflected immediately in that tab's cache, while tab B continues to display pre-mutation state until its next independent refetch. For most CRUD applications this is tolerable — TanStack Query's `refetchOnWindowFocus` default means tab B refetches on next focus. When the application has collaborative, financial, or multi-session semantics where tabs must converge within seconds without a focus event, explicit cross-tab messaging is required.

`BroadcastChannel` is the most direct mechanism: the tab that completes a mutation posts a typed message such as `{ type: 'invalidate', queryKey: ['orders', orderId] }`, and every other tab listening on the same named channel calls `queryClient.invalidateQueries` with the received key. This produces a targeted, key-scoped background refetch in sibling tabs without a full-page reload. The `BroadcastChannel` listener should be registered once at application startup (e.g., in a top-level layout or a singleton module) and must be cleaned up on unmount to avoid leaking listeners.

WebSocket and SSE state introduces a reconnect-gap problem: messages emitted by the server during a client disconnection (background tab, brief network outage) are silently dropped. On reconnect, the application must treat the resume as a signal to reconcile rather than merely resume. The standard pattern is: on the socket's `open` or `reconnect` event, call `queryClient.refetchQueries` for every query key that the socket delivers updates for, optionally fetching a "catch-up since sequence N" endpoint first if the server supports it. Event handlers must be idempotent so that events delivered both in the catch-up response and the live stream do not corrupt state.

## Interactions with other skills

- **Owns:** server/client state consistency, cache invalidation discipline, optimistic update correctness, Next.js revalidation after mutations.
- **Hands off to:** `prisma-data-access-guard` for the DB write itself; `frontend-implementation-guard` for where state lives in the component tree and context structure.
- **Does not duplicate:** `resilience-and-error-handling`'s retry semantics (this skill focuses on cache correctness, not retry logic or circuit breaking).

## Review checklist (invoke when reviewing existing code)

Produce a markdown report with these sections:

1. **Summary** — one line: pass / concerns / blocking issues.
2. **Findings** — per issue: *File:line, severity (low/med/high), category, what's wrong, recommended fix*.
3. **Safer alternative** — if an anti-pattern is widespread, prescribe the replacement approach for the whole codebase.
4. **Checklist coverage** — for each rule below, mark: PASS / CONCERN / NOT APPLICABLE.
   - Rule 1: Every `useMutation` has a targeted `invalidateQueries` or `setQueryData` — list every mutation missing an invalidation step.
   - Rule 2: Every optimistic update has both `onError` rollback and `onSettled` refetch — list every `onMutate` without a matching `onError`.
   - Rule 3: Server-returned data drives post-mutation cache updates; no client-only state trusted as server truth.
   - Rule 4: Every Next.js server action that writes data calls `revalidatePath` or `revalidateTag` explicitly.
   - Rule 5: Cross-tab synchronisation strategy documented and implemented where concurrent-tab scenarios exist.
   - Rule 6: WebSocket/SSE handlers include reconnect-and-refetch logic — no assumption of persistent connection.

**Required explicit scans:**
- List every `useMutation` call missing an `onSuccess` invalidation or `setQueryData`.
- List every `onMutate` callback without a corresponding `onError` that restores a cache snapshot.
- List every Next.js server action (`'use server'` file) that calls a DB write without a subsequent `revalidatePath` or `revalidateTag`.
- List every `invalidateQueries()` call invoked without a `queryKey` argument.
