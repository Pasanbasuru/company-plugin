---
name: performance-budget-guard
description: Use when reviewing or creating a new route, dependency, heavy computation, DB query on a hot path, or UI that might affect Core Web Vitals. Do NOT use for pure logic correctness review (use `typescript-rigor`) or for DB query shape (use `prisma-data-access-guard`). Covers Core Web Vitals, JS bundle budgets, query p95 budgets, memoization, streaming, caching layers.
allowed-tools: Read, Grep, Glob, Bash
---

# Performance budget guard

## Purpose & scope

Keep performance from regressing one small decision at a time — every change is checked against concrete budgets before merge.

## Core rules

1. **Per-route JS bundle budget (170 KB gzipped by default) is enforced in CI; a regression above threshold blocks merge until it is justified in writing.** — *Why:* bundles grow by accretion; a hard limit forces the conversation about trade-offs to happen before the cost is paid by every user on every page load.
2. **New dependencies are evaluated for size, tree-shakability, and whether a smaller alternative exists before they are added.** — *Why:* a 40 KB transitive dependency added for a single utility function is a bundle regression in disguise; the cost is invisible until it is measured.
3. **Hot-path DB queries meet their p95 latency budget; any new query on a hot path includes a baseline measurement or a cache layer justification.** — *Why:* a query that takes 300 ms at p50 is often 1200 ms at p95; without measurement, assumptions about latency are wrong and users in the tail pay the price silently.
4. **React memoization (`memo`, `useMemo`, `useCallback`) is applied to the specific components and values where profiling shows a benefit — not reflexively.** — *Why:* memoization has its own cost — the comparison on every render, the held reference, the cognitive overhead — and it obscures the real fix (moving state down, lifting computation out of render, or splitting the component).
5. **Images are served via Next.js `<Image>` with explicit `sizes`, correct `priority`, and intrinsic `width`/`height` to prevent layout shift.** — *Why:* an un-optimized image is one of the most reliable ways to fail LCP and CLS at the same time; Next.js `<Image>` solves both with format conversion, lazy loading, and size hints, but only when configured correctly.
6. **Streaming and Suspense are used where TTFB benefits — slow data-fetching paths — and static rendering is used where the content is cheap to pre-render.** — *Why:* wrapping everything in `<Suspense>` without thinking about the data dependency graph delays the shell unnecessarily; wrapping nothing in it forces the user to wait for the slowest query before any HTML is sent.
7. **Every cache layer (browser, CDN, Next.js Data Cache, Redis, Prisma) has an explicit TTL and a documented invalidation path.** — *Why:* silent caches serve stale data indefinitely when the invalidation story is missing; explicit TTLs and tags make the freshness contract readable and reviewable.

## Red flags

| Thought | Reality |
|---|---|
| "Memoize everything just in case — it can't hurt" | Every `useMemo`/`useCallback` adds a comparison cost and holds a reference; blanket memoization often slows renders and always hides the real structural problem. |
| "I'll pull in the whole library — we might need other parts later" | A whole-library import bundles every unused export; tree-shaking only works if the library is structured for it and the import is specific. |
| "I'll check performance after launch — ship first" | Performance regressions compound across releases; by launch there are ten interdependent causes and no clear owner. Measure per change, at merge time. |

## Good vs bad

### Tree-shaken import vs whole-library import

Bad:
```ts
// Imports the entire lodash runtime (~70 KB minified)
import _ from 'lodash';

const chunks = _.chunk(items, 3);
const uniq   = _.uniq(ids);
```

Good:
```ts
// Only the two functions ship — a few hundred bytes each
import chunk from 'lodash/chunk';
import uniq  from 'lodash/uniq';

const chunks = chunk(items, 3);
const uniqIds = uniq(ids);
```

Better still: for simple cases, use the platform — `Array.from({ length: Math.ceil(items.length / 3) }, (_, i) => items.slice(i * 3, i * 3 + 3))` ships zero bytes and has no import boundary.

### Next.js `<Image priority sizes="...">` vs raw `<img>`

