# Change risk evaluation — full Review checklist

Reference companion to the lean `SKILL.md`. Load when producing the four-section PR review report against all 18 Core rules.

The four-section shape (Summary / Findings / Safer alternative / Checklist coverage) is canonical. Use the templates below verbatim or adapt the wording — but keep the structure so reviewers can compare reports across PRs.

---

## Summary

One line stating the overall risk posture, blast-radius verdict (contained / moderate / high), deploy strategy, and whether the rollback path is credible and rehearsed.

Examples:

> Medium-risk API field addition; behavioural change touching 8 importers (moderate blast radius); feature-flag rollout, rollback < 2 min via flag toggle (rehearsed in staging 2026-04-22); approve pending support-lead acknowledgement.

> High-risk schema migration; data-layer change to `Order` table affecting 14 importers across 2 services; expand/contract migration with `CREATE INDEX CONCURRENTLY`; blue/green deploy with `down` migration tested; **blocker:** dual-support window not yet declared for the API consumer cohort still on v1.

---

## Findings

One row per gap or concern in the form `file:line, severity, category, fix`.

- `severity`: `blocker | concern | nit`.
- `category`: `rating | affected-scope | deploy-strategy | monitoring | rollback-trigger | stakeholders | importer-coverage | classification | api-breaking | behavioural | query-plan | spooky-action | rollback-path | migration-reversibility | feature-flag | time-to-rollback | contract-dual-support | rehearsal`.
- `fix`: the concrete remediation (e.g., "add explicit `en-GB` locale at call site", "add `CREATE INDEX CONCURRENTLY`", "split into shim + migration", "name the CloudWatch alarm and threshold instead of 'we'll watch prod'").

Example rows:

| file:line | severity | category | fix |
|---|---|---|---|
| PR description:L12 | blocker | monitoring | Name the CloudWatch alarm and threshold instead of "we'll watch prod". |
| src/utils/formatDate.ts:42 | concern | behavioural | Add before/after unit test asserting en-GB fallback for unset LOCALE. |
| prisma/migrations/20260422_drop_legacy/migration.sql:12 | blocker | migration-reversibility | Add a tested `down` migration or document irreversibility + recovery plan. |
| src/checkout/processOrder.ts:8 | concern | feature-flag | Behavioural change has no flag-gated old path; add LaunchDarkly kill switch defaulting off. |

> Note — Blast-radius evidence block. For each changed file, Findings rows should be backed by the following evidence captured in review notes or the PR body:
>
> ```
> Changed file: <path>
> Importers: <count> (<list or "see PR body">)
> Classification: <internal | API-compat | breaking | behavioural>
> Blast radius: <contained | moderate | high>
> Data-layer impact: <none | schema change | query-plan regression risk>
> Spooky-action surfaces: <none | <list of surfaces>>
> ```
>
> This evidence block is a reference format, not a replacement for the four-section report.

---

## Safer alternative

State the lowest-risk path that still achieves the change's goal. Common substitutions, by group:

**Group A (risk posture):**
- Phased rollout (canary 1 %→10 %→100 % with a minimum observation window at each step) over an all-at-once deploy for any change touching a revenue path, authentication, or a shared data schema.
- Feature flag with a tested kill switch over a git-revert rollback whenever the behaviour can be gated — flag-toggle rollback is typically under two minutes; revert-and-redeploy is typically eight minutes or more.

**Group B (blast radius):**
- Backward-compatible shim (keep the old signature, delegate to the new one, deprecate) over a direct API-breaking change when the importer count exceeds the contained threshold.
- A new function alongside the old one over mutating an existing behavioural contract; migrate consumers incrementally with tests per consumer.
- `CREATE INDEX CONCURRENTLY` and `NOT VALID` + `VALIDATE CONSTRAINT` patterns over lock-taking migrations on production tables.

**Group C (rollback):**
- Additive + feature-flag rollouts over destructive migrations when rollback-in-5-minutes is required.
- Expand/contract over in-place schema rewrites.
- Dual-support contract windows over big-bang producer/consumer cutovers.
- LaunchDarkly-style external flag toggles over env-var-baked artifacts when the kill switch must flip without a deploy.

If the current plan is straight-through for a medium-or-above change, restate the plan as a phased rollout and justify why the lower-risk strategy is not feasible.

---

## Checklist coverage

Mark each Core rule `PASS`, `CONCERN`, or `NOT APPLICABLE` with a one-line justification. Use the table below as the canonical form. Group rows are interleaved with the same numbering as the SKILL.md.

| Rule | Status | Notes |
|---|---|---|
| **Group A — Risk posture** | | |
| 1. Risk rating with explicit justification | | |
| 2. Affected users, services, and business processes named | | |
| 3. Deploy strategy named and justified against rating | | |
| 4. Monitoring signals named with dashboard/alarm links | | |
| 5. Rollback trigger named with threshold and time-to-rollback | | |
| 6. Stakeholders notified before deploy (with acknowledgements for high/critical) | | |
| **Group B — Blast radius** | | |
| 7. Importer list complete and importer count stated | | |
| 8. Each changed export classified (internal / API-compat / breaking / behavioural) | | |
| 9. All consumers listed and migration plan present (API-breaking only) | | |
| 10. Behavioural equivalence evidenced by tests or documented invariant | | |
| 11. Query-plan diff or benchmark provided (data-layer changes only) | | |
| 12. Spooky-action surfaces checked and declared clear or flagged | | |
| **Group C — Rollback** | | |
| 13. Rollback path documented before merge (not "TBD") | | |
| 14. `down` migration exists and has been run locally, or irreversibility is documented | | |
| 15. Behavioural change has feature-flag kill switch, defaulting off | | |
| 16. Time-to-rollback estimated; if > 15 min, a faster mechanism is required | | |
| 17. Contract change has a dual-support window with a defined end date | | |
| 18. High-risk change rehearsed in staging; outcome documented | | |

A rule marked `NOT APPLICABLE` must include the reason (e.g., "no data-layer change in this PR"). A rule marked `CONCERN` must include a Findings row with a concrete fix.
