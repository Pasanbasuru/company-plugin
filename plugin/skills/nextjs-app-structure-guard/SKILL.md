---
name: nextjs-app-structure-guard
description: Use when reviewing or editing a Next.js App Router file — page, layout, route handler, middleware, server action, or a component that crosses the server/client boundary. Do NOT use for pure client component state logic (use `frontend-implementation-guard`) or for data access (use `prisma-data-access-guard`). Covers RSC vs client, route handlers, middleware, server actions, streaming, caching, route groups.
allowed-tools: Read, Grep, Glob, Bash
---

# Next.js App Router structure guard

## Purpose & scope
Keep App Router code aligned with its rendering model: Server Components by default, client components pushed to the leaves, middleware kept narrow, and route handlers kept thin. This skill triggers on any change touching App Router files — pages, layouts, route handlers, middleware, server actions, or components that cross the server/client boundary. The goal is to prevent accidental client-bundle bloat, secret leakage, and untestable business logic hiding in framework glue files.

## Core rules
1. **Server Components are the default. `'use client'` goes on the smallest leaf that needs it.** — *Why:* pushing client directives to leaves ships less JS, keeps data and secrets on the server, and lets streaming work correctly across the subtree.
2. **Do not import server-only modules (`fs`, DB clients, secret managers) into client components.** — *Why:* these modules end up in the client bundle, leaking secrets or crashing at runtime when Node APIs are unavailable in the browser.
3. **Route handlers are thin: parse input (Zod), call a service, return a typed response. No business logic in `route.ts`.** — *Why:* when logic hides inside handlers it becomes untested glue that cannot be reused by server actions or other callers.
4. **Middleware is narrow — authz shortcuts, header manipulation, redirects. No DB calls, no business logic.** — *Why:* middleware runs on every matched request, so any work done there multiplies across all traffic and cannot be selectively skipped.
5. **Server Actions validate input with Zod and re-verify authorization at the top; never trust a hidden form field.** — *Why:* actions are public POST endpoints disguised as function calls and the browser is the caller, so any trust encoded in form fields is trivially forged.
6. **Caching is explicit: each fetch declares `cache`, `revalidate`, or `no-store`. Defaults are not assumed.** — *Why:* Next's default caching behavior has changed across versions and silence around it is a source of stale-data bugs that are hard to reproduce.
7. **`generateMetadata` and `generateStaticParams` are pure — no side effects, no secret usage.** — *Why:* these functions run at build and render time in varied contexts and side effects there cause non-deterministic output or leaked credentials in static builds.

## Red flags
| Thought | Reality |
|---|---|
| "I'll mark the whole layout `'use client'` for convenience" | loses RSC benefits, ships DB clients and server-only code to the browser, and breaks streaming for the entire subtree. |
| "The route handler can do the work directly, no service needed" | handlers become untested glue; services are testable units that can be reused across actions, handlers, and cron jobs. |
| "Middleware can check the DB for this request" | every request pays that latency cost; use a session cookie or token claim instead and keep middleware synchronous-ish. |

## Good vs bad

### `'use client'` at the leaf vs at the root

Bad:
```tsx
// app/dashboard/layout.tsx
'use client';  // whole dashboard is now a client component tree

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <div className="layout">{children}</div>;
}
```

Good:
```tsx
// app/dashboard/layout.tsx  (server component — no 'use client')
import { UserMenu } from './user-menu';  // client component at the leaf

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="layout">
      <UserMenu />  {/* only this subtree is client-side */}
      {children}
    </div>
  );
}

// app/dashboard/user-menu.tsx
'use client';
export function UserMenu() { /* uses hooks, event handlers */ }
```

### Thin route handler vs fat handler

Bad:
```ts
// app/api/orders/route.ts
export async function POST(req: Request) {
  const body = await req.json();
  if (!body.items || body.items.length === 0) return new Response('bad', { status: 400 });
  const total = body.items.reduce((s, i) => s + i.price * i.qty, 0);
  const order = await prisma.order.create({ data: { total, items: { create: body.items } } });
  await sendEmail(body.email, `Order ${order.id}`);
  return Response.json(order);
}
```

Good:
```ts
// app/api/orders/route.ts
import { CreateOrderSchema } from '@/lib/orders/schema';
import { createOrder } from '@/lib/orders/service';

export async function POST(req: Request) {
  const input = CreateOrderSchema.parse(await req.json());
  const order = await createOrder(input);  // service handles persistence + email
  return Response.json(order);
}
```

### Explicit cache policy vs default

Bad:
```ts
const res = await fetch(`${API}/products`);  // what's cached here? depends on Next version
```

Good:
```ts
const res = await fetch(`${API}/products`, {
  next: { revalidate: 60, tags: ['products'] },
});
```

## RSC/client boundary
Add `'use client'` only when a component uses event handlers, React hooks, browser APIs (`window`, `localStorage`, `navigator`), or third-party libraries that rely on those. The rule of thumb is to push the directive as far down the tree as possible so the maximum amount of the component tree remains server-rendered. Props crossing the boundary must be serialisable — do not pass functions, raw `Date` objects (without serialisation), class instances, or Prisma rows containing `Decimal` or `BigInt` fields directly as props. Use the `server-only` package in any module that must never ship to the client (DB clients, secret readers) and `client-only` for modules that require browser globals; both packages throw import-time errors if a module leaks into the wrong environment, catching boundary violations at build time rather than runtime. Dynamic imports with `next/dynamic` and `{ ssr: false }` are an appropriate last resort for libraries that crash during SSR, but they should not be the default approach for introducing interactivity — prefer a properly placed `'use client'` leaf component instead.

