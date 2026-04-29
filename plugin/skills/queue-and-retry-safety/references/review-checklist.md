# Queue and retry safety — PR review checklist (full form)

Use this file when producing a complete queue safety review report. The lean `SKILL.md` lists only the section headings and shape; this file provides the full checklist coverage table, required explicit scans, and severity definitions.

---

## Review report structure

### Summary

One line: pass / concerns / blocking issues. Name the reviewed surface (consumer file, CDK stack, queue configuration) and the overall verdict in a single sentence so a reader can scan the result without reading further.

### Findings

One bullet per finding, in this shape:

- `path/to/file.ts:42` — **severity** (blocking | concern | info) — *category* (idempotency | DLQ | visibility | ordering | schema | correlation) — what is wrong, recommended fix.

Flag every consumer with no idempotency key, every queue with no DLQ or no alarm, every visibility timeout that looks too short for the job's actual processing time, every missing `correlationId` propagation, and every payload parsed without schema validation — each with its exact `file:line`.

**Queue output captures belong in this section.** If you ran `aws sqs get-queue-attributes` or checked a CloudWatch dashboard to verify alarm state or message depths, append the relevant output as a fenced block or sub-list under a `**queue state**` paragraph. If no queue output was checked, note this explicitly and explain why.

### Safer alternative

For ordered-critical domains (state machines, per-entity event streams): prefer SQS FIFO with `MessageGroupId` + content-based deduplication over a standard queue plus hand-rolled app-level idempotency — the FIFO 5-minute dedup window catches publisher-side duplicates before they ever reach the consumer.

For poison-message-prone domains (schema drift from third-party publishers, financial side effects): prefer manual triage + redrive over automatic DLQ redrive — a redrive Lambda that replays without human review will re-run the same failing message once the root cause is still present, doubling the blast radius.

For long-running jobs: prefer raising the queue-level visibility timeout to cover P99 processing time over relying solely on `ChangeMessageVisibility` heartbeats — a heartbeat that stops (process crash, event-loop starvation) still loses the lease, whereas a generous base timeout survives those failures.

### Checklist coverage

Mark each Core rule as PASS / CONCERN / NOT APPLICABLE with a short justification.

---

## Checklist coverage table

| # | Rule | Status | Notes |
|---|------|--------|-------|
| 1 | Every consumer is idempotent — either naturally or via a stored idempotency key checked before any side effect. | PASS / CONCERN / N/A | |
| 2 | Every queue has a DLQ; every DLQ has a CloudWatch alarm on `ApproximateNumberOfMessagesVisible` at threshold 1. | PASS / CONCERN / N/A | |
| 3 | Visibility timeout exceeds max expected processing time plus a safety buffer; long jobs heartbeat with `ChangeMessageVisibility`. | PASS / CONCERN / N/A | |
| 4 | Poison messages fail fast and error context (message, stack, attempt count) is preserved — either via structured logs keyed by `MessageId` or message attributes. | PASS / CONCERN / N/A | |
| 5 | Ordering is not assumed unless using FIFO with an explicit `MessageGroupId`; consumers tolerate out-of-order delivery. | PASS / CONCERN / N/A | |
| 6 | Payloads are parsed at the consumer boundary with Zod or equivalent; invalid payloads are rejected before any side effect occurs. | PASS / CONCERN / N/A | |
| 7 | Publishers include a `correlationId` propagated from the originating request and threaded through consumer logs and downstream calls. | PASS / CONCERN / N/A | |

---

## Required explicit scans

In addition to the rule-by-rule table, every review must explicitly scan for these common failure patterns:

- **Missing idempotency key** — for every consumer that writes to a database, charges a payment method, sends an email, or calls a third-party API, verify an idempotency record is inserted before those calls execute. Grep for the handler function and trace the execution path from parse to side effect.
- **Queue without DLQ** — grep CDK/CloudFormation/Terraform for `Queue` constructs and verify each has a `RedrivePolicy` or `deadLetterQueue` property. Flag any that are absent.
- **DLQ without alarm** — grep for `Alarm` constructs; for each DLQ, verify a corresponding alarm exists on `ApproximateNumberOfMessagesVisible`. Check that the SNS topic or action on the alarm actually pages the on-call channel.
- **Default visibility timeout (30 s)** — grep for `visibilityTimeout` or `VisibilityTimeout` in queue config. A missing value or `cdk.Duration.seconds(30)` is a finding unless the consumer is provably fast (<10 s P99).
- **No heartbeat for long jobs** — for consumers that do heavy I/O, large report generation, or batch DB operations, grep for `ChangeMessageVisibilityCommand` or equivalent. Absence is a finding.
- **Payload parsed after side effects** — grep for `JSON.parse` or `Schema.parse` calls within consumer handlers; verify they occur before any `await` that mutates state.
- **Missing `correlationId` propagation** — grep consumer handlers for `correlationId` usage; verify it is extracted from the message and passed to logger and downstream HTTP/queue calls.
- **Standard queue with ordering assumption** — grep for array-position logic, sequential numbering, or "previous event" references in standard-queue consumers; flag as a concern unless the consumer is idempotent and order-independent.

---

## Severity definitions

| Severity | Meaning |
|----------|---------|
| **blocking** | A gap that permits data corruption, double-billing, duplicate orders, or silent data loss under normal operating conditions (retries, redrive, Lambda timeout). Must be fixed before merge. |
| **concern** | A pattern that degrades reliability or observability without an immediate data-corruption path — e.g., no heartbeat for a moderately long job, DLQ alarm missing, `correlationId` not threaded through. Should be fixed; flag if deferred. |
| **info** | A best-practice gap with no current reliability impact — e.g., sub-optimal `maxReceiveCount`, `MessageGroupId` choice could be narrower. Address opportunistically. |