Bad:
```tsx
// No format conversion, no lazy loading, no size hints — LCP and CLS both suffer
<img src="/hero.jpg" alt="Hero" style={{ width: '100%' }} />
```

Good:
```tsx
import Image from 'next/image';

// priority=true prevents lazy-loading the LCP image
// sizes tells the browser which source to fetch at each breakpoint
// width+height reserve space and prevent CLS
<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={630}
  priority
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
/>
```

For images below the fold, omit `priority` and let the default lazy loading apply. For images whose dimensions are unknown at build time (user-uploaded content), use `fill` with a positioned wrapper rather than hardcoded `width`/`height`.

### Targeted memo on an expensive subtree vs blanket React.memo

Bad:
```tsx
// Every component in the file is wrapped — no profiling done
export const UserList   = React.memo(function UserList({ users }) { … });
export const UserCard   = React.memo(function UserCard({ user })  { … });
export const UserAvatar = React.memo(function UserAvatar({ src })  { … });
export const UserBadge  = React.memo(function UserBadge({ role })  { … });
```

Good:
```tsx
// React DevTools Profiler showed UserList re-renders expensive on every parent tick
// because it owns a 200-item virtualized list; the others are cheap — no memo needed
export const UserList = React.memo(function UserList({ users }: { users: User[] }) {
  return <VirtualList items={users} renderItem={(u) => <UserCard user={u} />} />;
});

// UserCard, UserAvatar, UserBadge are left unwrapped — their render cost is trivial
```

The rule of thumb: profile first, memo second.

## Core Web Vitals budgets and measurement

Core Web Vitals are the three user-facing performance signals that Google uses in ranking and that directly correlate with conversion and retention. The targets are: LCP (Largest Contentful Paint) under 2.5 s, INP (Interaction to Next Paint) under 200 ms, and CLS (Cumulative Layout Shift) below 0.1. These are not aspirations — they are budgets.

Measurement happens at three levels. In the browser during development, use the `web-vitals` library to instrument real metric values:

```ts
import { onLCP, onINP, onCLS } from 'web-vitals';

onLCP(console.log);
onINP(console.log);
onCLS(console.log);
```

Ship this instrumentation to production and route the data to your analytics pipeline so you have real-user measurement (RUM) over time.

In CI, Lighthouse CI (`@lhci/cli`) runs a headless Lighthouse audit on every pull request and compares results against a stored baseline:

```yaml
# .github/workflows/lhci.yml (excerpt)
- name: Run Lighthouse CI
  run: |
    npm install -g @lhci/cli
    lhci autorun
  env:
    LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

```json
// lighthouserc.json
{
  "ci": {
    "assert": {
      "assertions": {
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift":  ["error", { "maxNumericValue": 0.1  }],
        "total-blocking-time":      ["warn",  { "maxNumericValue": 300  }]
      }
    }
  }
}
```

In production, surface p75 and p95 Core Web Vitals from your RUM pipeline in a dashboard and alert when a 7-day moving average crosses the budget.

## Bundle budgets in CI

The browser must parse and execute every byte of JavaScript before the page becomes interactive. Enforcing a per-route budget in CI closes this loop.

Use `size-limit` to define budgets per entry point:

```json
// package.json (excerpt)
{
  "size-limit": [
    { "path": ".next/static/chunks/pages/index*.js",    "limit": "170 kB", "gzip": true },
    { "path": ".next/static/chunks/pages/checkout*.js", "limit": "200 kB", "gzip": true }
  ]
}
```

Run `npx size-limit` as part of the CI pipeline. If a PR exceeds the limit, the check fails and the author must either reduce the bundle or explicitly raise the limit with a justification comment in the PR.

For diagnosing which modules are causing a regression, use `@next/bundle-analyzer`:

```ts
// next.config.ts
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export default withBundleAnalyzer({
  // ... rest of config
});
```

Run `ANALYZE=true next build` locally to generate an interactive treemap. Look for: duplicate packages at different versions, `moment` or `lodash` included in full, large icon libraries included wholesale rather than individually, and polyfills that are not needed for your browser target.

When reviewing a PR that adds a new `npm install`, check `bundlephobia.com` for the package's gzipped size and side-effect status. A package marked `sideEffects: false` in its `package.json` is fully tree-shakable; a package without that field may pull in more than you expect regardless of import style.

## Query p95 budgets

A database query that averages 50 ms can spike to 800 ms at p95 on a busy Tuesday. Every new query added to a hot path — a route that handles more than a few requests per second — requires a p95 latency estimate before the PR merges.

Establish budgets per query tier:

| Query type | p95 budget |
|---|---|
| Read on hot API route | < 100 ms |
| Write on transactional path | < 200 ms |
| Background / batch | No strict p95; must not hold locks |

Measure in two places. First, in development, use Prisma's query event logging to see actual durations:

```ts
// lib/prisma.ts
export const prisma = new PrismaClient({
  log: [{ level: 'query', emit: 'event' }],
});

