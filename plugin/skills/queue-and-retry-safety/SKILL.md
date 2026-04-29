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
    // Already processed — this is a duplicate delivery; safe to return
    logger.info({ orderId }, 'Duplicate message detected — skipping');
    return;
  }

  // Now execute the side effects exactly once
  await chargeCustomer(customerId, amount);
  await createOrder(orderId, customerId);
}
```

Alternatively, DynamoDB conditional write:

```typescript
import { DynamoDBClient, PutItemCommand, ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';

const dynamo = new DynamoDBClient({});

async function markProcessedOrThrow(messageId: string): Promise<boolean> {
  try {
    await dynamo.send(new PutItemCommand({
      TableName: process.env.IDEMPOTENCY_TABLE,
      Item: {
        pk:           { S: messageId },
        processedAt:  { S: new Date().toISOString() },
        ttl:          { N: String(Math.floor(Date.now() / 1000) + 86400 * 7) }, // 7-day TTL
      },
      ConditionExpression: 'attribute_not_exists(pk)',
    }));
    return true;  // first time — proceed
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return false;  // duplicate — skip
    }
    throw err;
  }
}
```

### Heartbeat during long job vs single long processing step

Bad — processes a large batch in one blocking step; if it takes longer than the visibility timeout SQS re-delivers:

```typescript
// BAD: a 10-minute export inside a 30-second visibility timeout
// SQS will re-deliver at ~30s, causing two concurrent executions
async function handleExportJob(msg: SQSMessage): Promise<void> {
  const { reportId } = ReportJobSchema.parse(JSON.parse(msg.Body!));
  await generateLargeReport(reportId);  // takes 10 minutes
  // message becomes visible again at 30s — another worker starts the same report
}
```

Good — extends the visibility lease on a regular interval while the long job runs:

```typescript
import { SQSClient, ChangeMessageVisibilityCommand } from '@aws-sdk/client-sqs';

const sqs = new SQSClient({});

async function handleExportJob(msg: SQSMessage): Promise<void> {
  const { reportId } = ReportJobSchema.parse(JSON.parse(msg.Body!));

  // Heartbeat: extend visibility every 25s (well before the 30s timeout)
  const heartbeatInterval = setInterval(async () => {
    try {
      await sqs.send(new ChangeMessageVisibilityCommand({
        QueueUrl:          process.env.QUEUE_URL!,
        ReceiptHandle:     msg.ReceiptHandle!,
        VisibilityTimeout: 60,  // extend by 60 seconds each tick
      }));
    } catch (err) {
      // Log but do not crash the job — the extension is best-effort
      logger.warn({ err, reportId }, 'Failed to extend visibility timeout');
    }
  }, 25_000);

  try {
    await generateLargeReport(reportId);
  } finally {
    clearInterval(heartbeatInterval);
  }
}
```

## At-least-once reality

SQS guarantees that every message is delivered *at least* once. It does not guarantee exactly-once delivery, and it does not guarantee that two consumers will not process the same message simultaneously if a visibility timeout expires mid-flight.

The delivery model works like this: when a consumer calls `ReceiveMessage`, SQS hides the message for the duration of the visibility timeout. If the consumer does not call `DeleteMessage` before the timeout expires, SQS makes the message visible again and another consumer (or the same one) picks it up. This means duplicates occur in three common situations:

1. **Processing takes longer than the visibility timeout.** The message becomes visible while the first consumer is still working. A second consumer starts. Both finish and both call `DeleteMessage` — the second call is a no-op, but both have already executed their side effects.
2. **The consumer crashes after executing side effects but before deleting the message.** Lambda is killed, the container is terminated, or the process receives SIGTERM mid-flight. SQS re-delivers after the timeout.
3. **Manual redrive from a DLQ.** Operations teams or automated tooling replay messages from a DLQ back to the main queue. Every message in the DLQ will be delivered again, including messages that partially succeeded before failing.

The correct mental model: assume *every* message will be delivered at least twice and design accordingly. Idempotency is not an optimisation — it is a correctness requirement.

EventBridge has a similar model for cross-account event delivery and for EventBridge Pipes. SNS-to-SQS fan-out compounds the issue: SNS delivers to each SQS subscription at-least-once, and SQS then delivers to consumers at-least-once, so the effective duplication window multiplies.

## Idempotency key patterns

An idempotency key is a stable, unique identifier for a logical operation. The consumer records that it has processed this key before executing the side effect, and skips re-execution on subsequent deliveries of the same message.

**Choosing the key.** The key must be stable across retries — the same logical event must produce the same key every time it is delivered. Good candidates: `MessageId` (SQS assigns this; it survives redrive from a DLQ), a domain ID embedded in the payload (`orderId`, `paymentId`), or a composite of event type + domain ID (`ORDER_PLACED:ord-abc123`). Do not use a hash of the full payload — payload enrichment or minor schema changes will change the hash and defeat deduplication.

**Storing the key — Postgres unique constraint.** The cheapest approach if the consumer already writes to Postgres is an `INSERT ... ON CONFLICT DO NOTHING` on a `processed_events` table with a unique index on `idempotency_key`. Wrap the idempotency insert and the business write in a single transaction so they commit atomically:

```sql
BEGIN;
  INSERT INTO processed_events (idempotency_key, processed_at)
  VALUES ($1, NOW())
  ON CONFLICT (idempotency_key) DO NOTHING;

  -- Only proceed if the insert actually wrote a row
  -- Application checks affected row count; if 0 -> ROLLBACK and return
  INSERT INTO orders (id, customer_id, amount, created_at)
  VALUES ($2, $3, $4, NOW());
