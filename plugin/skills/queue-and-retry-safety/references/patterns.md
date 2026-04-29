# Queue and retry safety — deep dives

Reference for implementation details. The lean `SKILL.md` states the Core rules; this file explains *how* to apply them with code examples, worked patterns, and edge-case coverage.

---

## At-least-once reality

SQS guarantees that every message is delivered *at least* once. It does not guarantee exactly-once delivery, and it does not guarantee that two consumers will not process the same message simultaneously if a visibility timeout expires mid-flight.

The delivery model works like this: when a consumer calls `ReceiveMessage`, SQS hides the message for the duration of the visibility timeout. If the consumer does not call `DeleteMessage` before the timeout expires, SQS makes the message visible again and another consumer (or the same one) picks it up. This means duplicates occur in three common situations:

1. **Processing takes longer than the visibility timeout.** The message becomes visible while the first consumer is still working. A second consumer starts. Both finish and both call `DeleteMessage` — the second call is a no-op, but both have already executed their side effects.
2. **The consumer crashes after executing side effects but before deleting the message.** Lambda is killed, the container is terminated, or the process receives SIGTERM mid-flight. SQS re-delivers after the timeout.
3. **Manual redrive from a DLQ.** Operations teams or automated tooling replay messages from a DLQ back to the main queue. Every message in the DLQ will be delivered again, including messages that partially succeeded before failing.

The correct mental model: assume *every* message will be delivered at least twice and design accordingly. Idempotency is not an optimisation — it is a correctness requirement.

EventBridge has a similar model for cross-account event delivery and for EventBridge Pipes. SNS-to-SQS fan-out compounds the issue: SNS delivers to each SQS subscription at-least-once, and SQS then delivers to consumers at-least-once, so the effective duplication window multiplies.

---

## Idempotency key patterns

An idempotency key is a stable, unique identifier for a logical operation. The consumer records that it has processed this key before executing the side effect, and skips re-execution on subsequent deliveries of the same message.

**Choosing the key.** The key must be stable across retries — the same logical event must produce the same key every time it is delivered. Good candidates: `MessageId` (SQS assigns this; it survives redrive from a DLQ), a domain ID embedded in the payload (`orderId`, `paymentId`), or a composite of event type + domain ID (`ORDER_PLACED:ord-abc123`). Do not use a hash of the full payload — payload enrichment or minor schema changes will change the hash and defeat deduplication.

**Scope of protection.** The idempotency check must cover the entire unit of work, not individual sub-steps. If a consumer charges a card, creates an order, and sends a confirmation email, the idempotency key must gate all three — not just the first. A partial completion followed by a retry will otherwise skip the charge (already done) but repeat the email.

### Postgres unique constraint (recommended when already writing to Postgres)

Wrap the idempotency insert and the business write in a single transaction so they commit atomically:

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

**Bad — marks processed *after* the side effect, giving no protection against a concurrent duplicate:**

```typescript
// BAD: no deduplication — a duplicate delivery runs the entire body again
async function handleOrderPlaced(msg: unknown): Promise<void> {
  const { orderId, customerId, amount } = OrderPlacedSchema.parse(msg);

  await chargeCustomer(customerId, amount);   // runs twice on duplicate delivery
  await createOrder(orderId, customerId);      // second insert throws or silently no-ops
}
```

**Good — stores the idempotency key atomically with the side effect; a duplicate delivery is detected before any work is done:**

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

### DynamoDB conditional write (for Lambda consumers without a relational database)

DynamoDB with `attribute_not_exists(pk)` provides the same atomic guarantee. Set a TTL attribute (`ttl`, epoch seconds) to auto-expire records after a safe window (7–30 days). The table is cheap: it holds only a key, a timestamp, and a TTL — no business data.

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

### SQS FIFO built-in deduplication (publisher-side only)

SQS FIFO queues offer a built-in 5-minute deduplication window when you set `MessageDeduplicationId`. This is useful for publisher-side deduplication (preventing the same event from entering the queue twice within 5 minutes) but is *not* a substitute for consumer-side idempotency. A message redriven from a DLQ 6 minutes later will be delivered again, and nothing about FIFO deduplication will stop it.

---

## Visibility timeout and heartbeating

The visibility timeout is the lease duration SQS grants to a consumer. If processing does not complete and `DeleteMessage` is not called within this window, SQS considers the consumer dead and re-delivers the message.

