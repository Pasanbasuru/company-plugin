---
name: observability-first-debugging
description: Use when debugging a production or staging issue, or when adding code to a hot path that should be observable. Do NOT use for local-only debugging of new code (use your IDE). Covers logs/metrics/traces-first method, structured logging, correlation ID propagation, alarm design.
allowed-tools: Read, Grep, Glob, Bash
---

# Observability-first debugging

## Purpose & scope

Debug production by reading the system, not by guessing. And write code that can be debugged that way. When something breaks at 3 AM the only reliable evidence is what the system emitted: structured log lines, metric time-series, and distributed traces. Code that emits rich, structured, correlated signals lets you reconstruct what happened in minutes. Code that emits free-text strings or nothing forces you to redeploy with extra `console.log` calls — which is both slow and risky.

Apply this skill when you are investigating a live issue, reviewing a handler that sits in a hot path, or writing new code that will run in a shared environment. The approach is always: look at what the system is telling you first, form a small set of hypotheses from the evidence, then act.

## Assumes `_baseline`. Adds:

Debugging discipline and culture — structured logging depth, correlation IDs end-to-end, alarm/runbook design, metrics that matter (p95/p99 over p50), and a systematic debugging playbook for production incidents.

## Core rules

1. **Start with logs → metrics → traces. Do not reach for `console.log` patches in prod.** — *Why:* every redeployment to add instrumentation introduces risk and delays diagnosis by the time it takes to build and deploy. Your structured logs, metrics, and traces should already contain the answer; the discipline is learning to read them.

2. **Every log line is structured JSON with `requestId`, `service`, `level`, and relevant domain fields — never free-text strings alone.** — *Why:* free-text strings are greppable for single queries but require custom parsing for every filter, aggregation, or alert. Structured fields can be indexed, filtered by value, and used in metric filters without post-processing.

3. **A single request gets a correlation ID at the edge; every downstream log, trace span, and outbound fetch carries it.** — *Why:* without a correlation ID you cannot reconstruct the full lifecycle of a single request across services. You are forced to correlate by timestamp alone, which fails under any concurrency.

4. **Metrics exist for every handler: latency histogram, error rate, throughput. Alerts are based on p95/p99 and error rate, not p50.** — *Why:* p50 (median) latency hides tail suffering. Users in the 95th or 99th percentile experience real degradation while p50 looks fine. Alerting on the median systematically under-pages the on-call.

5. **Traces span across services. Critical paths — checkout, auth, payment — are instrumented end to end.** — *Why:* a slow response often has its root cause in a downstream service. Without traces you see the symptom (slow response at the edge) but not the cause (slow database query in the order service). Distributed tracing connects the dots.

6. **Alarms have runbooks. An alarm that fires without a runbook is an incident amplifier.** — *Why:* at 3 AM, an on-call engineer who does not know what an alarm means and has no starting point will either page more people unnecessarily or take the wrong action under pressure. A runbook converts alarm noise into actionable procedure.

7. **Error reports include: what the user was doing, request ID, timestamp, input shape (non-PII), and the downstream error cause chain.** — *Why:* without these five elements, a bug report is a riddle. With them, a reproduction path and a fix are usually 30 minutes of work. The cause chain — especially the original upstream error, not just "something failed" — is the most commonly missing piece.

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
    userId:     userId,
    orderId:    orderId,
    errorCode:  error.code,
    durationMs: Date.now() - startTime,
  },
  'Checkout failed — payment declined',
);
// Emits: {"level":"error","requestId":"req-abc123","service":"checkout",
//          "userId":"usr-456","orderId":"ord-789","errorCode":"CARD_DECLINED",
//          "durationMs":312,"msg":"Checkout failed — payment declined"}
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

Pino is a low-overhead JSON logger for Node.js. It serialises log objects synchronously in the hot path and delegates I/O to a worker thread (`pino-pretty` in development, a transport in production). The key configuration choices are: always output JSON in production, bind a child logger per request, and never use `console.log` anywhere in shared code.

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

**Using the child logger in a service:**

```typescript
import { getRequestContext } from './request-context';

async function processOrder(orderId: string): Promise<void> {
  const { log } = getRequestContext();

  log.info({ orderId }, 'Processing order');

  try {
    await chargePayment(orderId);
    log.info({ orderId }, 'Payment charged');
  } catch (err) {
    log.error({ orderId, err }, 'Payment charge failed');
    throw err;
  }
}
```

