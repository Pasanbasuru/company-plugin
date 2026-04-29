---
name: prisma-data-access-guard
description: Use when touching Prisma queries, schema, or migrations. Do NOT use for schema design decisions without a concrete query (use `architecture-guard`). Covers query shape, N+1, transactions, migration safety, indexes, raw SQL safety, selection shape.
allowed-tools: Read, Grep, Glob, Bash
---

# Prisma data access guard

## Purpose & scope

Prevent data-access landmines: N+1 queries, unsafe raw SQL, partial-failure writes, and migrations that lock production tables. Apply this skill any time a query, transaction, migration file, or `schema.prisma` change is authored or reviewed. The goal is correctness, safety, and predictable performance at the Prisma/Postgres layer.

## Core rules

1. **`select` exactly what's needed — never return full rows by default.** — *Why:* unbounded column reads waste network and memory and silently expose fields the caller should not see.
2. **Loops over related data use `include` or a single `findMany` with `where: { id: { in: [...] } }`, never `await` inside a loop.** — *Why:* an await per iteration multiplies round-trips linearly with row count, making N+1 the default outcome.
3. **Multi-write operations use `prisma.$transaction`. Reads that must be consistent use an interactive transaction.** — *Why:* sequential awaited writes have no atomicity guarantee; a crash between writes leaves the DB in a partial state.
4. **`findMany` without `take` is a bug — unbounded results ship everything to memory.** — *Why:* table sizes grow; what is safe at 1k rows silently OOMs a server at 1M.
5. **Every high-cardinality `where` field has a matching index in `schema.prisma`.** — *Why:* Postgres falls back to a sequential scan when no index exists, turning a millisecond lookup into seconds at scale.
6. **Migrations are reversible (or have a documented forward-only justification) and avoid `ALTER TABLE ... NOT NULL` on large tables without a backfill strategy.** — *Why:* Postgres acquires an `ACCESS EXCLUSIVE` lock for certain DDL statements, blocking all reads and writes for the table's duration.
7. **`$queryRaw` uses tagged templates only. `$queryRawUnsafe` is forbidden for user-controlled input.** — *Why:* string interpolation into `$queryRawUnsafe` is a SQL injection vector with no mitigation at the framework level.
8. **`prisma db push` is for local prototyping only. Production uses `prisma migrate deploy` against versioned migrations.** — *Why:* `db push` bypasses the migration history, making schema state irrecoverable and drift undetectable.

## Red flags

| Thought | Reality |
|---|---|
| "I'll await inside the map" | Each iteration opens a new DB round-trip, producing N+1 queries that collapse performance at production row counts. |
| "This is a small migration, no backfill needed" | Large tables acquire `ACCESS EXCLUSIVE` locks on `ALTER TABLE` DDL, blocking all reads and writes until the operation completes. |
| "I need raw SQL just for speed" | Prisma methods compile to efficient queries; if a raw query is truly needed, use a tagged `$queryRaw` template and verify with `EXPLAIN ANALYZE`. |
| "No index — table is small today" | Row counts grow silently; adding an index later under load risks a long concurrent build or production latency spikes during deployment. |

## Good vs bad

### N+1 via await-in-loop vs include

Bad:
```ts
const orders = await prisma.order.findMany();
// separate DB round-trip for every order
const results = await Promise.all(
  orders.map(async (order) => ({
    ...order,
    customer: await prisma.customer.findUnique({
      where: { id: order.customerId },
    }),
  }))
);
```

Good:
```ts
const orders = await prisma.order.findMany({
  take: 100,
  select: {
    id: true,
    total: true,
    customer: {
      select: { id: true, name: true, email: true },
    },
  },
});
```

### Sequential writes vs transaction

Bad:
```ts
// crash between these two leaves the DB in partial state
await prisma.order.update({ where: { id }, data: { status: 'PAID' } });
await prisma.payment.create({ data: { orderId: id, amount, method } });
```

