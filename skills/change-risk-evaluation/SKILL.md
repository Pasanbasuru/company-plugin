---
name: change-risk-evaluation
description: Use at PR time to produce a top-level risk posture for a change — the ticket an on-call or lead reads before approving. Do NOT use for code-level review (that's the domain skills). Covers overall risk rating, deploy strategy, monitoring plan, stakeholder list.
allowed-tools: Read, Grep, Glob, Bash
---

# Change risk evaluation

## Purpose & scope

Give an approver a one-page read on risk — not "is the code good", but "what happens if this breaks in prod?" Apply this skill to every change rated medium risk or above, to any change touching auth, data schema, infra, or external contracts, and as the mandatory gate before a high-traffic or user-facing deploy. The output is a structured risk report consumed by a lead, on-call engineer, or change-advisory process, not a code-review comment.

This skill is deliberately scoped to top-level risk posture. It feeds from `regression-risk-check` (blast-radius inputs), hands off to `rollback-planning` (reverse path), and defers to `observability-first-debugging` for deep monitoring guidance. It does not duplicate PR code review.

## Assumes `_baseline`. Adds:

Top-level change risk posture — risk rating rubric, deploy strategy selection, monitoring signal naming, rollback trigger specification, and stakeholder notification requirements.

## Core rules

1. **Produce a risk rating (low / med / high / critical) with explicit justification tied to specific change characteristics.** — *Why:* a rating without justification is indistinguishable from a vibes assessment; reviewers cannot challenge or calibrate it, and on-call engineers cannot use it to set alert thresholds or escalation timelines.

2. **List every affected user segment, downstream service, and business process by name.** — *Why:* "some users" or "the API" is not actionable; an on-call engineer responding at 3 am needs to know whether the checkout flow, the reporting pipeline, or the authentication layer is the blast zone — and who to call first.

3. **Name the deploy strategy explicitly: canary, blue/green, rolling, feature flag, or straight-through — and justify the choice against the risk rating.** — *Why:* a high-risk change deployed straight-through contradicts the risk rating; naming the strategy forces the author to reconcile them and gives the approver a concrete thing to challenge.

4. **Name the monitoring signals that will detect breakage — dashboard link, CloudWatch alarm name, Datadog monitor ID, or SLO target — not just "we'll watch prod".** — *Why:* unnamed signals are not watched; the first indication of breakage becomes a customer report or a pager alert fired by someone else's dashboard, which adds minutes to MTTD and hours to MTTR.

5. **Name the rollback trigger: the specific signal and threshold that says "roll back now", and the expected time-to-rollback.** — *Why:* without a pre-agreed trigger, rollback decisions are made under pressure with incomplete information; agreeing on the threshold before deploy removes the ambiguity from the worst moment of an incident.

6. **List every stakeholder who must be notified before deploy: team leads, on-call engineer, support, and any downstream service owner whose SLA is affected.** — *Why:* unannounced deploys that affect adjacent teams create incident escalations that could have been pre-empted with a five-minute Slack message; the notification list ensures no stakeholder is surprised by the impact of a change they were not told was coming.

## Red flags

| Signal | Reality |
|---|---|
| "Low risk, it's just a small change" without justification | Diff size and risk are orthogonal; a one-line change to a shared auth middleware can be critical. State the blast radius, affected users, and deploy strategy — then the rating has evidence behind it. |
| "We'll watch prod after deploy" | Watching prod is not a monitoring plan. Name the specific CloudWatch alarm, Datadog dashboard panel, or SLO target, the threshold that triggers action, and the person who is watching. |

## Good vs bad

### Structured risk report vs ad-hoc risk claim

**Bad — ad-hoc "low risk" vibes claim**

> This PR adds a new field to the user profile response. Low risk, it's backwards compatible and we've tested it locally. Deploying straight to prod.

This tells an approver nothing actionable. There is no rating justification, no affected-user list, no monitoring plan, and no rollback trigger. If the field causes a serialisation error in a consumer that was not tested, the on-call engineer has no pre-agreed signal to act on and no rollback plan to execute.

**Good — structured risk report**

Use the template below and fill every field. A field left blank or filled with "N/A — see PR" is a gap that must be resolved before approval.

```
## Risk report

**Rating:** Medium
**Justification:** New field added to the `/users/:id` response; 3 downstream services consume
this endpoint. Two are confirmed forward-compatible; one (ReportService) uses a strict
deserialiser — verified compatible after config update in this PR.

**Affected users:** All authenticated users; profile reads affect the dashboard landing page
(~40 000 daily active users). No write path changed.

**Affected services:**
- ReportService (read, config updated in this PR)
- NotificationService (read, forward-compatible, no change needed)
- MobileApp v2.x (read, field is optional, confirmed by mobile team)

**Affected business processes:** User onboarding flow (profile completeness check), weekly
report export (ReportService consumes the new field for display only).

**Deploy strategy:** Feature flag (LaunchDarkly flag: `user-profile-extended-fields`)
- Phase 1: flag off — deploy to production, no user impact.
- Phase 2: flag on for 5 % of users — canary exposure for 30 minutes.
- Phase 3: if error rate stable, ramp to 100 % over 60 minutes.
- Kill switch: toggle flag off instantly via LaunchDarkly console to revert behaviour
  without a redeploy.

**Monitoring signals:**
- Datadog dashboard: "User Profile API — p99 latency + error rate" (link: <url>)
- CloudWatch alarm: `UserProfileEndpoint5xxRate` — fires if 5xx rate > 0.5 % over 5 minutes.
- CloudWatch alarm: `ReportServiceDeserialiseError` — fires on any deserialisation exception
  from ReportService; threshold: > 0 errors in 5 minutes.
- LaunchDarkly: flag evaluation metrics for `user-profile-extended-fields`.

**Rollback trigger:** If `UserProfileEndpoint5xxRate` alarm fires, or if any
`ReportServiceDeserialiseError` is observed, roll back immediately.

**Rollback path:** Toggle `user-profile-extended-fields` flag off in LaunchDarkly — instant,
no redeploy required. Estimated time-to-rollback: < 2 minutes.
If code revert is required: `git revert <sha>` + re-deploy; estimated time: ~8 minutes.

**Stakeholders notified before deploy:**
- @alice (backend lead, owns user-profile service) — approved.
- @bob (on-call engineer, week of 2026-04-22) — notified via #deployments Slack.
- @carol (ReportService owner) — confirmed compatibility, approved.
- @dave (mobile team lead) — confirmed MobileApp v2.x is unaffected.
- @support-lead — notified; no customer-facing change expected, no support brief required.
```

---

## Risk-rating rubric

The rating is a function of blast radius, reversibility, and business-process criticality. Apply the highest applicable tier — do not average them.

**Critical** — Any of the following: authentication or authorisation logic changed; payment or billing data path affected; data migration that cannot be reversed; change affects all users of a multi-tenant system simultaneously; on-call pager is the expected first signal of breakage. Critical changes require a deploy strategy that is not straight-through, a named rollback trigger agreed before deploy, and a change-advisory sign-off. Monitoring must be in place and verified before the deploy window opens.

**High** — Any of the following: change affects > 20 % of active users or > 1 000 concurrent sessions; a shared utility, middleware, or singleton is modified; an external API contract changes without a dual-support window; a feature flag is permanently removed (not toggled); a database index is dropped or a column type is changed. High-risk changes require a canary, blue/green, or feature-flag deploy, a named stakeholder per affected downstream, and a pre-agreed rollback trigger.

**Medium** — Any of the following: new field added to an existing API response consumed by ≥ 2 downstream services; background job schedule or retry behaviour changes; cache TTL or eviction policy changes; a new dependency with no prior production usage is added. Medium-risk changes should use a feature flag where possible, or a staged rollout. Monitoring signals must be named.

**Low** — All of the following: change is isolated to a single feature module with no shared-state surface; no external contract changes; blast radius is ≤ 3 importers all within the same service; the change is behind a feature flag that defaults off; rollback is a flag toggle. Low-risk changes may deploy straight-through with standard monitoring; a structured report is still recommended for audit purposes but the template may be abbreviated.

When the rating is contested, escalate to the higher tier. Underrating risk is always more costly than overrating it.

---

## Deploy strategy selection

Choose the strategy against the risk rating. Do not choose a lower-risk strategy than the rating demands without explicit written justification from the lead approver.

**Straight-through** — Deploy the new version to all instances simultaneously. Acceptable only for low-risk changes behind a feature flag that defaults off, or for changes with a blast radius limited to a single internal module with no shared-state surface. If anything breaks, the only recovery path is a revert-and-redeploy, which takes minutes. Never use straight-through for high or critical changes.

**Rolling** — Instances are replaced with the new version one at a time (or in small batches). At any point during the deploy, some instances run the old version and some run the new version. Suitable for medium-risk stateless services where the old and new versions are request-compatible. Not suitable for changes that are not backward-compatible with concurrent old-version requests (e.g., a database migration that removes a column the old version still reads).

**Canary** — A small fraction of traffic (typically 1–10 %) is routed to the new version. Monitor error rate, latency, and business metrics for the canary cohort before expanding. Suitable for high-risk user-facing changes. Requires that the routing layer supports weighted traffic splitting (e.g., AWS ALB weighted target groups, Kubernetes traffic splitting via a service mesh). Define the canary window duration and the expansion threshold before deploy — do not make them up during the deploy.

**Blue/green** — Two identical production environments; traffic is switched at the load balancer from the live (blue) environment to the new (green) environment. The blue environment remains intact and warm. Rollback is an immediate load-balancer switch, typically under 30 seconds. Use for critical changes, for changes that cannot tolerate a mixed-version state, and for deployments that require a clean cutover without gradual ramp. Blue/green requires maintaining two full environments simultaneously, which has cost implications for large infrastructure footprints.

**Feature flag (LaunchDarkly or equivalent)** — The new behaviour is deployed to all instances but remains inactive until the flag is toggled. Rollback is a flag toggle in the LaunchDarkly console with no redeploy required; estimated time-to-rollback is typically under two minutes. Feature flags are the preferred strategy for medium-to-high risk behavioural changes, A/B experiments, and changes that need a kill switch independent of the deployment pipeline. Ensure the flag is not permanent — schedule a cleanup ticket before the deploy. LaunchDarkly kill-switch procedure: navigate to the flag in the LaunchDarkly console, toggle the targeting to "Serve false" for all users, save. No infrastructure action required.

For any strategy other than straight-through, define the rollback procedure and the rollback trigger threshold before the deploy window opens. Do not improvise these during an incident.

---

## Monitoring signal selection

Monitoring signals are only useful if they are named, linked, and watched by a named person during the deploy window. "We'll watch prod" is not a signal; it is an intention that will not survive the first distraction.

**Error rate and latency** are the baseline signals for every deploy. Name the specific CloudWatch alarm or Datadog monitor, not just the metric. For a CloudWatch alarm, record the alarm name, the metric name, the threshold, and the evaluation period (e.g., `UserProfileEndpoint5xxRate` — `AWS/ApplicationELB HTTPCode_Target_5XX_Count`, threshold > 10 in 5 minutes, `TreatMissingData: notBreaching`). For a Datadog monitor, record the monitor ID and the alert condition. Link to the dashboard where both are visible together.

**Business-process signals** should accompany every change that touches a revenue path, a user-facing flow, or an SLA-bearing background job. For a checkout flow, monitor conversion rate. For a report export job, monitor job completion rate and error count. For a notification pipeline, monitor delivery rate. These signals often lag error-rate signals but catch a broader class of regression that does not produce HTTP 5xx responses (e.g., a job that completes with wrong data).

**Service-specific signals** for common patterns:

- **API endpoints:** CloudWatch `HTTPCode_Target_5XX_Count` and `TargetResponseTime` (p99) on the target group; Datadog APM service dashboard for throughput, error rate, and latency distribution.
- **Background jobs / queues:** CloudWatch `ApproximateNumberOfMessagesNotVisible` (SQS queue depth) and `NumberOfMessagesFailed`; Datadog infrastructure metric for worker CPU and memory; Dead Letter Queue depth alarm (`DLQDepth > 0`).
- **Database layer:** CloudWatch `DatabaseConnections`, `CPUUtilization`, and `ReadLatency`/`WriteLatency` on the RDS instance; Datadog Database Monitoring for slow queries and wait events; `pg_stat_activity` query count if using direct Postgres access.
- **Feature flags:** LaunchDarkly flag evaluation metrics — impression count, variation distribution, and error rate. An unexpected shift in variation distribution (e.g., the `true` cohort drops from 5 % to 0 %) is an early signal of a flag evaluation error.
- **External integrations:** Third-party API error rate and latency from the integration layer; dead-letter queue depth for async event delivery; webhook delivery failure rate if outbound webhooks are involved.

Set CloudWatch alarms to `TreatMissingData: breaching` for signals that should always be reporting. A gap in metrics is itself a signal of a problem — a service that stops emitting metrics has usually stopped working.

Verify that alarms are in `OK` state before the deploy window opens. An alarm that is already `ALARM` at deploy time provides no signal value — it must be resolved or acknowledged before the deploy proceeds.

---

## Stakeholder notification list

A stakeholder is anyone whose SLA, on-call rotation, or user-facing product is affected by a failure of the change. The notification list is agreed before deploy, not assembled during an incident.

**Always notify:**

- The **on-call engineer** for the affected service — by name, not by role. Post in the team's #deployments Slack channel with the deploy time, the risk rating, the rollback trigger, and the rollback procedure. The on-call engineer should acknowledge the message before the deploy window opens.
- The **team lead** for the service being deployed — they own the risk rating sign-off for high and critical changes.
- The **team lead for every downstream service** that is confirmed affected by blast-radius analysis. "Affected" means the downstream service may observe different behaviour, not just that it imports the changed module.

**Conditionally notify:**

- **Support lead** — notify whenever a change affects a user-facing flow, a pricing or billing path, or any feature that generates inbound support tickets. Provide a one-paragraph summary of the expected user impact and a timeline. If no user-facing change is expected, state that explicitly so support can confirm or challenge the assessment.
- **Product manager** — notify for changes that affect feature behaviour visible to end users, changes to A/B test variants, or changes that affect reported metrics used for product decisions.
- **Security team** — notify for any change to authentication, authorisation, session management, token handling, or data-access controls, regardless of how small the diff appears. Security implications are non-obvious from diff size.
- **Data / analytics team** — notify for any change that alters event shapes, tracking payloads, or database schemas that feed reporting pipelines. A schema change that looks safe for the application layer can silently break an analytics pipeline that depends on column presence.

**Escalation path for critical changes** — For critical-rated changes, notification is not sufficient. Require explicit written acknowledgement from the on-call engineer, the team lead, and every affected downstream service owner before the deploy window opens. Document the acknowledgements in the PR or the deploy ticket. If any stakeholder is unreachable, the deploy is blocked until they are reached or a named senior engineer accepts the risk in writing.

The notification list is also the call list if the rollback trigger fires. Verify that every person on the list is reachable (not on leave, not in a timezone that makes them unreachable during the deploy window) before committing to the deploy time.

---

## Review checklist

Produce a markdown report with the four sections below.

### Summary

One line stating the overall risk posture (e.g., "Medium-risk API field addition; feature-flag rollout, rollback < 2 min; approve pending support-lead acknowledgement").

### Findings

List each gap or concern as a row with `file:line`, severity (`blocker` / `concern` / `nit`), category (rating, affected-scope, deploy-strategy, monitoring, rollback, stakeholders), and the concrete fix.

| file:line | severity | category | fix |
|---|---|---|---|
| PR description:L12 | blocker | monitoring | Name the CloudWatch alarm and threshold instead of "we'll watch prod". |

### Safer alternative

Prefer a phased rollout (canary to 1 % to 10 % to 100 %, with a minimum observation window at each step) over an all-at-once deploy for any change touching a revenue path, authentication, or a shared data schema. Prefer a feature flag with a tested kill switch over a git-revert rollback whenever the behaviour can be gated — flag-toggle rollback is typically under two minutes, revert-and-redeploy is typically eight minutes or more. If the current plan is straight-through for a medium-or-above change, restate the plan as a phased rollout and justify why the lower-risk strategy is not feasible.

### Checklist coverage

Mark each Core rule `PASS`, `CONCERN`, or `NOT APPLICABLE` against the risk report under review.

| Rule | Status | Notes |
|---|---|---|
| 1. Risk rating with explicit justification | | |
| 2. Affected users, services, and business processes named | | |
| 3. Deploy strategy named and justified against rating | | |
| 4. Monitoring signals named with dashboard/alarm links | | |
| 5. Rollback trigger named with threshold and time-to-rollback | | |
| 6. Stakeholders notified before deploy (with acknowledgements for high/critical) | | |

## Interactions with other skills

- **Owns:** top-level risk posture.
- **REQUIRED BACKGROUND:** superpowers:regression-risk-check
- **Hands off to:** rollback-planning
- **Hands off to:** observability-first-debugging
- **Does not duplicate:** PR code review; domain skill findings (typescript-rigor, prisma-data-access-guard, etc.).
