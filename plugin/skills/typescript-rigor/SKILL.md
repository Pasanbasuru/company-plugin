---
name: typescript-rigor
description: Use when authoring or reviewing TypeScript types, generics, DTOs, or boundary parsing. Do NOT use for runtime/logic review without a type concern. Covers strict compiler options, discriminated unions, branded types, exhaustiveness, zod boundaries, error types.
allowed-tools: Read, Grep, Glob, Bash
---

# TypeScript rigor

## Purpose & scope

Enforce strong type discipline beyond `_baseline`: model correctness-by-construction at boundaries and in domain code so invalid states are unrepresentable. Apply this skill when a type-system choice eliminates a class of bug outright — not as a box-ticking exercise. Boundary parsing, branded IDs, discriminated unions, and typed errors are the primary levers.

## Assumes `_baseline`. Adds:

type-system rigour on top of baseline TS strictness.

## Core rules

1. **Prefer discriminated unions to optional-field + flag patterns.** — *Why:* invalid state combinations become compile errors instead of runtime surprises.
2. **Brand domain IDs (`type UserId = string & { __brand: 'UserId' }`).** — *Why:* prevents passing an `OrderId` where a `UserId` is expected; the compiler rejects the swap.
3. **Parse, don't validate — Zod schemas return typed, trusted data; downstream code never re-checks.** — *Why:* one canonical parse point; no drift between the check and the usage.
4. **Function signatures accept the narrowest input and return the widest type the caller actually needs.** — *Why:* eliminates `Partial<Everything>` sprawl and leaky abstractions that expose implementation details.
5. **Errors are typed (`Result<T, E>` or a typed exception hierarchy); `catch (e: unknown)` always narrows before use.** — *Why:* untyped errors silently swallow diagnostic information and allow wrong-path code to keep running.
6. **No `Record<string, unknown>` at boundaries — define the shape or use `z.unknown()` then parse.** — *Why:* unstructured shapes reach domain logic and cause silent data corruption or runtime errors.
7. **Generics carry bounded type parameters; no unconstrained `<T>` that silently accepts `any`.** — *Why:* an unbounded `<T>` is just a delayed `any`; constraints make the generic honest.

## Red flags

| Thought | Reality |
|---|---|
| "I'll cast this for now" | Casts lie to the compiler and propagate bugs downstream. |
| "Just add an optional field" | Optional + flag combos hide invariants; use a union instead. |
| "I validated it earlier" | Parsing once is cheap; re-checking at call sites is an invitation to drift. |
| "`any` is fine here, it's internal" | `any` punches a hole through the type system; prefer `unknown` and narrow. |

## Good vs bad

### Discriminated union vs optional + flag

Bad:
```ts
interface UIState {
  isLoading: boolean;
  data?: User[];
  error?: string;
}
// nothing stops { isLoading: true, data: [], error: "oops" }
```

Good:
```ts
type UIState =
  | { status: 'loading' }
  | { status: 'success'; data: User[] }
  | { status: 'error'; message: string };

// exhaustive handling — compiler catches missing branches
function render(state: UIState) {
  switch (state.status) {
    case 'loading': return <Spinner />;
    case 'success': return <List items={state.data} />;
    case 'error':   return <Alert msg={state.message} />;
  }
}
```

### Branded ID vs raw string

Bad:
```ts
function assignOrder(userId: string, orderId: string) { /* ... */ }

const uid = 'user-1';
const oid = 'order-99';
assignOrder(oid, uid); // silently swapped — no compile error
```

Good:
```ts
type UserId  = string & { __brand: 'UserId' };
type OrderId = string & { __brand: 'OrderId' };

function assignOrder(userId: UserId, orderId: OrderId) { /* ... */ }

// assignOrder(oid as OrderId, uid as UserId) — now a type error at the call site
```

### Parse at boundary vs type assertion

Bad:
```ts
app.post('/users', (req, res) => {
  const input = req.body as CreateUserInput; // lie to the compiler
  createUser(input);                          // unvalidated data enters domain
});
```

Good:
```ts
const CreateUserSchema = z.object({
  name:  z.string().min(1),
  email: z.string().email(),
});
type CreateUserInput = z.infer<typeof CreateUserSchema>;

app.post('/users', (req, res) => {
  const input = CreateUserSchema.parse(req.body); // throws ZodError if invalid
  createUser(input);                               // fully typed, trusted data
});
```

## Compiler options

Options that go beyond `_baseline`'s floor; add these to `tsconfig.json`:

- `"noPropertyAccessFromIndexSignature": true` — forces `obj['key']` syntax for index-signature access, making accidental property reads visible.
- `"noImplicitReturns": true` — every code path in a function must return a value; prevents silently returning `undefined`.
- `"allowUnreachableCode": false` — flags dead code after `return`/`throw` as an error rather than a warning.
- `"verbatimModuleSyntax": true` — requires `import type` for type-only imports, keeping runtime module graph clean and bundler-friendly.

## Zod at boundaries

Define the schema once; infer the TypeScript type from it — never the other way around.

```ts
import { z } from 'zod';

const QueueMessageSchema = z.object({
  eventType: z.enum(['ORDER_PLACED', 'ORDER_CANCELLED']),
  orderId:   z.string().uuid(),
  timestamp: z.coerce.date(),
});

type QueueMessage = z.infer<typeof QueueMessageSchema>;

// In the queue consumer:
async function handleMessage(raw: unknown): Promise<void> {
  const msg = QueueMessageSchema.parse(raw); // typed QueueMessage or throws
  await processOrder(msg.orderId, msg.eventType);
}
```

Apply this pattern at every trust boundary: HTTP handlers, queue consumers, file parsers, third-party API responses, and `process.env` reads.

## Error typing

Two patterns — choose based on the failure mode.

**`Result<T, E>` for expected, recoverable failures** (business rules, validation, not-found):

```ts
type Result<T, E> =
  | { ok: true;  value: T }
  | { ok: false; error: E };

type FindUserError = { code: 'NOT_FOUND' } | { code: 'DB_UNAVAILABLE' };

async function findUser(id: UserId): Promise<Result<User, FindUserError>> {
  const row = await db.users.findUnique({ where: { id } });
  if (!row) return { ok: false, error: { code: 'NOT_FOUND' } };
  return { ok: true, value: row };
}
```

**Typed exception hierarchy for bugs and unrecoverable failures** (programming errors, infrastructure down):

```ts
class AppError extends Error {
  constructor(message: string, readonly code: string) { super(message); }
}
class ValidationError extends AppError {
  constructor(message: string) { super(message, 'VALIDATION_ERROR'); }
}
```

Use `Result` when callers must handle every failure path. Use typed exceptions when failure indicates a bug or an outage the caller cannot meaningfully recover from. Either way, `catch (e: unknown)` — never `catch (e: any)` — and narrow with `instanceof` or a type guard before accessing fields.

## Migration tactics

Removing `any` from an existing codebase is incremental work, not a big bang.

1. **Start at trust boundaries.** Route handlers, queue consumers, and env reads are the highest-value targets. Replace `as SomeType` casts with Zod schemas and let `z.infer` drive the type.
2. **Promote `any` to `unknown`.** A mechanical change — swap `any` for `unknown` throughout; the compiler then surfaces every unsafe access, one by one.
3. **Narrow with Zod or type guards.** For each `unknown` that surfaces, write a narrowing function or schema. Prefer Zod schemas at I/O boundaries; prefer type guard functions (`isFoo(x): x is Foo`) for internal domain checks.
4. **Tighten `tsconfig` one option at a time.** Add one of the options from the [Compiler options](#compiler-options) section, fix resulting errors, commit. Repeat. Mixing option additions with business changes makes errors harder to attribute.
5. **Suppress nothing silently.** If a `@ts-ignore` was there before you arrived, leave a `// TODO` with a ticket reference or remove it. Never add a new suppression as part of a migration step.

## Interactions with other skills

- **Owns:** type-system usage, boundary parsing typing.
- **Hands off to:** `prisma-data-access-guard` for Prisma-generated types; `nestjs-service-boundary-guard` for DTO validation placement; `integration-contract-safety` for cross-service type contracts.
- **Does not duplicate:** `_baseline`'s `strict: true` requirement — this skill adds rigour on top.

## Review checklist (invoke when reviewing existing code)

Produce a markdown report with these sections:

1. **Summary** — one line: pass / concerns / blocking issues.
2. **Findings** — per issue: *File:line, severity (low/med/high), category, what's wrong, recommended fix*. Flag every `any`, `@ts-ignore`, and untyped boundary with its exact file:line location.
3. **Safer alternative** — if an anti-pattern is widespread, prescribe the replacement approach for the whole codebase (e.g., "replace all `req.body as X` casts with Zod schemas at the controller layer").
4. **Checklist coverage** — for each of the 7 core rules below, mark: PASS / CONCERN / NOT APPLICABLE.
   - Rule 1: Discriminated unions used instead of optional + flag
   - Rule 2: Domain IDs are branded
   - Rule 3: Parse-don't-validate at all trust boundaries
   - Rule 4: Signatures use narrowest input / widest needed output
   - Rule 5: Errors are typed; `catch` narrows before access
   - Rule 6: No bare `Record<string, unknown>` at boundaries
   - Rule 7: All generics have bounded type parameters