## Route handler patterns
The signature for App Router route handlers is `(req: Request, ctx: { params: Promise<...> }) => Response | Promise<Response>`. Always parse the request body or query parameters through a Zod schema before use and return a 422 with a structured error body on validation failure. Delegate all domain work to a service layer function that is independently unit-testable — the handler's only job is to translate HTTP into a function call and translate the result back into an HTTP response. Use `NextResponse.json()` when you need cookie manipulation or typed response helpers; plain `Response.json()` is fine for simple cases. Return semantically correct status codes: 201 on resource creation, 204 on successful deletion with no body, 409 on conflict, 422 on validation error. Catch known error types (e.g., a `NotFoundError` from the service) with typed catches and map them to appropriate status codes; let truly unexpected errors propagate to the framework's error boundary so they get logged centrally.

## Server Actions safety
Treat server actions as public POST endpoints — the browser is the caller and any user can send arbitrary payloads. At the top of every action: verify the session and establish who the caller is, then parse the action input through a Zod schema. After parsing, re-check that the caller is authorized to act on the specific target resource, not just that they are logged in. Never encode trust in hidden form fields such as `userId` or `role`; read those values from the verified session instead, because form fields are trivially forged. For progressive enhancement, design actions to be idempotent where possible — the browser may resubmit on network failure. Return only serialisable values from actions. After any mutation, call `revalidatePath` or `revalidateTag` so the RSC cache reflects the change and the user sees fresh data without a full reload.

## Caching and revalidation
There are three distinct caching layers in App Router: the per-request `fetch` HTTP cache, the Route Segment cache (controlled by `export const revalidate` or `export const dynamic`), and the Data Cache (`unstable_cache` for non-fetch async data). For each `fetch` call, explicitly choose one policy: `cache: 'force-cache'` for long-lived reference data that rarely changes, `next: { revalidate: N }` for time-based freshness where N matches your tolerance for staleness, or `cache: 'no-store'` for per-request data that must never be shared across users. Use `tags` on fetches together with `revalidateTag` in mutations for surgical cache invalidation without waiting for a TTL. Never rely on defaults because they have changed across Next.js versions and will change again. For pages that must always be dynamic, set `export const dynamic = 'force-dynamic'` explicitly, or call `cookies()` or `headers()` at the top of the component to make the dynamic boundary visible to the framework and to the next developer reading the file.

## Middleware scope
Middleware runs on every matched request, so the `matcher` config must be tight — exclude `/_next/`, static file extensions, and any API routes that do not require the middleware's work. Valid uses for middleware are: redirecting unauthenticated users to a login page, injecting request IDs into headers, rewriting locale prefixes into the URL, and flipping A/B test flags based on a cookie. Invalid uses are DB queries, complex authorization logic that requires reading user roles from a database, or reading large request bodies. The edge runtime applies by default and it carries restrictions: no Node.js APIs, no large dependency trees, and no native modules. If middleware grows past roughly 30 lines, move the logic into a shared library under `@/lib/middleware/` and keep the middleware file as a thin caller that imports and invokes those helpers — this also makes the helpers testable in isolation.

## Interactions with other skills
- **Owns:** Next.js-specific file structure, rendering boundary (`'use client'`), route handler shape, middleware scope, caching semantics, Server Actions.
- **Hands off to:** `frontend-implementation-guard` for component composition and client-side state; `auth-and-permissions-safety` for the actual authz logic inside middleware / actions / handlers; `prisma-data-access-guard` for DB queries within server functions; `performance-budget-guard` for bundle and LCP/INP impact.
- **Does not duplicate:** React component structure or client state management concerns — those belong to `frontend-implementation-guard`.

## Review checklist (invoke when reviewing existing code)

Produce a markdown report with these sections:

1. **Summary** — one line: pass / concerns / blocking issues.
2. **Findings** — per issue: *File:line, severity (blocking | concern | info), category (RSC boundary | route handler | middleware | server action | caching | metadata purity), what's wrong, fix*. List every `'use client'` with file:line and whether it could move to a smaller leaf.
3. **Safer alternative** — if an anti-pattern is widespread (e.g., top-level `'use client'` across many layouts, fat route handlers), prescribe the replacement and migration path.
4. **Checklist coverage** — for each rule below, mark PASS / CONCERN / NOT APPLICABLE:
   - Rule 1: Server Components default; `'use client'` at leaves only.
   - Rule 2: No server-only imports in client components.
   - Rule 3: Route handlers thin (validate, delegate, shape).
   - Rule 4: Middleware narrow (no DB, no business logic).
   - Rule 5: Server Actions validate input and re-verify authorization.
   - Rule 6: Every `fetch` has an explicit cache policy.
   - Rule 7: `generateMetadata` / `generateStaticParams` are pure.