Every log line automatically carries `requestId`, `service`, `env`, and any fields added to the child. No manually threading a logger parameter through every function call.

## Correlation IDs end-to-end

A correlation ID is a UUID generated at the entry point of a request (API gateway, load balancer, or the first service to receive the call) and carried through every subsequent operation: downstream HTTP calls, queue messages, database query comments, and trace spans. It is the single thread you pull to reconstruct everything that happened for one user action.

**The `AsyncLocalStorage` pattern** is the Node.js-idiomatic way to avoid threading the ID through every function argument. The middleware from the logging section establishes the context; anywhere downstream can call `getRequestContext()` to retrieve it.

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

**W3C `traceparent` for OpenTelemetry compatibility.** If your stack uses OpenTelemetry, propagate the standard `traceparent` header instead of (or in addition to) `x-request-id`. The OTel SDK's `propagation.inject(context, headers)` call writes the header automatically when you use the HTTP instrumentation library.

## Metrics that matter

Instrument every handler with the four golden signals: latency, traffic, errors, and saturation. CloudWatch, Datadog, and Prometheus all accept these; the patterns below use CloudWatch metric filters for AWS-native stacks, but the concepts are universal.

**Emitting structured metrics via embedded metric format (CloudWatch EMF):**

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

**CloudWatch metric filter to extract from Pino JSON logs (Infrastructure as Code):**

```yaml
# Extracts errorCode field from structured logs to build an error-by-code dimension
CheckoutErrorMetricFilter:
  Type: AWS::Logs::MetricFilter
  Properties:
    LogGroupName: !Ref CheckoutLogGroup
    FilterPattern: '{ $.level = "error" && $.service = "checkout" }'
    MetricTransformations:
      - MetricName: CheckoutErrorCount
        MetricNamespace: MyApp/Checkout
        MetricValue: '1'
        DefaultValue: 0
        Dimensions:
          - Key: errorCode
            Value: $.errorCode
```

**Histogram percentiles matter more than averages.** Averages mask bimodal distributions. A p99 of 2 000 ms is invisible if the average is 120 ms because 99% of requests are fast. Always publish p50, p95, and p99. In CloudWatch, use `PERCENTILE` statistics on the duration metric.

**What to measure on every handler at minimum:**

| Metric | Unit | Purpose |
|---|---|---|
| `<handler>.duration` | Milliseconds histogram | Latency; alert on p99 |
| `<handler>.requests` | Count | Throughput; alert on anomalous drops |
| `<handler>.errors` | Count with `errorCode` dimension | Error rate; alert on rate increase |
| `<handler>.saturation` | Gauge (concurrent in-flight) | Back-pressure signal |

## Tracing critical paths

Distributed tracing connects log lines across service boundaries by attaching a `traceId` and `spanId` to every operation. Pino logs that include `traceId` can be correlated with spans in Jaeger, AWS X-Ray, or Datadog APM, giving you a waterfall view of where time was spent across the entire call chain.

**OpenTelemetry setup for Node.js (SDK initialisation before any other imports):**

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

With this setup, every log line carries `traceId` and `spanId`, and clicking a log line in CloudWatch Logs Insights can jump directly to the corresponding trace in your APM tool.

## Alarm design + runbooks

An alarm without a runbook creates panic, not resolution. An alarm on the wrong signal creates alarm fatigue. Good alarm design means: alert on symptoms that user are actually experiencing (not just internal noise), and give every alarm a runbook that starts the on-call engineer within 60 seconds of waking up.

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

**Runbook template:**

```markdown
# Runbook: checkout-p99-latency-high

## What fired
p99 checkout latency > 1 000 ms sustained for 5 minutes.

## Impact
Users in the slowest percentile experience checkout taking > 1 s.
Conversion rate typically drops 7% per additional second of latency.

## Dashboards
- [Checkout overview](https://cloudwatch.aws.amazon.com/...#dashboards:name=Checkout)
- [Downstream service health](https://datadog.internal/dashboards/downstream-health)

## Investigation steps
1. Check the Checkout dashboard — is p50 also elevated? If yes, systemic issue.
   If no, tail-only slowness — check DB query times and payment provider latency.
2. Check CloudWatch Logs Insights for recent errors:
   `filter service="checkout" and level="error" | stats count() by errorCode`
3. Check payment provider status page: https://status.stripe.com
4. Check RDS slow query log for queries > 500 ms in the last 30 min.
5. Check recent deployments in the deploy log: https://deploys.internal/checkout

## Mitigation options
- If payment provider: enable the `checkout-payment-fallback` feature flag to
  route to secondary provider.
- If database: scale up read replicas or enable query cache.
- If deploy-related: roll back using `./scripts/rollback.sh checkout`.

## Escalation
If not resolved in 30 min, page the checkout team lead.
```

