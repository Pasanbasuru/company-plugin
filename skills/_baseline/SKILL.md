---
name: _baseline
description: Use as the shared foundation referenced by every other skill in this library. Do NOT invoke standalone for review — this captures cross-cutting standards (TypeScript, security, observability, testing, accessibility, performance, resilience) that every domain skill assumes.
allowed-tools: Read, Grep, Glob
---

# Baseline standards

## Purpose

Cross-cutting standards every other skill in this library assumes. Each domain skill opens with `Assumes _baseline. Adds:` and only covers its domain. If something here is violated, the domain skill does not have to restate it — it fails baseline.

## TypeScript

1. `tsconfig.json` must set `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `exactOptionalPropertyTypes: true`.
2. No `any`. No `@ts-ignore` or `@ts-expect-error` without a comment citing the reason and a ticket or issue link.
3. Zod (or equivalent schema library) parses every value crossing an untrusted boundary: HTTP body/query/params, queue messages, file input, environment variables, third-party API responses.
4. Exhaustive `switch` statements end with a `default` branch that assigns to a `never`-typed variable.
5. Prefer discriminated unions over optional fields + flags; prefer branded types for IDs to avoid mixing them.

## Security-by-default

1. Input validated at the boundary; DTOs are not trusted beyond the validator.
2. Secrets come from a secret manager (AWS Secrets Manager / Parameter Store). Never from source, never from plaintext env files in the repo.
3. Least-privilege IAM. No `*` in policy `Action` or `Resource`. No wildcard S3 buckets.
4. AuthN before authZ. AuthZ checked on every endpoint — UI guards are cosmetic.
5. SQL only via Prisma client methods. No `$queryRawUnsafe` with user-interpolated input; `$queryRaw` with tagged templates only when parameterised.
6. No PII in logs or error messages. Hash or redact before logging.
7. Output encoding: trust the framework (React, Next.js) for HTML escaping; never use `dangerouslySetInnerHTML` with untrusted data.

## Observability floor

1. Structured JSON logs with `requestId` / `correlationId` propagated across service boundaries.
2. Errors logged with full context (inputs summary, user id if present, cause chain). Never swallow an error silently.
3. Metrics for p50/p95/p99 and error rate on every HTTP handler and queue consumer.
4. Traces span service boundaries (OpenTelemetry).

## Testing floor

1. **Unit:** pure logic, fast, >80% line coverage on business rules.
2. **Integration:** DB + HTTP boundaries. Real Postgres via testcontainers. Not mocked.
3. **E2E:** critical user journeys only, Playwright.
4. No snapshot tests for logic. No mocked DBs for repository tests.
5. Tests must be deterministic. No `sleep`, no real clocks, no network to the real internet.

## Accessibility floor (any UI)

1. WCAG 2.2 AA.
2. Keyboard reachable, visible focus ring, correct tab order.
3. Respects `prefers-reduced-motion`.
4. Form inputs labelled; errors announced to assistive tech.
5. Colour not the sole indicator of meaning.

## Performance floor

1. **Web:** LCP < 2.5s, INP < 200ms, CLS < 0.1 on p75 mobile.
2. **API:** p95 < 300ms for reads, < 800ms for writes (per-endpoint budgets override).
3. **DB:** every query has an index path; no full-table scans over 10k rows.
4. **Bundle:** per-route JS budget (e.g. 170KB gzipped), monitored in CI.

## Resilience floor

1. Every network call has a timeout.
2. Every retry uses exponential backoff with jitter and a cap (max attempts and max delay).
3. Idempotency keys on every non-GET external call.
4. Circuit breakers on 3rd-party integrations.
5. No unbounded promise chains; every background task has a supervisor.

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