Good:
```ts
await prisma.$transaction([
  prisma.order.update({ where: { id }, data: { status: 'PAID' } }),
  prisma.payment.create({ data: { orderId: id, amount, method } }),
]);
```

### `$queryRawUnsafe` with interpolation vs tagged template

Bad:
```ts
// SQL injection — userInput flows directly into the query string
const rows = await prisma.$queryRawUnsafe(
  `SELECT * FROM "User" WHERE email = '${userInput}'`
);
```

Good:
```ts
// Tagged template — Prisma parameterises the placeholder automatically
const rows = await prisma.$queryRaw<User[]>`
  SELECT id, email, name
  FROM "User"
  WHERE email = ${userInput}
`;
```

## Query shape and over-fetching

Every Prisma query should carry an explicit `select` or `include` clause. The Prisma client's default behaviour returns every scalar column on the model, which means adding a column to the schema silently widens every callsite that did not opt out. Wide rows also increase serialisation cost, network payload, and the risk of leaking internal or sensitive fields to callers. The discipline is to start with the minimum projection and widen only when the callsite needs more.

For read-heavy paths such as list endpoints or background jobs that process many rows, prefer `select` over `include`: `select` lets you traverse relations while still restricting which columns are fetched, whereas `include` fetches all scalars on the related model. Pagination via `take` and `cursor` (or `skip` for small offsets) is mandatory on every `findMany`. Treat a missing `take` the same way you would treat a missing `LIMIT` in raw SQL: it is always a bug waiting to surface.

## N+1 detection

N+1 is the most common Prisma performance bug and appears in code that looks reasonable at first glance. The pattern is: fetch a list of records, then for each record make a separate Prisma call to resolve a relation. At 10 rows this is fast; at 10k rows the query log shows thousands of identical round-trips.

Detection strategy: search for `await` inside any `for`, `forEach`, `map`, or `reduce` callback that touches a Prisma model. Instrument with `prisma.$on('query', ...)` in development to count round-trips for a given request. When the relation is on every row, use `include` in the parent query or batch with a single `findMany({ where: { id: { in: parentIds } } })` and correlate in application code. For deeply nested relations, check that each `include` level is guarded with a `select` to avoid exponential row inflation.

## Transaction semantics (interactive vs sequential)

Prisma 6 offers two transaction modes. The sequential API (`prisma.$transaction([op1, op2])`) submits all operations in a single SQL transaction and is appropriate when each operation is independent and does not need the result of a prior step. The interactive API (`prisma.$transaction(async (tx) => { ... })`) gives a transaction-scoped client and lets operations read intermediate state; use it when a write's arguments depend on a prior read within the same transaction (for example, conditional balance updates or idempotency checks).

Reads inside an interactive transaction run at a consistent snapshot, preventing phantom reads from concurrent writers during the transaction body. Set the `maxWait` and `timeout` options to avoid holding locks indefinitely: a stalled interactive transaction will block any writer touching the same rows. For long-running background operations, prefer a series of short-lived transactions with progress tracking over a single large transaction that holds locks for minutes.

## Migration safety (locks, backfills, downtime)

PostgreSQL DDL operations acquire locks that can block production traffic. `ALTER TABLE ... ADD COLUMN NOT NULL DEFAULT` acquires `ACCESS EXCLUSIVE` and rewrites the table on Postgres versions before 11; on Postgres 16 this is cheaper but still locks. The safe pattern is a three-phase migration: add the column as nullable first, backfill in batches using `UPDATE ... WHERE id BETWEEN ? AND ?` with small page sizes, then add the `NOT NULL` constraint once every row is populated.

