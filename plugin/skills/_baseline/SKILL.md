---
name: _baseline
description: Use when scaffolding a new global-plugin skill and needing a known-good template that exemplifies all company conventions — frontmatter shape, required sections, sanctioned handoff markers, and the Review checklist structure. Also use when auditing an existing skill and wanting a reference for what a minimal, verifier-GREEN skill looks like.
allowed-tools: Read, Grep, Glob
---

# Baseline standards and skill template

## Purpose & scope

This file serves a dual role in the global-plugin library:

1. **Template** — copy this SKILL.md as the starting point for a new skill. Replace the placeholder text in each section with domain-specific content. The frontmatter, section headings, and Review checklist shape are already verifier-GREEN.
2. **Shared baseline** — every domain skill in this library opens with `Assumes _baseline. Adds:` and inherits the cross-cutting standards captured below (TypeScript, security, observability, testing, accessibility, performance, resilience). Domain skills do not restate baseline rules; they add to them.

<!-- When using this file as a template, delete the "Shared baseline" subsections below that are already enforced by _baseline, and replace with domain-specific Core rules. Keep the top-level section shape intact. -->

## Assumes `_baseline`. Adds:

Nothing — this *is* `_baseline`. A domain skill replaces this line with e.g. `WCAG 2.2 AA compliance, keyboard reachability, focus management...` describing the narrow area it enforces on top of the shared floor.

## Core rules

<!-- Replace the placeholder rules below with the skill's concrete, numbered rules.
     Each rule must be: (a) a one-line imperative in bold, (b) followed by a short
     "Why" clause, (c) concrete enough that a reviewer can mark PASS/CONCERN/NOT APPLICABLE against it. -->

1. **[Placeholder] State the concrete rule as a short imperative sentence ending with a period.** — *Why:* explain in one sentence the concrete failure mode this rule prevents, so a reviewer understands the stakes.
2. **[Placeholder] A second rule, if the domain needs it; otherwise delete this line.** — *Why:* keep rules to the smallest set a reviewer can actually hold in their head — usually 4 to 10.

### Shared baseline rules (inherited by every skill)

These are the cross-cutting standards. Domain skills should not restate them.

**TypeScript**

1. `tsconfig.json` sets `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `exactOptionalPropertyTypes: true`.
2. No `any`. No `@ts-ignore` or `@ts-expect-error` without a comment citing the reason and a ticket link.
3. Zod (or equivalent) parses every value crossing an untrusted boundary: HTTP, queue, file, env, third-party API.
4. Exhaustive `switch` statements end with a `default` branch assigning to a `never`-typed variable.
5. Prefer discriminated unions over optional fields + flags; prefer branded types for IDs.

**Security-by-default**

1. Input validated at the boundary; DTOs are not trusted beyond the validator.
2. Secrets from a secret manager. Never from source, never from plaintext env files in the repo.
3. Least-privilege IAM. No `*` in policy `Action` or `Resource`. No wildcard S3 buckets.
4. AuthN before authZ. AuthZ checked on every endpoint — UI guards are cosmetic.
5. SQL only via Prisma client methods. No `$queryRawUnsafe` with user-interpolated input.
6. No PII in logs or error messages. Hash or redact before logging.
7. Trust the framework (React, Next.js) for HTML escaping; never `dangerouslySetInnerHTML` with untrusted data.

**Observability floor**

1. Structured JSON logs with `requestId` / `correlationId` propagated across service boundaries.
2. Errors logged with full context (inputs summary, user id if present, cause chain). Never swallow silently.
3. Metrics for p50/p95/p99 and error rate on every HTTP handler and queue consumer.
4. Traces span service boundaries (OpenTelemetry).

**Testing floor**

1. Unit: pure logic, fast, >80 % line coverage on business rules.
2. Integration: DB + HTTP boundaries. Real Postgres via testcontainers. Not mocked.
3. E2E: critical user journeys only, Playwright.
4. No snapshot tests for logic. No mocked DBs for repository tests.
5. Tests must be deterministic. No `sleep`, no real clocks, no network to the real internet.

**Accessibility floor (any UI)**

1. WCAG 2.2 AA. Keyboard reachable with visible focus ring. Respects `prefers-reduced-motion`.
2. Form inputs labelled; errors announced to assistive tech. Colour not the sole indicator of meaning.

**Performance floor**

1. Web: LCP < 2.5 s, INP < 200 ms, CLS < 0.1 on p75 mobile.
2. API: p95 < 300 ms reads, < 800 ms writes (per-endpoint budgets override).
3. DB: every query has an index path; no full-table scans over 10 k rows.
4. Bundle: per-route JS budget (e.g. 170 KB gzipped), monitored in CI.

**Resilience floor**

1. Every network call has a timeout. Every retry uses exponential backoff with jitter and a cap.
2. Idempotency keys on every non-GET external call.
3. Circuit breakers on 3rd-party integrations. No unbounded promise chains.

## Red flags

<!-- Replace the placeholder with the skill's concrete anti-patterns. Format:
     | Thought | Reality |
     ...one row per anti-pattern. -->

| Thought | Reality |
|---|---|
| "[Placeholder] An excuse the author is tempted to make" | "[Placeholder] The consequence that excuse hides — one concrete sentence." |

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

## Interactions with other skills

- **REQUIRED BACKGROUND:** superpowers:writing-skills — upstream authoring conventions for any skill in this library.
- **Hands off to:** global-plugin:skill-verification — every new or edited skill passes through the verifier before merge.
- **Does not duplicate:** domain skills restate the baseline only when a domain-specific refinement overrides a shared rule.

## Review checklist

### Summary

One line: pass / concerns / blocking issues. Name the reviewed surface (skill file, new domain skill, template instance) and the overall verdict in a single sentence so a reader can scan the result without reading further.

### Findings

One bullet per finding, in this shape:

- `skills/<name>/SKILL.md:42` — **severity** (blocking | concern | info) — *category* (frontmatter | sections | markers | size | discoverability | review-checklist) — what is wrong, recommended fix.

### Safer alternative

Prefer starting from `_baseline` over hand-rolling a new SKILL.md — the template already exercises every verifier check and every sanctioned section shape. Prefer small, focused skills (≤ 399 lines) over omnibus skills; split by verb/axis when a skill crosses the 400-line CONCERN threshold rather than letting it balloon into a 500-line FAIL. Prefer sanctioned handoff markers (`**REQUIRED SUB-SKILL:**`, `**REQUIRED BACKGROUND:**`, `**Hands off to:**`, `**Does not duplicate:**`) over prose references like "see foo-skill".

### Checklist coverage

Mark each Core rule as PASS / CONCERN / NOT APPLICABLE with a short justification.

- Rule 1 — [Placeholder] concrete rule restated: PASS / CONCERN / NOT APPLICABLE.
- Rule 2 — [Placeholder] concrete rule restated: PASS / CONCERN / NOT APPLICABLE.
