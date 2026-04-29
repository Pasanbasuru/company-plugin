---
name: queue-and-retry-safety
description: Use when publishing to or consuming from SQS, EventBridge, or any message queue; also for background jobs with retry semantics. Do NOT use for in-process retries of a function call (use `resilience-and-error-handling`). Covers at-least-once delivery, idempotency keys, DLQ strategy, poison message handling, visibility timeout, ordering.
allowed-tools: Read, Grep, Glob, Bash
---

# Queue and retry safety

## Purpose & scope

Queues are at-least-once by default — duplicate and out-of-order messages are a normal operating condition, not an edge case. Every piece of code that touches a queue must tolerate them without data corruption, double-billing, or phantom state. This skill enforces the disciplines that make consumers safe: idempotency keys, DLQ topology, visibility timeout management, and correct ordering assumptions.

Apply this skill whenever touching SQS consumers, EventBridge rules, Lambda event-source mappings, BullMQ workers, or any other async job processor.

## Assumes `baseline-standards`. Adds:

Queue-specific delivery semantics — at-least-once handling, idempotency keys, DLQs, visibility timeout tuning, FIFO ordering caveats, and payload versioning at the consumer boundary.

## Core rules

1. **Every consumer is idempotent.** Either the operation is naturally idempotent (e.g., `SET` is idempotent; `INCREMENT` is not), or an idempotency key is stored and checked before proceeding. — *Why:* SQS guarantees at-least-once delivery. Network hiccups, Lambda timeouts, and manual redrive from a DLQ all produce duplicates. A consumer that runs twice must produce the same final state as one that ran once.

2. **Every queue has a DLQ; every DLQ has an alarm.** No queue ships without a dead-letter queue and a CloudWatch alarm on `ApproximateNumberOfMessagesVisible` for that DLQ. — *Why:* without a DLQ, poison messages trigger infinite retries and jam the entire queue. Without an alarm, failed messages sit silently and the system appears healthy while work is lost.

3. **Visibility timeout exceeds max expected processing time plus a safety buffer.** For jobs that may run longer than the timeout, the consumer heartbeats with `ChangeMessageVisibility` to extend the lease. — *Why:* if processing time exceeds the visibility timeout, SQS makes the message visible again and a second consumer picks it up — creating a duplicate mid-execution, not just at the start.

4. **Poison messages fail fast and preserve error context.** After `maxReceiveCount` retries, the message lands in the DLQ. The original error (message, stack, attempt count) must be retrievable — either in message attributes, a companion log entry keyed by `MessageId`, or both. — *Why:* a DLQ message with no diagnostic context is nearly impossible to triage. The on-call engineer needs to know *why* the message failed, not just that it did.

5. **Ordering is not assumed unless using FIFO with an explicit `MessageGroupId`; even then, retries break order within a group.** Standard queues offer best-effort ordering only. — *Why:* assuming order in a standard queue causes subtle, hard-to-reproduce bugs when messages arrive out of sequence under load. FIFO does not fully fix this either — a failed message blocks all subsequent messages in its group until it exhausts retries.

6. **Payloads are versioned and validated by the consumer using Zod or equivalent.** The consumer never trusts the payload shape; it parses at the boundary and rejects invalid payloads with a structured error before any side effect occurs. — *Why:* publishers evolve; a schema change on the publisher side must not silently corrupt consumer state. Early rejection prevents partial writes and produces a clear DLQ entry rather than corrupt data.

7. **Publishers include a `correlationId` propagated from the originating request.** The `correlationId` flows from HTTP request → queue message → consumer logs → any downstream calls. — *Why:* distributed traces break at async boundaries without explicit correlation. When a DLQ alarm fires at 3 AM, the on-call engineer must be able to find the originating request in seconds.

## Red flags

| Thought | Reality |
|---|---|
| "The consumer just does the thing" | Duplicates silently double-apply. A second delivery of an "order placed" message creates a second order, double-charges the card, or ships the item twice. |
| "Visibility timeout is the default (30 s)" | Long jobs re-fire before they finish. Two instances run concurrently, both commit, and the idempotency check (if it exists) races between them. |
| "No DLQ — we retry forever" | A poison message with a permanent error (bad schema, missing FK) jams the queue indefinitely. Every subsequent message backs up behind it. |

## Good vs bad

### Idempotency key stored and checked vs naive mark-processed

Bad — marks processed *after* the side effect, giving no protection against a concurrent duplicate:

```typescript
// BAD: no deduplication — a duplicate delivery runs the entire body again
async function handleOrderPlaced(msg: unknown): Promise<void> {
  const { orderId, customerId, amount } = OrderPlacedSchema.parse(msg);

  await chargeCustomer(customerId, amount);   // runs twice on duplicate delivery
  await createOrder(orderId, customerId);      // second insert throws or silently no-ops
}
```

Good — stores the idempotency key atomically with the side effect; a duplicate delivery is detected before any work is done:

```typescript
// GOOD: atomic upsert on idempotency key; duplicate delivery is a no-op
async function handleOrderPlaced(msg: unknown): Promise<void> {
  const { orderId, customerId, amount } = OrderPlacedSchema.parse(msg);

  // Postgres unique constraint on (idempotency_key) — concurrent inserts: one wins, one throws
  const inserted = await db.$executeRaw`
    INSERT INTO processed_events (idempotency_key, processed_at)
    VALUES (${orderId}, NOW())
    ON CONFLICT (idempotency_key) DO NOTHING
  `;

  if (inserted === 0) {
    logger.info({ orderId }, 'Duplicate message detected — skipping');
    return;
  }

  await chargeCustomer(customerId, amount);
  await createOrder(orderId, customerId);
}
```

For DynamoDB-backed idempotency and the heartbeat pattern for long-running jobs, see `references/patterns.md`.

## Interactions with other skills

- **Owns:** queue delivery semantics, retry policy for queue consumers, DLQ topology, visibility timeout management.
- **Hands off to:** `integration-contract-safety` for payload schema versioning and consumer contract; `resilience-and-error-handling` for in-process retry of downstream HTTP or RPC calls made *from within* the consumer; `observability-first-debugging` for DLQ alarm runbooks and trace correlation.
- **Does not duplicate:** `prisma-data-access-guard`'s transaction semantics — though the two skills interact when the idempotency store is Postgres.

## Review checklist

### Summary

One line: pass / concerns / blocking issues. Name the reviewed surface (consumer file, CDK stack, queue configuration) and the overall verdict in a single sentence so a reader can scan the result without reading further.

### Findings

One bullet per finding: `path/to/file.ts:42` — **severity** (blocking | concern | info) — *category* (idempotency | DLQ | visibility | ordering | schema | correlation) — what is wrong, recommended fix. Include per-consumer observations as examples (e.g., missing idempotency key before `chargeCustomer`, DLQ exists but no CloudWatch alarm, visibility timeout is 30 s for a job that may run 5 minutes). Append any queue state output checked during review inside this same section.

### Safer alternative

Queue-specific guidance for the specific risk found. See `references/review-checklist.md` for the standard safer-alternative text covering ordered-critical domains, poison-message-prone domains, and long-running jobs.

### Checklist coverage

Mark each Core rule PASS / CONCERN / NOT APPLICABLE with a one-line justification. See `references/review-checklist.md` for the full coverage table, required explicit scans, and severity definitions.

---

*For detailed code patterns (at-least-once delivery model, idempotency key strategies, DynamoDB conditional write, heartbeat interval formula, DLQ topology, FIFO/ordering caveats), see `references/patterns.md`. For the full PR review checklist with the coverage table and severity definitions, see `references/review-checklist.md`.*
