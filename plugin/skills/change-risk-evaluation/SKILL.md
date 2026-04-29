---
name: change-risk-evaluation
description: Use when evaluating risk for a planned change at PR time. Covers risk rating, blast-radius analysis (importer graph, change classification, query-plan regression, spooky-action surfaces), deploy strategy, monitoring signals, rollback path (mechanism choice, migration reversibility, kill-switch design, time-to-rollback, dual-support, rehearsal), and stakeholder notification. Do NOT use for code-level review (that's the domain skills) or simple feature-flagged changes that default off.
allowed-tools: Read, Grep, Glob, Bash
---

# Change risk evaluation

## Purpose & scope

Give an approver a one-page read on risk for a planned change at PR time — not "is the code good", but "what happens if this breaks in prod, who is affected, and how do we get back?" Apply to medium-risk-or-above changes, anything touching auth/schema/infra/external contracts, or any user-facing deploy. Output is a structured risk report, not a PR comment.

This skill owns end-to-end risk posture: rating, blast-radius, deploy strategy, monitoring, rollback design, stakeholder notification.

## Core rules

Mark non-applicable rules `NOT APPLICABLE` in the checklist.

### Group A — Risk posture (top-level)

1. **Produce a risk rating (low / med / high / critical) with explicit justification tied to specific change characteristics.** — *Why:* without justification it's vibes; reviewers can't challenge it, on-call can't calibrate alerts.

2. **List every affected user segment, downstream service, and business process by name.** — *Why:* on-call at 3am needs the named blast zone and who to call first.

3. **Name the deploy strategy explicitly: canary, blue/green, rolling, feature flag, or straight-through — and justify the choice against the risk rating.** — *Why:* a high-risk change deployed straight-through contradicts the risk rating; naming the strategy forces the author to reconcile them and gives the approver a concrete thing to challenge.

4. **Name the monitoring signals that will detect breakage — dashboard link, CloudWatch alarm name, Datadog monitor ID, or SLO target — not just "we'll watch prod".** — *Why:* Unnamed signals aren't watched — first detection becomes a customer report. Minutes to MTTD, hours to MTTR.

5. **Name the rollback trigger: the specific signal and threshold that says "roll back now", and the expected time-to-rollback.** — *Why:* without a pre-agreed trigger, rollback decisions are made under pressure with incomplete information; agreeing on the threshold before deploy removes the ambiguity from the worst moment of an incident.

6. **List every stakeholder who must be notified before deploy: team leads, on-call engineer, support, and any downstream service owner whose SLA is affected.** — *Why:* unannounced deploys to adjacent teams cause incidents a five-minute Slack message would prevent.

### Group B — Blast radius

7. **Map every importer before claiming the change is isolated.** Use `git log --follow`, grep, or `ts-morph` to enumerate every module that imports the changed file, including barrel re-exports. State the importer count; > 10 importers = high blast radius. — *Why:* engineers underestimate coupling. Named importers turn intuition into evidence.

8. **Classify every change before assessing impact** as one of: internal (not exported), API-compatible (same signature, same observable behaviour), API-breaking (signature or contract changed), or behavioural (signature unchanged, observable results differ). — *Why:* the category determines who is affected and what action is required. Conflating "API-compatible" with "behavioural change" is the most common source of silent regressions, because callers see no type error yet produce wrong results.

9. **For API-breaking changes, enumerate every consumer and its migration path.** Use `ts-morph` for AST-level call-site analysis. State coverage and any cross-deployment-unit coordination explicitly. — *Why:* breaking changes without an exhaustive consumer list produce ad-hoc breakage discovered at runtime.

10. **Flag behavioural changes as hidden-breakage risk even when signatures are unchanged.** Require explicit evidence — before/after unit tests or a documented invariant — that the new behaviour is correct for every consumer. — *Why:* a utility that previously returned `null` on empty input and now returns `[]` will break every caller that null-checked the result.

11. **Data-layer changes require a query-plan diff or benchmark on production-sized data.** Any change to a Prisma schema, raw SQL, index definition, or query shape must include a Postgres `EXPLAIN (ANALYZE, BUFFERS)` diff between old and new on production-volume data. — *Why:* a query that performs acceptably on a developer's 1 000-row sample can produce a full table scan on a 10 M-row production table.

12. **Check for spooky action at a distance before signing off.** Changes to shared state (in-memory caches, singleton services, global middleware, environment-variable readers, DI configuration, ambient TypeScript declarations, shared event emitters) affect every consumer simultaneously. If touched, the blast radius is the entire application. — *Why:* invisible to grep, alter every request's runtime — intermittent regressions.

### Group C — Rollback

13. **Rollback path is written before merge.** A change with no rollback path is either trivial or not mergeable. — *Why:* rollback designed at 3am is wrong or absent. Design it while context is fresh.

14. **Data migrations are reversible in code, or explicitly forward-only with a stated reason and a data-recovery plan.** A `down` migration must exist and must be tested unless you consciously declare the migration irreversible and document why. — *Why:* a broken `up` migration with no `down` forces a manual recovery that is slow, error-prone, and likely to cause data loss under pressure.

15. **A feature flag with a kill switch is the rollback mechanism for behavioural changes.** If you are changing runtime behaviour, the flag is not a nice-to-have — it is the rollback path. — *Why:* git-revert is 10–30 min and reverts unrelated commits; flag flip is instant.

16. **Time-to-rollback is measured.** A rollback that takes hours is effectively no rollback — fix the deployment pipeline, not the runbook. — *Why:* the window between detecting an incident and customer impact is usually minutes. If your rollback takes longer than that window, you need a faster mechanism.

17. **Contract/breaking changes require a period of dual support to enable rollback without downstream breakage.** You cannot roll back a producer if the consumer already requires the new format and has no fallback. — *Why:* rollback of one service in a tightly coupled pair can break the other. Dual support gives you a safe window to roll back either side independently.

18. **Rehearsal: for high-risk changes, the rollback is practised in staging before the production deploy.** Running the rollback once in staging costs minutes; discovering it does not work in prod costs hours. — *Why:* rollback scripts, migration `down` steps, and flag toggles all have their own bugs. Find them when the stakes are low.

## Red flags

| Signal | Reality |
|---|---|
| "Low risk, it's just a small change" without justification | Diff size and risk are orthogonal; a one-line change to a shared auth middleware can be critical. State the blast radius, affected users, and deploy strategy — then the rating has evidence behind it. |
| "We'll watch prod after deploy" | Watching prod is not a monitoring plan. Name the specific CloudWatch alarm, Datadog dashboard panel, or SLO target, the threshold that triggers action, and the person who is watching. |
| "Tiny refactor, low risk" without an importer count | Risk is determined by the caller graph, not by diff size. Count the callers first, then make the claim. |
| "Signature unchanged, behaviour same" without test evidence | Behavioural equivalence is an assertion, not a default. Require a test or a documented invariant to back it. |
| "It's just internal" for a file touched by barrel re-exports | Internals have callers too. A private implementation detail surfaced through an index export becomes an implicit public API. |
| "We'll figure out rollback if needed" | At 3am with users affected, you will not have the mental bandwidth or the context to design a rollback. The plan must exist before you ship. |
| "Migration is one-way, YOLO" | A one-way migration without a data-recovery plan means any bug in the migration permanently corrupts or loses data. Either write a tested `down`, or write a formal recovery procedure and get it reviewed. |

## Output shape

The output is a structured risk report with the fields named in the rules above: rating + justification, affected users / services / business processes, importer list with classification, query-plan and spooky-action notes, deploy strategy (with phases), monitoring signals (with alarm names and thresholds), rollback trigger and path (with measured time-to-rollback and rehearsal date), stakeholder acknowledgements. A field left blank or filled with "N/A — see PR" is a gap that must be resolved before approval.

For the detailed rubric, deploy/rollback taxonomies, and a full report example, see `references/patterns.md`. Full 18-row checklist template in `references/review-checklist.md`.

## Review checklist

Produce a markdown report with four sections (Summary / Findings / Safer alternative / Checklist coverage). The full template, with all 18 rule rows and the per-rule evidence callouts, lives in `references/review-checklist.md`.

### Summary

One line: GREEN / YELLOW / RED verdict, plus blast-radius (contained / moderate / high), deploy strategy, and whether the rollback path is credible and rehearsed.

### Findings

One row per gap or concern in the form `file:line, severity, category, fix`.

- `severity`: `blocker | concern | nit`.
- `category`: `rating | affected-scope | deploy-strategy | monitoring | rollback-trigger | stakeholders | importer-coverage | classification | api-breaking | behavioural | query-plan | spooky-action | rollback-path | migration-reversibility | feature-flag | time-to-rollback | contract-dual-support | rehearsal`.

### Safer alternative

State the lowest-risk path that still achieves the change's goal. Common substitutions: phased rollout (canary 1 %→10 %→100 %) over big-bang deploy; feature flag with tested kill switch over git-revert rollback; backward-compatible shim over direct API-breaking change; expand/contract migration over destructive in-place schema rewrite; dual-support contract window over big-bang producer/consumer cutover; `CREATE INDEX CONCURRENTLY` over lock-taking index creation.

### Checklist coverage

Mark each of the 18 Core rules `PASS`, `CONCERN`, or `NOT APPLICABLE` with a one-line justification. Use the table in `references/review-checklist.md` as the canonical form.

## Interactions with other skills

- **Owns:** end-to-end risk posture for a planned change — rating, blast-radius, deploy strategy, monitoring, rollback, stakeholders.
- **REQUIRED BACKGROUND:** superpowers:requesting-code-review (PR-time review pipeline)
- **Hands off to:** observability-first-debugging for deep monitoring guidance and incident debugging.
- **Hands off to:** aws-deploy-safety for ECS/Lambda deploy mechanics (task-def revision, alias retarget, health-check gates).
- **Hands off to:** infra-safe-change for IaC rollback (Terraform/CloudFormation state reversal, drift handling).
- **Hands off to:** queue-and-retry-safety for async blast radius when event emitters or message bus handlers are touched.
- **Hands off to:** coverage-gap-detection for missing tests on enumerated importers.
- **Does not duplicate:** PR code review; domain skill findings (typescript-rigor, prisma-data-access-guard, etc.).
