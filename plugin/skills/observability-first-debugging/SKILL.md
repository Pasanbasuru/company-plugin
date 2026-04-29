---
name: observability-first-debugging
description: Use when debugging a production or staging issue, or when adding code to a hot path that should be observable. Do NOT use for local-only debugging of new code (use your IDE). Covers logs/metrics/traces-first method, structured logging, correlation ID propagation, alarm design.
allowed-tools: Read, Grep, Glob, Bash
---

# Observability-first debugging

## Purpose & scope

Debug production by reading the system, not by guessing — and write code that can be debugged that way. At 3 AM the only reliable evidence is what the system emitted: structured logs, metric time-series, distributed traces. Rich, correlated signals let you reconstruct what happened in minutes; free-text strings force you to redeploy with extra `console.log` calls, which is slow and risky. Apply when investigating a live issue, reviewing a hot-path handler, or writing code for a shared environment.

## Assumes `baseline-standards`. Adds:

Debugging discipline and culture — structured logging depth, correlation IDs end-to-end, alarm/runbook design, metrics that matter (p95/p99 over p50), and a systematic debugging playbook for production incidents.

## Core rules

1. **Start with logs → metrics → traces. Do not reach for `console.log` patches in prod.** — *Why:* redeploying to add instrumentation adds risk and delay; structured logs/metrics/traces should already contain the answer.
2. **Every log line is structured JSON with `requestId`, `service`, `level`, and relevant domain fields — never free-text strings alone.** — *Why:* structured fields can be indexed, filtered, and used in metric filters without custom parsing.
3. **A single request gets a correlation ID at the edge; every downstream log, trace span, and outbound fetch carries it.** — *Why:* without a correlation ID you cannot reconstruct a single request's lifecycle across services; timestamp-only correlation fails under concurrency.
4. **Metrics exist for every handler: latency histogram, error rate, throughput. Alerts are based on p95/p99 and error rate, not p50.** — *Why:* p50 hides tail suffering; users in the 95th/99th percentile experience real degradation while the median looks fine.
5. **Traces span across services. Critical paths — checkout, auth, payment — are instrumented end to end.** — *Why:* a slow response often has its root cause in a downstream service; without traces you see the symptom but not the cause.
6. **Alarms have runbooks. An alarm that fires without a runbook is an incident amplifier.** — *Why:* at 3 AM, an on-call who does not know what an alarm means will either over-page or take wrong action under pressure.
7. **Error reports include: what the user was doing, request ID, timestamp, input shape (non-PII), and the downstream error cause chain.** — *Why:* the cause chain is the most commonly missing piece and the difference between a 30-minute fix and a riddle.

## Red flags

| Thought | Reality |
|---|---|
| "Just `console.log` and redeploy" | You are coding blind. Every redeployment adds risk and delay. Proper structured logging should already capture what you need. |
| "Logs are strings, grep works" | For a single request at 3 AM across three services with 10k req/min throughput, grep-by-string is a nightmare. Structured fields with an indexed query are the difference between 5 minutes and 50. |
| "Alarm on p50 latency" | The tail is where users suffer. p50 can look healthy while the slowest 5% of users — often the ones with the most data or the most complex accounts — experience a broken product. |

## Good vs bad

### Structured Pino log line vs free-text console.log

Bad — free-text with no fields for filtering or correlation:

```typescript
// BAD: unstructured, no requestId, impossible to aggregate or alert on
console.log(`User ${userId} failed to checkout: ${error.message}`);
```

Good — structured JSON via Pino with `requestId` and domain fields:

```typescript
// GOOD: structured fields enable filtering, alerting, and correlation
import { logger } from './logger'; // Pino instance bound to the request context

logger.error(
  {
    requestId:  ctx.requestId,
    service:    'checkout',
    userId,
    orderId,
    errorCode:  error.code,
    durationMs: Date.now() - startTime,
  },
  'Checkout failed — payment declined',
);
```