prisma.$on('query', (e) => {
  if (e.duration > 100) {
    console.warn(`Slow query (${e.duration}ms): ${e.query}`);
  }
});
```

Second, in production, emit query duration as a CloudWatch custom metric and build a p95 alarm. When `SELECT` on the orders table crosses 100 ms p95, the alarm fires before users start complaining. Pair this with the query text (sanitised of PII) in the log so the on-call engineer can identify the culprit without diving into slow-query logs manually.

When a query is approaching its budget, the remedies in order of preference are: add a missing index, narrow the query to return fewer columns or rows, add a cache layer in front of the query, or redesign the data access pattern. Cache last, not first — caches on slow queries fail under invalidation pressure.

## Memoization: when it helps

React re-renders are not expensive by default. Memoization only pays off when: (a) the component renders something expensive — a large list, a canvas, a heavy computation — and (b) its parent re-renders frequently for reasons unrelated to the component's props. Both conditions must be true.

`useMemo` is for values whose computation is genuinely expensive relative to the comparison cost. The comparison itself is not free — it walks the dependency array on every render.

```tsx
// React 19 — use the compiler's automatic memoization where possible;
// manual useMemo for cases the compiler cannot infer
'use cache'; // or use the React Compiler with Next 15

// Only manual memo for genuinely expensive derivations
const expensiveCoords = useMemo(
  () => computeGeoCluster(rawPoints), // O(n²) spatial algorithm
  [rawPoints]
);
```

`useCallback` should be reserved for functions passed to memoized children — if the child is not wrapped in `memo`, the `useCallback` buys nothing and just adds noise.

React 19 introduced the React Compiler, which automatically applies memoization at the bytecode level for components written to its rules. When the compiler is enabled (available in Next 15 via `experimental.reactCompiler: true`), most manual `useMemo` and `useCallback` calls become redundant. Before reaching for either hook, check whether the compiler is already handling the case.

The right sequence: profile with React DevTools Profiler → identify components that render more than 50 times in a second or take more than 2 ms per render → apply `memo`/`useMemo` to those specific cases → re-profile to confirm the improvement.

## Image optimization

The Next.js `<Image>` component addresses both concerns: it converts images to WebP/AVIF at the CDN layer, generates `srcset` entries for every defined breakpoint, and reserves the correct amount of space in the layout before the image loads.

The `sizes` attribute is the most commonly misconfigured field. It tells the browser which source to request based on the viewport width. An incorrect `sizes` causes the browser to download a full-width image for a thumbnail slot, or vice versa:

```tsx
// A card grid where each card is one-third of the viewport on desktop,
// half on tablet, and full-width on mobile
<Image
  src={product.imageUrl}
  alt={product.name}
  width={400}
  height={300}
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
/>
```

The `priority` prop disables lazy loading and injects a `<link rel="preload">` into the document head. Use it on the single image that is the page's LCP candidate — typically the hero image or the above-the-fold product image. Do not apply it to all images.

For user-uploaded images stored in S3 or a similar object store, configure the Next.js `remotePatterns` allow-list and ensure your CDN sits in front of the Next.js image optimization endpoint so it is only called once per image-size combination, not on every request.

Animated GIFs: a 3 MB animated GIF causes a significant LCP delay and burns mobile data. Replace them with looping `<video>` elements (`autoPlay muted loop playsInline`) using WebM + MP4, which are an order of magnitude smaller for equivalent visual quality.

## Cache layer topology

A performant application has caches at multiple levels, each serving a different purpose. The failure modes are: missing a cache where one is needed, caching data that should not be shared across users, caching without a TTL, and forgetting to invalidate after a mutation.

The layers in a typical Next 15 application, outermost to innermost:

**Browser cache** — controlled by `Cache-Control` headers. Static assets from `/_next/static/` get `max-age=31536000, immutable` by default (correct, do not override). API responses for user-specific data should carry `Cache-Control: private, no-store` to prevent CDN caching of personal information.

**CDN (Vercel Edge / CloudFront)** — caches full page responses and API responses with `s-maxage`. Use `Surrogate-Key` or CloudFront cache policies with tag-based invalidation so a content update can be pushed without waiting for TTL expiry. Never cache responses that include session-specific data at the CDN layer.

**Next.js Data Cache** — the `fetch` cache maintained by the Next.js runtime. Tag every fetch so mutations can call `revalidateTag`:

```ts
// In a server component or server action
const products = await fetch(`${API}/products`, {
  next: { revalidate: 300, tags: ['products'] },
}).then(r => r.json());