Column renames and type changes that break the Prisma client on the running version must be handled with expand-contract: add the new column, dual-write from application code, backfill, migrate reads, then drop the old column in a later migration. Index creation should use `CREATE INDEX CONCURRENTLY` in raw SQL migrations to avoid the table lock; Prisma's `@@index` directive triggers a blocking `CREATE INDEX` by default, so large tables need a manual migration file using `CONCURRENTLY`. Always verify migration rollback: Prisma migration history records the up step, but the down step must be authored manually and tested.

## Indexing strategy

Every column referenced in a `where`, `orderBy`, or `join` predicate on a high-cardinality table needs an index. Add `@@index([field])` or `@@index([field1, field2])` in `schema.prisma` and prefer composite indexes when queries filter on multiple columns together, because a composite index on `[status, createdAt]` serves both a `WHERE status = ?` and a `WHERE status = ? AND createdAt > ?` query, whereas two separate indexes do not combine as efficiently.

Partial indexes (not directly expressible in Prisma schema syntax but writable as raw SQL in a migration file) are valuable for filtered queries such as `WHERE status = 'PENDING'` on an orders table where pending rows are a small fraction. For `text` fields used in `contains` or `startsWith` queries, consider GIN indexes with `pg_trgm` rather than a B-tree index, which cannot accelerate substring matching. Unused indexes impose write overhead on every `INSERT`, `UPDATE`, and `DELETE`; audit with `pg_stat_user_indexes` and drop indexes with zero scans after a representative traffic period.

## When to drop to raw SQL (rare)

Prisma methods cover the vast majority of OLTP patterns. Raw SQL is justified when: the query requires a PostgreSQL-specific feature not exposed by Prisma (window functions, CTEs with `RETURNING`, `LATERAL` joins, advisory locks), or when an `EXPLAIN ANALYZE` confirms that a Prisma-generated query has a materially worse plan and the generated SQL cannot be guided to a better plan via `@@index` or query restructuring.

When dropping to raw SQL, always use the tagged `$queryRaw` template literal, never `$queryRawUnsafe`. Define a TypeScript type for the expected row shape and assert it at the call site. Run `EXPLAIN ANALYZE` in a staging environment with realistic data volumes to confirm the intended index is used. Add a comment citing the reason (feature gap or proven performance need) and a link to the Prisma issue or benchmark that justifies it. Treat every raw SQL block as technical debt: re-evaluate when Prisma adds the missing feature.

## Interactions with other skills

- **Owns:** query shape, transactions, migrations, indexes, raw SQL safety.
- **Hands off to:** `state-integrity-check` for cache invalidation after writes; `performance-budget-guard` for query p95 budgets.
- **Does not duplicate:** `architecture-guard`'s schema ownership.

## Review checklist (invoke when reviewing existing code)

Produce a markdown report with these sections:

1. **Summary** — one line: pass / concerns / blocking issues.
2. **Findings** — per issue: *File:line, severity (low/med/high), category, what's wrong, recommended fix*.
3. **Safer alternative** — if an anti-pattern is widespread, prescribe the replacement approach for the whole codebase.
4. **Checklist coverage** — for each rule below, mark: PASS / CONCERN / NOT APPLICABLE.
   - Rule 1: All queries carry explicit `select` — no bare `findMany` / `findUnique` returning full rows
   - Rule 2: No `await` inside a loop over Prisma calls — list every instance found
   - Rule 3: All multi-write operations wrapped in `prisma.$transaction`
   - Rule 4: Every `findMany` has a `take` — list every instance missing it
   - Rule 5: Every high-cardinality `where` field has a `@@index` in schema
   - Rule 6: Migrations avoid blocking DDL on large tables without a backfill strategy
   - Rule 7: No `$queryRawUnsafe` with user-controlled input — list every `$queryRawUnsafe` call found
   - Rule 8: No `prisma db push` in CI or deployment scripts

**Required explicit scans:**
- List every `findMany` call missing a `take` argument.
- List every `await` inside a loop body (`for`, `forEach`, `map`, `reduce`) that references a Prisma model.
- List every `$queryRawUnsafe` call site with its file and line number.