COMMIT;
```

Add a `processed_at` column and a partial index or TTL strategy to prune old rows. A 30-day window covers any realistic redrive scenario.

**Storing the key — DynamoDB conditional write.** For Lambda consumers without a relational database, DynamoDB with `attribute_not_exists(pk)` provides the same atomic guarantee. Set a TTL attribute (`ttl`, epoch seconds) to auto-expire records after a safe window (7–30 days). The table is cheap: it holds only a key, a timestamp, and a TTL — no business data.

**Storing the key — SQS FIFO deduplication.** SQS FIFO queues offer a built-in 5-minute deduplication window when you set `MessageDeduplicationId`. This is useful for publisher-side deduplication (preventing the same event from entering the queue twice within 5 minutes) but is *not* a substitute for consumer-side idempotency. A message redriven from a DLQ 6 minutes later will be delivered again, and nothing about FIFO deduplication will stop it.

**Scope of protection.** The idempotency check must cover the entire unit of work, not individual sub-steps. If a consumer charges a card, creates an order, and sends a confirmation email, the idempotency key must gate all three — not just the first. A partial completion followed by a retry will otherwise skip the charge (already done) but repeat the email.

## Visibility timeout and heartbeating

The visibility timeout is the lease duration SQS grants to a consumer. If processing does not complete and `DeleteMessage` is not called within this window, SQS considers the consumer dead and re-delivers the message.

**Setting the right timeout.** The visibility timeout must be greater than the worst-case processing duration, including downstream network calls, database writes, and any file I/O. Add a buffer of at least 20–30 % on top of the P99 processing time. Set this on the queue itself (not on the individual `ReceiveMessage` call), so new consumers inherit it automatically. A sensible default for most workloads is 5–10 minutes. For jobs that may take longer, heartbeating is mandatory.

**Heartbeating with `ChangeMessageVisibility`.** Call `ChangeMessageVisibility` on a regular interval — at roughly two-thirds of the current timeout — to extend the lease. Each call resets the visibility timer to the value you specify. There is no upper bound on how many times you can extend it:

```typescript
// The heartbeat fires at (timeout * 0.66) intervals.
// If timeout is 60s, the interval should be ~40s.
const VISIBILITY_TIMEOUT_SECONDS = 60;
const HEARTBEAT_INTERVAL_MS = (VISIBILITY_TIMEOUT_SECONDS * 0.66) * 1000;

