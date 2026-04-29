# Baseline standards

This document captures the cross-cutting engineering standards that every domain skill in `global-plugin` assumes. Domain skills open with `## Assumes baseline-standards. Adds:` and inherit these rules textually — they do not auto-load alongside the domain skill in a consumer session, but they document the team's defaults and serve as the canonical reference for what every skill is built on top of.

When authoring a new skill, do not restate baseline rules. State only what your skill *adds* on top of this baseline.

## TypeScript

1. `tsconfig.json` sets `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `exactOptionalPropertyTypes: true`.
2. No `any`. No `@ts-ignore` or `@ts-expect-error` without a comment citing the reason and a ticket link.
3. Zod (or equivalent) parses every value crossing an untrusted boundary: HTTP, queue, file, env, third-party API.
4. Exhaustive `switch` statements end with a `default` branch assigning to a `never`-typed variable.
5. Prefer discriminated unions over optional fields + flags; prefer branded types for IDs.

## Security-by-default

1. Input validated at the boundary; DTOs are not trusted beyond the validator.
2. Secrets from a secret manager. Never from source, never from plaintext env files in the repo.
3. Least-privilege IAM. No `*` in policy `Action` or `Resource`. No wildcard S3 buckets.
4. AuthN before authZ. AuthZ checked on every endpoint — UI guards are cosmetic.
5. SQL only via Prisma client methods. No `$queryRawUnsafe` with user-interpolated input.
6. No PII in logs or error messages. Hash or redact before logging.
7. Trust the framework (React, Next.js) for HTML escaping; never `dangerouslySetInnerHTML` with untrusted data.

## Observability floor

1. Structured JSON logs with `requestId` / `correlationId` propagated across service boundaries.
2. Errors logged with full context (inputs summary, user id if present, cause chain). Never swallow silently.
3. Metrics for p50/p95/p99 and error rate on every HTTP handler and queue consumer.
4. Traces span service boundaries (OpenTelemetry).

## Testing floor

1. Unit: pure logic, fast, >80 % line coverage on business rules.
2. Integration: DB + HTTP boundaries. Real Postgres via testcontainers. Not mocked.
3. E2E: critical user journeys only, Playwright.
4. No snapshot tests for logic. No mocked DBs for repository tests.
5. Tests must be deterministic. No `sleep`, no real clocks, no network to the real internet.

## Accessibility floor (any UI)

1. WCAG 2.2 AA. Keyboard reachable with visible focus ring. Respects `prefers-reduced-motion`.
2. Form inputs labelled; errors announced to assistive tech. Colour not the sole indicator of meaning.

## Performance floor

1. Web: LCP < 2.5 s, INP < 200 ms, CLS < 0.1 on p75 mobile.
2. API: p95 < 300 ms reads, < 800 ms writes (per-endpoint budgets override).
3. DB: every query has an index path; no full-table scans over 10 k rows.
4. Bundle: per-route JS budget (e.g. 170 KB gzipped), monitored in CI.

## Resilience floor

1. Every network call has a timeout. Every retry uses exponential backoff with jitter and a cap.
2. Idempotency keys on every non-GET external call.
3. Circuit breakers on 3rd-party integrations. No unbounded promise chains.

## Stack assumed by skills

- Node.js 22 LTS, TypeScript 5.6+, pnpm monorepos, ESM.
- Next.js 15+ App Router, React 19.
- NestJS 11, class-validator / class-transformer.
- Prisma 6, PostgreSQL 16.
- Pino, OpenTelemetry.
- AWS: ECS Fargate or Lambda, RDS Postgres, SQS, EventBridge, Secrets Manager, CloudWatch, X-Ray.
- GitHub Actions with OIDC to AWS.
- Vitest, Playwright, Testing Library, MSW, Testcontainers.
- React Native + Expo for mobile.