Every runbook must include: what fired, the user impact, links to dashboards, numbered investigation steps, at least one mitigation option, and an escalation path.

## Debugging playbook

When an issue is reported in production, work through these steps in order. Do not skip ahead to forming a fix before completing at least the first three steps.

**Step 1 — Define the blast radius.**
Before touching anything, answer: how many users are affected, which features, since when? Check your error-rate dashboard and look for the inflection point. Is it all users or a subset (specific region, specific account tier, specific browser)?

**Step 2 — Read the logs.**
Query the structured logs for the time window and affected service. Use the `requestId` of a known-bad request if you have one, or filter by `level=error` and `service=<affected>`. Look for: error codes, cause chains, unexpected fields, and any pattern in the affected requests (same `userId` prefix, same `skuId`, same downstream endpoint).

```
# CloudWatch Logs Insights query for the affected window
fields @timestamp, requestId, errorCode, durationMs, @message
| filter service = "checkout" and level = "error"
| filter @timestamp between <start> and <end>
| sort @timestamp desc
| limit 50
```

**Step 3 — Read the metrics.**
Pull the p99 latency, error rate, and throughput graphs for the affected handler for the last 2 hours. Look for: correlation with a deploy (vertical annotation), step-function change (suggesting a config change), or gradual degradation (suggesting resource exhaustion or a slow leak).

**Step 4 — Pull a trace.**
Take one `requestId` from step 2 and find its trace in your APM tool. The waterfall will show which downstream call was slow or failed. Common culprits: a database query that suddenly has a bad plan, a downstream service that started timing out, or a new code path that calls an additional external service.

**Step 5 — Form hypotheses (maximum three).**
Based on steps 1–4, write down no more than three hypotheses ordered by probability. Be specific: "The payment provider's `/charges` endpoint is returning 503 since 14:32 UTC" is a hypothesis. "Something is wrong with payments" is not.

**Step 6 — Verify, then fix.**
Test the most likely hypothesis with the minimal action (check the payment provider's status page, look for a matching deploy in the deploy log, query a specific metric). Only after confirming a hypothesis should you propose a fix. State clearly what is *verified* versus *assumed* when presenting the fix.

**Step 7 — Post-mortem signal.**
After the incident, ensure the log/metric/trace gap that made diagnosis harder than it needed to be is filed as a task. Observability improves incrementally; every incident should leave the system more observable than it found it.

## Interactions with other skills

- **Owns:** observability culture and patterns — structured logging, correlation ID propagation, metric instrumentation, distributed tracing, alarm design.
- **Hands off to:** `resilience-and-error-handling` for *when* to catch and log errors and how to propagate typed error causes; `change-risk-evaluation` for which metrics and alarms to watch during and after a deploy.
- **Does not duplicate:** vendor-specific setup docs, or `queue-and-retry-safety`'s dead-letter-queue monitoring patterns.

## Review checklist

Produce a markdown report with these sections:

1. **Summary** — one line: pass / concerns / blocking issues.
2. **Handler inventory** — for each HTTP handler or queue consumer: file:line, has structured logs (yes/no), emits latency metric (yes/no), emits error metric (yes/no), correlation ID propagated (yes/no).
3. **Findings** — per issue: *File:line, severity (low/med/high), rule violated, what's wrong, recommended fix.*
4. **Alarm coverage** — list alarms found in IaC; for each: metric, threshold, statistic (p50/p95/p99/avg), runbook link present (yes/no).
5. **Checklist coverage** — for each of the 7 core rules, mark: PASS / CONCERN / NOT APPLICABLE.
   - Rule 1: Logs/metrics/traces consulted before proposing changes
   - Rule 2: All log lines are structured JSON with `requestId`, `service`, `level`, and domain fields
   - Rule 3: Correlation ID generated at edge and propagated into all downstream calls and messages
   - Rule 4: Every handler has latency histogram, error rate, and throughput metrics; alerts on p95/p99
   - Rule 5: Traces instrument critical paths end-to-end across service boundaries
   - Rule 6: Every alarm has a runbook with investigation steps and mitigation options
   - Rule 7: Error reports include request ID, timestamp, input shape, and full downstream cause chain