### Correlation ID middleware propagated into downstream fetch vs missing

Bad — no correlation ID; requests cannot be traced across services:

```typescript
// BAD: downstream service has no way to link this call to the originating request
async function fetchInventory(skuId: string): Promise<number> {
  const res = await fetch(`https://inventory.internal/sku/${skuId}/stock`);
  return res.json();
}
```

Good — correlation ID from `AsyncLocalStorage` context forwarded in every outbound call:

```typescript
// GOOD: x-request-id flows into downstream logs and traces
import { getRequestContext } from './request-context'; // AsyncLocalStorage-backed

async function fetchInventory(skuId: string): Promise<number> {
  const { requestId } = getRequestContext();
  const res = await fetch(`https://inventory.internal/sku/${skuId}/stock`, {
    headers: { 'x-request-id': requestId },
  });
  return res.json();
}
```

### p99 latency alarm with runbook vs p50 alarm

Bad — alarming on median; tail latency goes undetected:

```yaml
# BAD: p50 alarm misses the users suffering at the tail
AlarmName: CheckoutLatencyHigh
MetricName: checkout.latency.p50
Threshold: 500   # ms
# No runbook link
```

Good — p99 alarm with explicit runbook link:

```yaml
# GOOD: p99 catches tail; runbook tells on-call what to do
AlarmName: CheckoutLatencyP99High
MetricName: checkout.latency.p99
Threshold: 1000  # ms
AlarmDescription: |
  p99 checkout latency exceeded 1 000 ms.
  Runbook: https://runbooks.internal/checkout-latency-high
```

## Structured logging (Pino) setup

Pino is a low-overhead JSON logger: serialises synchronously in the hot path, delegates I/O to a worker. Key choices: always JSON in production, one child logger per request, never `console.log` in shared code.

**Base logger configuration (`src/logger.ts`):**

```typescript
import pino, { Logger } from 'pino';

export const logger: Logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  // Always emit JSON in non-dev environments
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  base: {
    service: process.env.SERVICE_NAME ?? 'unknown-service',
    env:     process.env.NODE_ENV ?? 'production',
  },
  // Redact PII before it reaches the log transport
  redact: {
    paths:  ['req.headers.authorization', '*.password', '*.cardNumber'],
    censor: '[REDACTED]',
  },
  // ISO timestamps for human readability in CloudWatch
  timestamp: pino.stdTimeFunctions.isoTime,
});
```

**Request-scoped child logger (NestJS / Express middleware):**

```typescript
import { AsyncLocalStorage } from 'async_hooks';
import { logger } from './logger';
import type { Logger } from 'pino';

interface RequestContext {
  requestId: string;
  log:       Logger;
}

const storage = new AsyncLocalStorage<RequestContext>();

// Express / NestJS middleware — attach before route handlers
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) ?? crypto.randomUUID();
  const log = logger.child({ requestId, path: req.path, method: req.method });

  res.setHeader('x-request-id', requestId); // echo back for client correlation

  storage.run({ requestId, log }, () => {
    const start = Date.now();
    res.on('finish', () => {
      log.info(
        { statusCode: res.statusCode, durationMs: Date.now() - start },
        'Request completed',
      );
    });
    next();
  });
}

export function getRequestContext(): RequestContext {
  const ctx = storage.getStore();
  if (!ctx) throw new Error('getRequestContext called outside a request context');
  return ctx;
}
```

Using the child logger downstream: `const { log } = getRequestContext(); log.info({ orderId }, 'Processing order');` — every line automatically carries `requestId`, `service`, `env`, and any child fields. No threading a logger through every function call.

## Correlation IDs end-to-end

A correlation ID is a UUID generated at the request entry point (API gateway, load balancer, or first service) and carried through every downstream op: HTTP calls, queue messages, DB query comments, trace spans. It is the single thread you pull to reconstruct one user action.

**The `AsyncLocalStorage` pattern** avoids threading the ID through every function argument: middleware establishes the context; anywhere downstream calls `getRequestContext()`.

**Propagating into downstream HTTP fetches:**

```typescript
import { getRequestContext } from './request-context';