// After a mutation in a server action
import { revalidateTag } from 'next/cache';
revalidateTag('products');
```

**Redis** — for data that is expensive to compute, shared across requests (not user-specific), and too dynamic for a CDN TTL. Common use cases: aggregated leaderboards, rate-limit counters, session state that needs to be shared across pods. Set a TTL on every key; never write to Redis without one. Use a consistent key-naming scheme (`{service}:{entity}:{id}`) so keys are identifiable in a Redis monitor and TTLs can be audited.

**Prisma / connection pool** — the database connection pool itself is a resource that must be sized. A connection pool that is too small causes query queueing under load; one that is too large exhausts the database's max connections. Monitor pool utilization alongside query p95 in CloudWatch. Prisma Accelerate (or a PgBouncer proxy in front of Postgres) handles connection multiplexing when the application scales to multiple instances.

Every cache must have a written invalidation story before merge.

## Interactions with other skills

- **Owns:** perf budgets on web and API — bundle size, Core Web Vitals, query p95, memoization correctness, image optimization, cache topology.
- **Hands off to:** `prisma-data-access-guard` for query shape and index design; `nextjs-app-structure-guard` for RSC/streaming architecture decisions; `supply-chain-and-dependencies` for new-dependency security and provenance review.
- **Does not duplicate:** design-system CSS performance concerns; `nextjs-app-structure-guard`'s fetch cache policy rules — this skill governs the budget and invalidation contract, not the placement of `fetch` calls.

## Review checklist (invoke when reviewing existing code)

Produce a markdown report with these sections:

1. **Summary** — one line: pass / concerns / blocking issues.
2. **Findings** — per issue: *File:line, severity (blocking | concern | info), category (bundle | web-vitals | query-p95 | memoization | image | cache), what's wrong, recommended fix*. Include bundle delta if measurable, new-query p95 estimate, and image optimization state for every `<img>` tag found.
3. **Safer alternative** — if an anti-pattern is widespread (e.g., raw `<img>` across many components, blanket `React.memo`), prescribe the replacement approach for the whole codebase.
4. **Checklist coverage** — for each rule below, mark PASS / CONCERN / NOT APPLICABLE:
   - Rule 1: Per-route bundle budget enforced in CI.
   - Rule 2: New dependencies evaluated for size and tree-shakability.
   - Rule 3: Hot-path queries have a p95 measurement or cache justification.
   - Rule 4: Memoization is targeted, profiler-justified, not reflexive.
   - Rule 5: Images use `<Image>` with `sizes`, `priority`, and intrinsic dimensions.
   - Rule 6: Streaming/Suspense used where TTFB benefits; static where cheap.
   - Rule 7: Every cache has an explicit TTL and documented invalidation path.
