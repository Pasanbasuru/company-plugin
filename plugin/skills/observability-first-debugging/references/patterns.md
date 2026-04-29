# Observability-first debugging — patterns

Detailed implementation patterns for the observability-first-debugging skill. Loaded only when the SKILL.md body points here.

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