export async function callDownstreamService<T>(url: string, init?: RequestInit): Promise<T> {
  const { requestId } = getRequestContext();

  const res = await fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      'x-request-id': requestId,  // standard header; some teams use 'traceparent' (W3C)
      'content-type': 'application/json',
    },
  });

  if (!res.ok) throw new UpstreamError(res.status, url);
  return res.json() as Promise<T>;
}
```

**Propagating into SQS / SNS messages:**

```typescript
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { getRequestContext } from './request-context';

const sqs = new SQSClient({});

export async function enqueueEvent(queueUrl: string, payload: unknown): Promise<void> {
  const { requestId } = getRequestContext();

  await sqs.send(new SendMessageCommand({
    QueueUrl:    queueUrl,
    MessageBody: JSON.stringify(payload),
    MessageAttributes: {
      requestId: {
        DataType:    'String',
        StringValue: requestId,  // consumer extracts this and re-establishes context
      },
    },
  }));
}
```

**Re-establishing context in the queue consumer:**

```typescript
import { SQSEvent } from 'aws-lambda';
import { storage } from './request-context';
import { logger } from './logger';

export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    const requestId = record.messageAttributes?.['requestId']?.stringValue ?? crypto.randomUUID();
    const log = logger.child({ requestId, queue: record.eventSourceARN });

    await storage.run({ requestId, log }, () => processRecord(record));
  }
}
```

**W3C `traceparent` for OpenTelemetry compatibility.** With OTel, propagate the standard `traceparent` header instead of (or alongside) `x-request-id`. OTel's `propagation.inject(context, headers)` writes it automatically via the HTTP instrumentation library.

## Metrics that matter

Instrument every handler with the four golden signals: latency, traffic, errors, saturation. CloudWatch, Datadog, and Prometheus all accept these; patterns below use CloudWatch EMF but concepts are universal.

**Emitting structured metrics via CloudWatch EMF:**

```typescript
import { createMetricsLogger, Unit } from 'aws-embedded-metrics';

export async function checkoutHandler(req: Request, res: Response): Promise<void> {
  const metrics = createMetricsLogger();
  metrics.setNamespace('MyApp/Checkout');
  metrics.setDimensions({ service: 'checkout', env: process.env.NODE_ENV ?? 'prod' });

  const start = Date.now();
  try {
    await processCheckout(req.body);
    metrics.putMetric('CheckoutSuccess', 1, Unit.Count);
    res.status(200).json({ ok: true });
  } catch (err) {
    metrics.putMetric('CheckoutError', 1, Unit.Count);
    throw err;
  } finally {
    metrics.putMetric('CheckoutDuration', Date.now() - start, Unit.Milliseconds);
    await metrics.flush(); // writes JSON metric payload to stdout → CloudWatch
  }
}
```

Alternatively extract metrics from Pino JSON logs via a `AWS::Logs::MetricFilter` with `FilterPattern: '{ $.level = "error" && $.service = "checkout" }'` and dimensions keyed on `$.errorCode`.

**Percentiles over averages.** Averages mask bimodal distributions — a p99 of 2 000 ms is invisible if the average is 120 ms. Always publish p50, p95, p99. In CloudWatch, use `PERCENTILE` statistics.

**What to measure on every handler at minimum:**

| Metric | Unit | Purpose |
|---|---|---|
| `<handler>.duration` | Milliseconds histogram | Latency; alert on p99 |
| `<handler>.requests` | Count | Throughput; alert on anomalous drops |
| `<handler>.errors` | Count with `errorCode` dimension | Error rate; alert on rate increase |
| `<handler>.saturation` | Gauge (concurrent in-flight) | Back-pressure signal |

## Tracing critical paths

Distributed tracing connects log lines across services by attaching `traceId`/`spanId` to every op. Pino logs that include `traceId` can be correlated with spans in Jaeger, AWS X-Ray, or Datadog APM for a waterfall view of where time went.

**OpenTelemetry setup for Node.js (SDK init before any other imports):**

```typescript
// src/tracing.ts — import this as the very first module in src/main.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: process.env.SERVICE_NAME ?? 'unknown',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false }, // too noisy
    }),
  ],
});