**Setting the right timeout.** The visibility timeout must be greater than the worst-case processing duration, including downstream network calls, database writes, and any file I/O. Add a buffer of at least 20–30 % on top of the P99 processing time. Set this on the queue itself (not on the individual `ReceiveMessage` call), so new consumers inherit it automatically. A sensible default for most workloads is 5–10 minutes. For jobs that may take longer, heartbeating is mandatory.

**Lambda-specific considerations.** Lambda's execution timeout caps at 15 minutes. Set the SQS visibility timeout to at least 6 times the Lambda function timeout (AWS recommendation for event-source mappings) to give the retry mechanism room to operate. For Lambda, the managed event-source mapping handles deletion on success; the consumer only needs to heartbeat if it makes external calls that may approach the function timeout.

**What heartbeating does not fix.** Heartbeating prevents re-delivery due to timeout expiry, but it does not prevent re-delivery if the consumer process crashes. The heartbeat stops when the process dies, the timeout elapses, and SQS re-delivers. Consumer-side idempotency is still the primary protection; heartbeating is a secondary guard that prevents unnecessary duplicates caused by slow-but-successful processing.

### Heartbeat during long job vs single long processing step

**Bad — processes a large batch in one blocking step; if it takes longer than the visibility timeout SQS re-delivers:**

```typescript
// BAD: a 10-minute export inside a 30-second visibility timeout
// SQS will re-deliver at ~30s, causing two concurrent executions
async function handleExportJob(msg: SQSMessage): Promise<void> {
  const { reportId } = ReportJobSchema.parse(JSON.parse(msg.Body!));
  await generateLargeReport(reportId);  // takes 10 minutes
  // message becomes visible again at 30s — another worker starts the same report
}
```

**Good — extends the visibility lease on a regular interval while the long job runs:**

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

Always clear the interval in a `finally` block. A leaked interval will attempt to extend the visibility of a deleted message, which SQS will reject with `InvalidParameterValue` — a noisy but harmless error that pollutes logs.

**Heartbeat interval formula.** Call `ChangeMessageVisibility` at roughly two-thirds of the current timeout to extend the lease. Each call resets the visibility timer to the value you specify. There is no upper bound on how many times you can extend it:

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

---

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

**CloudWatch alarm on DLQ depth.** An alarm on `ApproximateNumberOfMessagesVisible` for the DLQ with a threshold of 1 (alert on the *first* failed message) and an SNS action to page the on-call engineer is the minimum acceptable setup:

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

---

## Ordering caveats (FIFO, MessageGroupId, retries)

Standard SQS queues deliver messages in approximately FIFO order under normal conditions but make no ordering guarantees. High throughput, retries, and multi-consumer deployments all break the apparent order.

**FIFO queues.** SQS FIFO queues guarantee strict ordering within a `MessageGroupId`. Messages with the same group ID are delivered in the order they were sent, and only one message from each group is in-flight at a time. This strict ordering comes at a cost: if a message fails and exhausts its retries, all subsequent messages in the same group are blocked until the failing message moves to the DLQ. A single poison message can stall an entire group indefinitely.

**Choosing `MessageGroupId`.** Group by the entity that must be processed in order — typically a customer ID, order ID, or device ID. Do not use a single global group ID for all messages; that eliminates all parallelism. Do not use a random UUID per message; that provides no ordering and adds overhead.

**Retries break FIFO order within a group.** If message 3 fails and is retried after messages 4 and 5 have been delivered to the DLQ (because they were in different groups), the logical ordering for the entity appears broken. Consumers must not assume that a FIFO-delivered message represents the current state; they must compare sequence numbers, event timestamps, or version fields from the payload.

**EventBridge ordering.** EventBridge does not guarantee ordering. Events from the same source may arrive at a target in any order, and parallel invocations of the same Lambda function may process events with overlapping time ranges. Consumers must be idempotent and must not assume the most recently delivered event is the most recently produced one.

**Practical recommendation.** Unless the business requirement explicitly demands strict ordering (e.g., a state machine that must process events A → B → C in sequence), prefer a standard queue with consumer-side idempotency. FIFO queues add operational complexity — blocking on poison messages, lower throughput ceiling (3,000 messages/second with batching vs 30,000+ for standard) — that is rarely worth the benefit for workloads that are already idempotent.