function startHeartbeat(queueUrl: string, receiptHandle: string): NodeJS.Timeout {
  return setInterval(async () => {
    await sqs.send(new ChangeMessageVisibilityCommand({
      QueueUrl:          queueUrl,
      ReceiptHandle:     receiptHandle,
      VisibilityTimeout: VISIBILITY_TIMEOUT_SECONDS,
    }));
  }, HEARTBEAT_INTERVAL_MS);
}
```

Always clear the interval in a `finally` block. A leaked interval will attempt to extend the visibility of a deleted message, which SQS will reject with `InvalidParameterValue` — a noisy but harmless error that pollutes logs.

**What heartbeating does not fix.** Heartbeating prevents re-delivery due to timeout expiry, but it does not prevent re-delivery if the consumer process crashes. The heartbeat stops when the process dies, the timeout elapses, and SQS re-delivers. Consumer-side idempotency is still the primary protection; heartbeating is a secondary guard that prevents unnecessary duplicates caused by slow-but-successful processing.

**Lambda-specific considerations.** Lambda's execution timeout caps at 15 minutes. Set the SQS visibility timeout to at least 6 times the Lambda function timeout (AWS recommendation for event-source mappings) to give the retry mechanism room to operate. For Lambda, the managed event-source mapping handles deletion on success; the consumer only needs to heartbeat if it makes external calls that may approach the function timeout.

## DLQ topology and alarms

A dead-letter queue is the destination for messages that have exhausted all retries. Every queue — main, retry, or fan-out — must have a DLQ. A DLQ without an alarm is a silent data sink.

**Queue-level DLQ configuration.** Set the `RedrivePolicy` on the source queue:

```json
{
  "deadLetterTargetArn": "arn:aws:sqs:us-east-1:123456789012:my-queue-dlq",
  "maxReceiveCount": 5
}
```

`maxReceiveCount` of 3–5 is a good default for most workloads. Lower values (1–2) make sense for operations that are expensive or have external side effects. Higher values (10+) are rarely justified and indicate the consumer logic should be improved instead.

**CloudWatch alarm on DLQ depth.** An alarm on `ApproximateNumberOfMessagesVisible` for the DLQ with a threshold of 1 (alert on the *first* failed message) and an `SNS` action to page the on-call engineer is the minimum acceptable setup:

```typescript
// AWS CDK example
new cloudwatch.Alarm(this, 'DlqAlarm', {
  metric: dlq.metricApproximateNumberOfMessagesVisible({
    period: cdk.Duration.minutes(1),
    statistic: 'Maximum',
  }),
  threshold:          1,
  evaluationPeriods:  1,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
  alarmDescription:   `Messages in DLQ for ${queueName} — investigate immediately`,
  treatMissingData:   cloudwatch.TreatMissingData.NOT_BREACHING,
});
```

**Preserving error context.** When a message lands in the DLQ it carries only its original body and attributes. The error that caused the failure is not automatically attached. Preserve diagnostic context in one of two ways:

1. **Structured log entry keyed by `MessageId`.** On each failed attempt, log `{ messageId, attemptNumber, error: { message, stack }, correlationId }` to your structured log sink. The DLQ alarm links to CloudWatch Logs Insights where the on-call engineer filters by `messageId`.
2. **Message attributes on redrive.** Write a custom Lambda that moves messages from DLQ to a companion table (DynamoDB or Postgres) before deleting them, preserving body + error metadata. This is heavier but enables programmatic triage tooling.

**Redrive strategy.** DLQ messages should not be automatically redriven without human review — a bug that caused the original failure is likely still present. The standard workflow is: alarm fires → engineer investigates → root cause fixed → messages redriven. AWS SQS console and the `StartMessageMoveTask` API both support redrive. Redrive executes idempotency checks again, so a correct consumer handles redriven messages safely.

**EventBridge DLQ.** EventBridge rules also support a DLQ (`DeadLetterConfig.Arn`). Set one on every rule that targets a Lambda or SQS queue. EventBridge will route failed event deliveries here rather than dropping them silently. The same alarm pattern applies.

## Ordering caveats (FIFO, MessageGroupId, retries)

Standard SQS queues deliver messages in approximately FIFO order under normal conditions but make no ordering guarantees. High throughput, retries, and multi-consumer deployments all break the apparent order.

**FIFO queues.** SQS FIFO queues guarantee strict ordering within a `MessageGroupId`. Messages with the same group ID are delivered in the order they were sent, and only one message from each group is in-flight at a time. This strict ordering comes at a cost: if a message fails and exhausts its retries, all subsequent messages in the same group are blocked until the failing message moves to the DLQ. A single poison message can stall an entire group indefinitely.

**Choosing `MessageGroupId`.** Group by the entity that must be processed in order — typically a customer ID, order ID, or device ID. Do not use a single global group ID for all messages; that eliminates all parallelism. Do not use a random UUID per message; that provides no ordering and adds overhead.

**Retries break FIFO order within a group.** If message 3 fails and is retried after messages 4 and 5 have been delivered to the DLQ (because they were in different groups), the logical ordering for the entity appears broken. Consumers must not assume that a FIFO-delivered message represents the current state; they must compare sequence numbers, event timestamps, or version fields from the payload.

**EventBridge ordering.** EventBridge does not guarantee ordering. Events from the same source may arrive at a target in any order, and parallel invocations of the same Lambda function may process events with overlapping time ranges. Consumers must be idempotent and must not assume the most recently delivered event is the most recently produced one.

**Practical recommendation.** Unless the business requirement explicitly demands strict ordering (e.g., a state machine that must process events A → B → C in sequence), prefer a standard queue with consumer-side idempotency. FIFO queues add operational complexity — blocking on poison messages, lower throughput ceiling (3,000 messages/second with batching vs 30,000+ for standard) — that is rarely worth the benefit for workloads that are already idempotent.

## Interactions with other skills

- **Owns:** queue delivery semantics, retry policy for queue consumers, DLQ topology, visibility timeout management.
- **Hands off to:** `integration-contract-safety` for payload schema versioning and consumer contract; `resilience-and-error-handling` for in-process retry of downstream HTTP or RPC calls made *from within* the consumer; `observability-first-debugging` for DLQ alarm runbooks and trace correlation.
- **Does not duplicate:** `prisma-data-access-guard`'s transaction semantics — though the two skills interact when the idempotency store is Postgres.

## Review checklist

Produce a markdown report with these sections:

1. **Summary** — one line: pass / concerns / blocking issues.
2. **Findings** — per issue: *file:line, severity (low/med/high), category (idempotency / DLQ / visibility / ordering / schema / correlation), fix*. Include per-consumer observations here as examples, e.g.:
   - `apps/orders/src/consumers/order-placed.ts:42, high, idempotency, consumer processes OrderPlaced from SQS standard queue with no idempotency key visible — add INSERT ... ON CONFLICT DO NOTHING on a processed_events table keyed by orderId before chargeCustomer.`
   - `infra/cdk/lib/payments-stack.ts:118, high, DLQ, payments-queue has a DLQ but no CloudWatch alarm on ApproximateNumberOfMessagesVisible — add an alarm at threshold 1.`
   - `apps/reports/src/consumers/export.ts:30, med, visibility, generateLargeReport may exceed the 30s visibility timeout with no ChangeMessageVisibility heartbeat — either raise the timeout to cover P99 or add a 25s heartbeat interval.`
3. **Safer alternative** — queue-specific guidance for the specific risk found. Examples:
   - For ordered-critical domains (state machines, per-entity event streams): prefer SQS FIFO with `MessageGroupId` + content-based deduplication over a standard queue plus hand-rolled app-level idempotency — the FIFO 5-minute dedup window catches publisher-side duplicates before they ever reach the consumer.
   - For poison-message-prone domains (schema drift from third-party publishers, financial side effects): prefer manual triage + redrive over automatic DLQ redrive — a redrive Lambda that replays without human review will re-run the same failing message once the root cause is still present, doubling the blast radius.
   - For long-running jobs: prefer raising the queue-level visibility timeout to cover P99 processing time over relying solely on `ChangeMessageVisibility` heartbeats — a heartbeat that stops (process crash, event-loop starvation) still loses the lease, whereas a generous base timeout survives those failures.
4. **Checklist coverage** — for each of the 7 core rules, mark: PASS / CONCERN / NOT APPLICABLE.
   - Rule 1: Every consumer is idempotent (naturally or via stored key)
   - Rule 2: Every queue has a DLQ; every DLQ has a CloudWatch alarm
   - Rule 3: Visibility timeout exceeds max processing time; heartbeat present for long jobs
   - Rule 4: Poison messages fail fast and error context is preserved
   - Rule 5: Ordering is not assumed (or FIFO is used correctly with MessageGroupId)
   - Rule 6: Payloads are versioned and validated at the consumer boundary (Zod or equivalent)
   - Rule 7: Publishers include a `correlationId` propagated from the originating request