sdk.start();
process.on('SIGTERM', () => sdk.shutdown());
```

**Adding a manual span for a critical business operation:**

```typescript
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('checkout-service');

export async function processCheckout(order: Order): Promise<ChargeResult> {
  return tracer.startActiveSpan('checkout.process', async (span) => {
    span.setAttributes({
      'checkout.orderId':    order.id,
      'checkout.itemCount':  order.items.length,
      'checkout.totalCents': order.totalCents,
    });

    try {
      const result = await chargePayment(order);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      throw err;
    } finally {
      span.end();
    }
  });
}
```

**Injecting trace context into Pino logs** so log lines and spans are correlated in your APM tool:

```typescript
import { trace, context } from '@opentelemetry/api';

export function getTraceContext(): { traceId: string; spanId: string } {
  const span = trace.getActiveSpan();
  if (!span) return { traceId: '', spanId: '' };
  const ctx = span.spanContext();
  return { traceId: ctx.traceId, spanId: ctx.spanId };
}

// In the request middleware, bind trace context to the child logger:
const log = logger.child({ requestId, ...getTraceContext() });
```

Every log line now carries `traceId` and `spanId`; clicking a log line in CloudWatch Logs Insights can jump to the corresponding trace in your APM tool.

## Alarm design + runbooks

An alarm without a runbook creates panic; an alarm on the wrong signal creates fatigue. Alert on symptoms users experience (not internal noise), and give every alarm a runbook that orients the on-call within 60 seconds of waking up.

**Alarm tiers:**

| Tier | Condition | Paging policy |
|---|---|---|
| P1 — Critical | Error rate > 5% for 5 min OR p99 latency > 2×SLO for 5 min | Page immediately, escalate after 15 min |
| P2 — Warning | Error rate > 1% for 10 min OR p99 latency > 1.5×SLO for 10 min | Slack alert, page if not acknowledged in 30 min |
| P3 — Info | Unusual traffic drop, circuit breaker opened | Slack only |

**CloudWatch alarm with runbook (CDK):**

```typescript
import { Alarm, ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';

new Alarm(this, 'CheckoutP99LatencyAlarm', {
  alarmName:        'checkout-p99-latency-high',
  alarmDescription: [
    'p99 checkout latency exceeded 1 000 ms for 5 consecutive minutes.',
    'Runbook: https://runbooks.internal/checkout-latency-high',
    'Dashboard: https://cloudwatch.aws.amazon.com/...#dashboards:name=Checkout',
  ].join('\n'),
  metric: checkoutDurationMetric.with({
    statistic: 'p99',
    period:    Duration.minutes(1),
  }),
  threshold:            1000,
  evaluationPeriods:    5,
  comparisonOperator:   ComparisonOperator.GREATER_THAN_THRESHOLD,
  treatMissingData:     TreatMissingData.NOT_BREACHING,
  actionsEnabled:       true,
}).addAlarmAction(new SnsAction(oncallTopic));
```

**Runbook sections (required):** what fired; user impact; dashboard links; numbered investigation steps (check p50 co-movement, Logs Insights error-by-code, downstream status pages, recent deploys); mitigation options (feature-flag fallback, scale read replicas, rollback); escalation path (team lead after 30 min).

## Debugging playbook

Work these steps in order. Do not skip ahead to a fix before completing at least steps 1–3.

**Step 1 — Define the blast radius.** How many users, which features, since when? Check the error-rate dashboard for the inflection point. All users or a subset (region, tier, browser)?

**Step 2 — Read the logs.** Query structured logs for the time window and affected service. Use a known-bad `requestId` if you have one, or filter by `level=error` and `service=<affected>`. Look for error codes, cause chains, unexpected fields, and patterns in affected requests (same `userId` prefix, `skuId`, downstream endpoint).

```
# CloudWatch Logs Insights query for the affected window
fields @timestamp, requestId, errorCode, durationMs, @message
| filter service = "checkout" and level = "error"
| filter @timestamp between <start> and <end>
| sort @timestamp desc
| limit 50
```

**Step 3 — Read the metrics.** Pull p99 latency, error rate, and throughput for the affected handler over the last 2 h. Look for correlation with a deploy (vertical annotation), step-function change (config change), or gradual degradation (resource exhaustion/leak).

**Step 4 — Pull a trace.** Take one `requestId` from step 2 and find its trace. The waterfall shows which downstream call was slow or failed. Common culprits: bad DB query plan, downstream timeout, new code path calling an extra external service.

**Step 5 — Form hypotheses (max three).** Ordered by probability. Be specific: "Payment provider `/charges` returning 503 since 14:32 UTC" is a hypothesis; "something wrong with payments" is not.

**Step 6 — Verify, then fix.** Test the most likely hypothesis with the minimal action (status page, deploy log, specific metric query). Propose a fix only after confirming. State clearly what is *verified* vs *assumed*.

**Step 7 — Post-mortem signal.** File the log/metric/trace gap that made diagnosis harder than needed. Every incident leaves the system more observable than it found it.

## Interactions with other skills

**REQUIRED BACKGROUND:** superpowers:systematic-debugging — this skill attaches inside Phase 1 (Root Cause) of that workflow; it does not replace it.

- **Owns:** observability culture and patterns — structured logging, correlation ID propagation, metric instrumentation, distributed tracing, alarm design.
- **Hands off to:** `resilience-and-error-handling` for *when* to catch and log errors and how to propagate typed error causes; `change-risk-evaluation` for which metrics and alarms to watch during and after a deploy.
- **Does not duplicate:** vendor-specific setup docs, or `queue-and-retry-safety`'s dead-letter-queue monitoring patterns.

## Review checklist

Produce a markdown report with these sections:

1. **Summary** — one line: pass / concerns / blocking issues.
2. **Handler inventory** — for each HTTP handler or queue consumer: file:line, has structured logs (yes/no), emits latency metric (yes/no), emits error metric (yes/no), correlation ID propagated (yes/no).
3. **Findings** — per issue: *File:line, severity (blocking | concern | info), rule violated, what's wrong, recommended fix.*
4. **Safer alternative** — for each observability gap flagged in Findings, propose a lower-risk mitigation before reaching for new log lines. If structured logs are unavailable on the hot path, prefer a targeted deploy-tracking dashboard or existing metric drill-down over adding ad-hoc logs. Prefer existing traces/spans over new print-style logs when debugging request flow, and prefer re-using an already-emitted correlation ID over introducing a new one.
5. **Alarm coverage** — list alarms found in IaC; for each: metric, threshold, statistic (p50/p95/p99/avg), runbook link present (yes/no).
6. **Checklist coverage** — for each of the 7 core rules, mark: PASS / CONCERN / NOT APPLICABLE.
   - Rule 1: Logs/metrics/traces consulted before proposing changes
   - Rule 2: All log lines are structured JSON with `requestId`, `service`, `level`, and domain fields
   - Rule 3: Correlation ID generated at edge and propagated into all downstream calls and messages
   - Rule 4: Every handler has latency histogram, error rate, and throughput metrics; alerts on p95/p99
   - Rule 5: Traces instrument critical paths end-to-end across service boundaries
   - Rule 6: Every alarm has a runbook with investigation steps and mitigation options
   - Rule 7: Error reports include request ID, timestamp, input shape, and full downstream cause chain
