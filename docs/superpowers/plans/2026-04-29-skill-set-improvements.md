# Skill Set Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Skill-loading discipline (NON-NEGOTIABLE — applies to every executor and every subagent dispatched from this plan):** Before substantive work, scan ALL skill descriptions in the system-reminder list and invoke EVERY relevant skill via the `Skill` tool. Required set for this plan: `org-ai-tooling`, every `plugin-dev:*` skill, `superpowers:writing-skills`, `superpowers:verification-before-completion`, `superpowers:subagent-driven-development` or `superpowers:executing-plans`, `simplify`, `skill-verification`. Subagents do NOT inherit parent skills/CLAUDE.md/memory — every subagent prompt MUST list required skills by exact name as a `Skill`-tool checklist task, MUST require a `skills_invoked:` YAML frontmatter block on the deliverable, and MUST repeat this rule verbatim so it propagates recursively.

**Goal:** Land the four improvements identified in the 2026-04-29 skill-set review (verifier YELLOWs, internal cross-references, description-form alignment) and run a baseline + post-change C1–C7 workflow audit, on branch `logan` so the changes ride the next dev → main promotion.

**Architecture:** Sequenced low-risk-first. Quick verifier fix → additive Interactions sections → run C1–C7 workflow audit on the resulting state → only if the audit shows missed or wrong triggers, do description rewrites and re-audit. Item 5 from the review ("don't add commands/agents/MCP") is a non-goal listed below to prevent scope creep.

**Tech Stack:** TypeScript skill verifier (`scripts/verify-skill.ts`), vitest test suite, pnpm. No app code. All changes are Markdown edits to files under `plugin/`.

**Branch:** `logan` (no new branch). Each task ends in a single commit.

**Non-goals (do NOT do as part of this plan):**
- Add `commands/`, `agents/`, or `.mcp.json` to the plugin — composes existing `superpowers:*`; no MCP needed.
- Promote dev → main or remove the `global-plugin-dev` marketplace entry — that is task #5 in the parent TaskList, gated on this plan completing AND manual install validation in a fresh Claude Code session.
- Rename skills, restructure categories, change on-disk skill layout, merge skills into routers.
- Edit any file outside `plugin/skills/*/SKILL.md` and `plugin/README.md`.

---

## File Structure

Files this plan touches:

| Path | Responsibility |
|---|---|
| `plugin/skills/integration-contract-safety/SKILL.md` | frontmatter description (Task 1) + Interactions section (Task 2) |
| `plugin/skills/observability-first-debugging/SKILL.md` | frontmatter description (Task 1) + Interactions section (Task 2) |
| `plugin/skills/<each-of-the-other-22>/SKILL.md` | Interactions section (Task 2); optionally description (Task 4) |
| `docs/superpowers/audits/2026-04-29-c1-c7-baseline.md` | Baseline audit report (Task 3) |
| `docs/superpowers/audits/2026-04-29-c1-c7-post-rewrite.md` | Post-rewrite audit report (Task 5, only if Task 4 ran) |

No source code in `scripts/` is modified. The verifier's `TRIGGER_VERBS` whitelist lives at `scripts/verify/checks/discoverability.ts:3-12` and is the source of truth for Task 1's word choices.

---

## Interactions mapping (used in Task 2)

This is the canonical pairing table the executor uses for every Task 2 step. The shape added to each skill is:

```markdown
## Interactions with other skills

- `<related-skill>` — <one-line context>
- `<related-skill>` — <one-line context>
- `<related-skill>` — <one-line context>
```

Section is inserted at the **end** of `SKILL.md` (after the existing final section). For skills that already have an Interactions section (`org-ai-tooling`), Task 2 only verifies it exists and skips re-adding.

| Skill | Related skills (the literal text to insert) |
|---|---|
| `accessibility-guard` | `frontend-implementation-guard` — a11y is a quality concern of every component change<br>`mobile-implementation-guard` — for RN/Expo a11y patterns and platform differences<br>`performance-budget-guard` — reduced motion + perf budgets interact |
| `architecture-guard` | `nextjs-app-structure-guard` — Next.js-specific structural concerns inside an app<br>`nestjs-service-boundary-guard` — NestJS-specific module/service boundaries<br>`supply-chain-and-dependencies` — when arch changes shift package boundaries |
| `auth-and-permissions-safety` | `secrets-and-config-safety` — token/cookie/session storage and rotation<br>`integration-contract-safety` — auth on public APIs and webhooks<br>`nestjs-service-boundary-guard` — where authN/authZ checks live in the service graph |
| `aws-deploy-safety` | `infra-safe-change` — IaC plan review precedes the runtime deploy<br>`cicd-pipeline-safety` — deploys typically run via CI with OIDC and required checks<br>`change-risk-evaluation` — rollout strategy, blast radius, rollback path |
| `change-risk-evaluation` | `aws-deploy-safety` — concrete deploy strategies inform risk rating<br>`observability-first-debugging` — monitoring signals and alarms during rollout<br>`cicd-pipeline-safety` — promotion gates and required checks |
| `cicd-pipeline-safety` | `aws-deploy-safety` — what the pipeline ultimately ships<br>`supply-chain-and-dependencies` — third-party action pinning and dep updates<br>`secrets-and-config-safety` — CI secrets, OIDC scopes, env-specific config |
| `coverage-gap-detection` | `test-strategy-enforcement` — pyramid shape and where new tests should live<br>`typescript-rigor` — types catch a class of bugs that would otherwise need tests |
| `frontend-implementation-guard` | `accessibility-guard` — every component change is also an a11y change<br>`performance-budget-guard` — bundle/render budgets and memoization<br>`nextjs-app-structure-guard` — when the change is in a Next.js app<br>`state-integrity-check` — UI state placement and cache/server consistency |
| `infra-safe-change` | `aws-deploy-safety` — runtime impact of IaC changes<br>`cicd-pipeline-safety` — how plans get applied and gated<br>`change-risk-evaluation` — destructive plan detection and blast radius |
| `integration-contract-safety` | `auth-and-permissions-safety` — auth on public APIs and webhooks<br>`queue-and-retry-safety` — event/queue contracts and consumer migration<br>`typescript-rigor` — DTOs, zod boundaries, and schema evolution |
| `mobile-implementation-guard` | `frontend-implementation-guard` — shared React patterns and component design<br>`accessibility-guard` — mobile a11y and platform-specific patterns<br>`performance-budget-guard` — bundle size, native module cost<br>`integration-contract-safety` — API contracts the mobile client consumes |
| `nestjs-service-boundary-guard` | `architecture-guard` — cross-service contracts and dependency direction<br>`prisma-data-access-guard` — where data access belongs in the service graph<br>`auth-and-permissions-safety` — guard placement on controllers/handlers |
| `nextjs-app-structure-guard` | `frontend-implementation-guard` — RSC vs client component implementation<br>`performance-budget-guard` — streaming, caching, edge runtime tradeoffs<br>`architecture-guard` — when changes cross route/module boundaries<br>`state-integrity-check` — server/client state boundary |
| `observability-first-debugging` | `resilience-and-error-handling` — typed errors and retry/circuit-breaker logs<br>`change-risk-evaluation` — monitoring signals during a rollout<br>`aws-deploy-safety` — CloudWatch/X-Ray wiring on AWS |
| `org-ai-tooling` | (already has `## Interactions with other skills` section — verify only, do not re-add) |
| `performance-budget-guard` | `frontend-implementation-guard` — render and memoization patterns<br>`nextjs-app-structure-guard` — caching layers, streaming, RSC tradeoffs<br>`prisma-data-access-guard` — query budgets, N+1, hot paths<br>`accessibility-guard` — reduced-motion and perceived perf |
| `prisma-data-access-guard` | `state-integrity-check` — cache invalidation and UI consistency on writes<br>`nestjs-service-boundary-guard` — repository placement in the service graph<br>`typescript-rigor` — DTO boundary and selection-shape typing |
| `queue-and-retry-safety` | `resilience-and-error-handling` — retry/jitter/circuit-breaker design<br>`integration-contract-safety` — event/payload schema evolution<br>`observability-first-debugging` — DLQ alarms and visibility-timeout monitoring |
| `resilience-and-error-handling` | `queue-and-retry-safety` — at-least-once retry semantics and idempotency<br>`observability-first-debugging` — error logs, traces, alarm wiring<br>`integration-contract-safety` — timeouts on external calls |
| `secrets-and-config-safety` | `auth-and-permissions-safety` — token/cookie handling on the auth path<br>`cicd-pipeline-safety` — CI secrets, OIDC, env-specific config<br>`aws-deploy-safety` — Secrets Manager and runtime env wiring |
| `state-integrity-check` | `prisma-data-access-guard` — server-side write paths and cache invalidation<br>`frontend-implementation-guard` — UI cache and optimistic update patterns<br>`nextjs-app-structure-guard` — server/client state boundary |
| `supply-chain-and-dependencies` | `cicd-pipeline-safety` — third-party action pinning, lockfile in CI<br>`secrets-and-config-safety` — npm tokens and registry auth<br>`architecture-guard` — cross-package dependency direction |
| `test-strategy-enforcement` | `coverage-gap-detection` — finding the untested critical paths<br>`typescript-rigor` — types vs tests for bug prevention |
| `typescript-rigor` | `test-strategy-enforcement` — types narrow the surface tests must cover<br>`prisma-data-access-guard` — type safety on queries and selection shape<br>`integration-contract-safety` — DTOs and zod boundaries on public APIs |

---

## Task 1: Fix the 2 YELLOW verifier findings

**Files:**
- Modify: `plugin/skills/integration-contract-safety/SKILL.md` (line 3, frontmatter `description:`)
- Modify: `plugin/skills/observability-first-debugging/SKILL.md` (line 3, frontmatter `description:`)

The verifier's whitelist of trigger verbs lives at `scripts/verify/checks/discoverability.ts:3-12`. The description must contain at least one whitelist word (`creating`, `editing`, `reviewing`, `verifying`, `debugging`, `deploying`, `refactoring`, `auditing`, `testing`, `designing`, `scaffolding`, `validating`, `analyzing`, `implementing`, `fixing`, `enforcing`, `ensuring`, `protecting`, `preventing`, `guarding`, `blocking`, `catching`, `evaluating`, `assessing`, `checking`, `monitoring`, `observing`, `tracing`, `handling`, `managing`, `planning`, `rolling`, `migrating`, `structuring`, `organizing`, `securing`, `hardening`). "Changing" is NOT in this list — that's the integration-contract-safety YELLOW.

- [ ] **Step 1: Run baseline verifier and capture findings**

Run:
```bash
pnpm verify plugin/skills/integration-contract-safety/SKILL.md plugin/skills/observability-first-debugging/SKILL.md 2>&1 | tee /tmp/yellow-baseline.txt
```
Expected: both report `Verdict: YELLOW` with at least one `[CONCERN] discoverability` line. Read the exact `message` and `fix` text — confirms what to change.

- [ ] **Step 2: Edit `integration-contract-safety` description**

Replace existing line 3 in `plugin/skills/integration-contract-safety/SKILL.md`. Change "Use when changing a public HTTP API" to use whitelist verbs:

```yaml
description: Use when reviewing or editing a public HTTP API, webhook payload, event schema, or any boundary another team/service depends on. Do NOT use for internal intra-module calls (use `nestjs-service-boundary-guard`). Covers API versioning, breaking-change detection, schema evolution, webhook/event contracts, consumer migration.
```

- [ ] **Step 3: Edit `observability-first-debugging` description**

The current description already contains "debugging" (a whitelist verb). The YELLOW is therefore from a different sub-check inside `discoverability.ts`. Re-run the verifier on this single file to read the exact finding:

```bash
pnpm verify plugin/skills/observability-first-debugging/SKILL.md
```

If the finding is `description lacks a trigger verb`: the line probably uses a verb form not on the whitelist (e.g. `debug` vs `debugging`). Adjust phrasing to use a whitelist word. Replace line 3 with:

```yaml
description: Use when debugging a production or staging issue, monitoring a hot path, or instrumenting code that should be observable. Do NOT use for local-only debugging of new code (use your IDE). Covers logs/metrics/traces-first method, structured logging, correlation ID propagation, alarm design.
```

If the finding is something else (e.g. stack-keyword check failing), apply the verifier's `fix:` text verbatim instead.

- [ ] **Step 4: Re-run verifier on both files**

Run:
```bash
pnpm verify plugin/skills/integration-contract-safety/SKILL.md plugin/skills/observability-first-debugging/SKILL.md 2>&1 | grep -E "^Verdict:"
```
Expected: `Verdict: GREEN` for both.

- [ ] **Step 5: Run full verifier sweep to confirm no regression**

Run:
```bash
pnpm verify plugin/skills/*/SKILL.md 2>&1 | grep -E "^Verdict:" | sort | uniq -c
```
Expected: `24 Verdict: GREEN` (was 22 GREEN + 2 YELLOW).

- [ ] **Step 6: Run vitest suite**

Run:
```bash
pnpm test
```
Expected: `46 passed (46)`.

- [ ] **Step 7: Commit**

```bash
git add plugin/skills/integration-contract-safety/SKILL.md plugin/skills/observability-first-debugging/SKILL.md
git commit -m "$(cat <<'EOF'
fix(skills): use whitelist trigger verbs in two flagged descriptions

Verifier's discoverability check whitelists a fixed set of trigger verbs
(scripts/verify/checks/discoverability.ts:3-12). Two skills used phrasings
outside the whitelist:

- integration-contract-safety: "changing" -> "reviewing or editing"
- observability-first-debugging: phrasing tightened so a whitelist verb
  appears in the trigger clause itself

Brings verifier sweep from 22 GREEN + 2 YELLOW to 24 GREEN. Tests 46/46.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add an `Interactions with other skills` section to each skill

**Files:** all 24 of `plugin/skills/<skill-name>/SKILL.md` (one section appended at end, except `org-ai-tooling` which already has it).

The exact content per skill is in the **Interactions mapping** table above. Each step inserts the section as the LAST section in the file (after any existing final section, before any closing `---` if present, with one blank line before).

For each skill below, the executor:
1. Reads the file end (last 30 lines) to confirm the file does not already end with an `Interactions` section.
2. Appends the section using the pairing from the mapping table, with the format:

```markdown

## Interactions with other skills

- `<related-1>` — <text>
- `<related-2>` — <text>
- `<related-3>` — <text>
```

3. No other edits.

- [ ] **Step 1: Verify `org-ai-tooling` already has the section (no edit)**

Run:
```bash
grep -c "^## Interactions with other skills" plugin/skills/org-ai-tooling/SKILL.md
```
Expected: `1` (already present from prior session). If `0`, add it from the mapping; otherwise skip.

- [ ] **Step 2: Append to `accessibility-guard`** — use the exact bullets for `accessibility-guard` from the mapping table.
- [ ] **Step 3: Append to `architecture-guard`** — use mapping.
- [ ] **Step 4: Append to `auth-and-permissions-safety`** — use mapping.
- [ ] **Step 5: Append to `aws-deploy-safety`** — use mapping.
- [ ] **Step 6: Append to `change-risk-evaluation`** — use mapping.
- [ ] **Step 7: Append to `cicd-pipeline-safety`** — use mapping.
- [ ] **Step 8: Append to `coverage-gap-detection`** — use mapping.
- [ ] **Step 9: Append to `frontend-implementation-guard`** — use mapping.
- [ ] **Step 10: Append to `infra-safe-change`** — use mapping.
- [ ] **Step 11: Append to `integration-contract-safety`** — use mapping.
- [ ] **Step 12: Append to `mobile-implementation-guard`** — use mapping.
- [ ] **Step 13: Append to `nestjs-service-boundary-guard`** — use mapping.
- [ ] **Step 14: Append to `nextjs-app-structure-guard`** — use mapping.
- [ ] **Step 15: Append to `observability-first-debugging`** — use mapping.
- [ ] **Step 16: Append to `performance-budget-guard`** — use mapping.
- [ ] **Step 17: Append to `prisma-data-access-guard`** — use mapping.
- [ ] **Step 18: Append to `queue-and-retry-safety`** — use mapping.
- [ ] **Step 19: Append to `resilience-and-error-handling`** — use mapping.
- [ ] **Step 20: Append to `secrets-and-config-safety`** — use mapping.
- [ ] **Step 21: Append to `state-integrity-check`** — use mapping.
- [ ] **Step 22: Append to `supply-chain-and-dependencies`** — use mapping.
- [ ] **Step 23: Append to `test-strategy-enforcement`** — use mapping.
- [ ] **Step 24: Append to `typescript-rigor`** — use mapping.

- [ ] **Step 25: Verify all 24 skills now have the section**

Run:
```bash
for f in plugin/skills/*/SKILL.md; do
  c=$(grep -c "^## Interactions with other skills" "$f")
  echo "$c $f"
done
```
Expected: every line begins with `1` (24 lines total). Any `0` line is a missed step — go back and add.

Then check no skill referenced in any Interactions block has a typo by grepping each referenced skill against the directory listing:

```bash
referenced=$(grep -A 30 "^## Interactions with other skills" plugin/skills/*/SKILL.md | grep -oE '`[a-z-]+`' | tr -d '`' | sort -u)
existing=$(ls plugin/skills | sort -u)
comm -23 <(echo "$referenced") <(echo "$existing")
```
Expected: empty output (all referenced skill names exist on disk).

- [ ] **Step 26: Run full verifier and tests**

Run:
```bash
pnpm verify plugin/skills/*/SKILL.md 2>&1 | grep -E "^Verdict:" | sort | uniq -c && pnpm test 2>&1 | tail -3
```
Expected: `24 Verdict: GREEN`, `46 passed (46)`.

- [ ] **Step 27: Commit**

```bash
git add plugin/skills/*/SKILL.md
git commit -m "$(cat <<'EOF'
feat(skills): add 'Interactions with other skills' section to each skill

Adds 2-4 named related skills + one-line context per skill (23 of 24;
org-ai-tooling already has this section). Internal navigability only —
no cross-references outside `plugin/`. References are prose names, not
@-imports, so they don't force-load context.

Mapping rationale documented in the implementation plan at
docs/superpowers/plans/2026-04-29-skill-set-improvements.md.

Verifier 24 GREEN, tests 46/46.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Run C1–C7 baseline workflow audit

**Files:**
- Create: `docs/superpowers/audits/2026-04-29-c1-c7-baseline.md`

The audit template lives at `docs/superpowers/testing-skills-against-workflows.md` (verified present). Per the `skill-verification` skill, full-mode is subagent-dispatched (expensive, manual only). One subagent that reads the template and runs the 7 checks.

- [ ] **Step 1: Read the audit template**

Run: `cat docs/superpowers/testing-skills-against-workflows.md | head -80`
Expected: a numbered C1–C7 check list. Confirms what the subagent will execute.

- [ ] **Step 2: Dispatch the C1–C7 audit subagent**

Use the `Agent` tool with `subagent_type: "general-purpose"`. Prompt template (paste verbatim, then save the result file at the path in step 3):

```
You are running a workflow-compatibility audit on the global-plugin skill set.
Your output is a single markdown report. Do NOT modify any files.

# Mandatory setup (do this FIRST, in order)

1. Invoke each of these skills via the `Skill` tool — these are NOT pre-loaded:
   - org-ai-tooling
   - plugin-dev:skill-development
   - skill-verification
   - superpowers:writing-skills
   - simplify
2. Write "Skills loaded: [comma-separated list]" as the first line of your report.
3. Propagate this rule recursively: if you spawn any subagent, list every relevant
   skill by exact name as a Skill-tool checklist task in its prompt and repeat
   this rule verbatim.

# Mode: consumer-audit (CRITICAL)

Trust ONLY `C:\Users\logan\Desktop\projects\org\global-plugin\plugin\`. Ignore
everything else in the repo (docs/, scripts/, root README, root CLAUDE.md,
.husky/) — those are maintainer infra and not in the consumer's plugin install.

# Task

Run the C1-C7 workflow-compatibility audit defined in
`docs/superpowers/testing-skills-against-workflows.md`. Apply each of the 7 checks
to the 24 skills in `plugin/skills/` collectively, not individually.

For each check (C1 through C7):
- Quote the check's intent from the template (one line).
- Apply it to the skill set.
- Verdict: PASS / CONCERN / FAIL.
- If CONCERN or FAIL: name the specific skill(s) and the specific failure mode.

# Deliverable

Output a single markdown document with this shape:

---
skills_invoked:
  - org-ai-tooling
  - plugin-dev:skill-development
  - skill-verification
  - superpowers:writing-skills
  - simplify
---

Skills loaded: [list]

# C1-C7 baseline workflow audit (2026-04-29)

## Summary
GREEN (no findings) / YELLOW (concerns) / RED (failures). One sentence verdict.

## C1: <name from template>
<intent>
Verdict: PASS/CONCERN/FAIL.
Findings: ...

## C2: ...
[same shape]

[...through C7]

## Cross-cutting recommendations
What to change (if anything) before description rewrite.

# Constraints
- Under 2500 words.
- No fluff.
- Do NOT modify any files.
```

- [ ] **Step 3: Save the subagent's report**

Write the subagent's output to `docs/superpowers/audits/2026-04-29-c1-c7-baseline.md` verbatim. The orchestrator inspects the `skills_invoked:` frontmatter; if missing, re-dispatch with the missing skills named explicitly.

- [ ] **Step 4: Decide whether Task 4 runs**

Read the audit's Summary verdict.
- If GREEN → skip Task 4 and Task 5; jump to Task 6 (final commit/PR).
- If YELLOW with only `Cross-cutting recommendations` that can be deferred → executor decides; default to skipping Task 4 unless the recommendation specifically calls out missed/wrong skill triggering.
- If YELLOW or RED on C-checks that test triggering quality (typically C3/C4/C5 — confirm in the template) → run Task 4.

Document the decision (one line) in `docs/superpowers/audits/2026-04-29-c1-c7-baseline.md` at the bottom under a `## Decision` heading: either `Task 4: SKIP. Reason: ...` or `Task 4: RUN. Affected skills: [list]. Reason: ...`.

- [ ] **Step 5: Commit the baseline audit**

```bash
git add docs/superpowers/audits/2026-04-29-c1-c7-baseline.md
git commit -m "docs(audit): C1-C7 baseline workflow audit on current skill set

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4 (CONDITIONAL — only run if Task 3's `## Decision` says RUN): Align descriptions to "Use when ..." form

This task is gated on Task 3. **Skip entirely if Task 3 verdict was GREEN or the Decision was SKIP.**

If running: rewrite descriptions for the skills named in Task 3's `Affected skills` list, using `superpowers:writing-skills` guidance — descriptions describe WHEN to use, not WHAT the skill does, no workflow summary, ideally <500 chars.

**Files:** `plugin/skills/<affected-skill>/SKILL.md` for each affected skill (line 3, frontmatter `description:`).

- [ ] **Step 1: For each affected skill, read current description**

For each skill `S` in Task 3's affected list:
```bash
sed -n '1,5p' "plugin/skills/$S/SKILL.md"
```
Capture the current `description:` line for context.

- [ ] **Step 2: Draft a new description using `superpowers:writing-skills` rules**

Per writing-skills:
- Start with `Use when ...`
- ONLY describe triggering conditions and symptoms. Do NOT summarize the skill body's workflow.
- Use a whitelist trigger verb (see Task 1 list at `scripts/verify/checks/discoverability.ts:3-12`).
- Include the skill's domain/stack keywords (see `STACK_KEYWORDS` in the same file).
- Keep under 500 characters when possible; verifier requires ≥100.
- Third-person.

Replace line 3 in the skill's SKILL.md with the new description.

- [ ] **Step 3: Run verifier on each edited skill**

For each edited skill `S`:
```bash
pnpm verify "plugin/skills/$S/SKILL.md"
```
Expected: GREEN. Any CONCERN/FAIL → re-edit.

- [ ] **Step 4: Run full verifier sweep + tests**

Run:
```bash
pnpm verify plugin/skills/*/SKILL.md 2>&1 | grep -E "^Verdict:" | sort | uniq -c && pnpm test 2>&1 | tail -3
```
Expected: `24 Verdict: GREEN`, `46 passed (46)`.

- [ ] **Step 5: Commit**

```bash
git add plugin/skills/*/SKILL.md
git commit -m "$(cat <<'EOF'
refactor(skills): align descriptions to 'Use when ...' triggering form

Task 3's C1-C7 audit flagged missed/wrong triggers on the skills listed
in the commit body. Per superpowers:writing-skills, descriptions describe
WHEN to use (triggering conditions), not WHAT the skill does (workflow).
Old "Covers X, Y, Z" suffixes that summarized scope were trimmed where
they overlapped the body's first paragraph.

Affected skills: <fill in from Task 3 decision list>

Verifier 24 GREEN, tests 46/46.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 (CONDITIONAL — only run if Task 4 ran): Re-run C1–C7 audit and confirm regression-free

**Files:**
- Create: `docs/superpowers/audits/2026-04-29-c1-c7-post-rewrite.md`

- [ ] **Step 1: Dispatch the audit subagent again**

Same prompt as Task 3 Step 2, with these changes:
- Output filename: `docs/superpowers/audits/2026-04-29-c1-c7-post-rewrite.md`
- Add a final section `## Comparison vs baseline (2026-04-29-c1-c7-baseline.md)` listing each previously-flagged issue and whether it is resolved, persists, or has new symptoms.

- [ ] **Step 2: Save and read the post-rewrite report**

Write subagent output to the file above. Read the Summary verdict.
- GREEN → done, proceed to Task 6.
- YELLOW or RED → previously-flagged issues still present, OR new issues introduced by the rewrite. Two options: revert Task 4's commit (`git revert <task-4-sha>`) and call it a learning, OR iterate on the specific descriptions called out and re-run Task 5. Default: **revert** unless the iteration is bounded to ≤3 skills and clearly fixable.

- [ ] **Step 3: Commit the post-rewrite audit**

```bash
git add docs/superpowers/audits/2026-04-29-c1-c7-post-rewrite.md
git commit -m "docs(audit): C1-C7 post-rewrite workflow audit confirms <verdict>

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Final verification and push

- [ ] **Step 1: Confirm working tree clean**

Run:
```bash
git status
```
Expected: `nothing to commit, working tree clean`.

- [ ] **Step 2: Final verifier + tests sweep**

Run:
```bash
pnpm verify plugin/skills/*/SKILL.md 2>&1 | grep -E "^Verdict:" | sort | uniq -c && pnpm test 2>&1 | tail -3
```
Expected: `24 Verdict: GREEN`, `46 passed (46)`.

- [ ] **Step 3: Push `logan` (and dev) for the user to re-test in Claude Code**

```bash
git push origin logan
git push origin logan:dev
```

- [ ] **Step 4: Hand off**

Tell the user: "Plan complete. `logan` and `dev` are pushed. Re-install `global-plugin-dev@global-plugins` and exercise the changed skills (Interactions sections, [reworded descriptions if Task 4 ran]). When validated, authorize the dev → main fast-forward + dev-marketplace-entry removal (parent TaskList #5)."

---

## Self-review (run after writing this plan, before handing off)

**1. Spec coverage.** The 5 review items are addressed:
- Item 1 (YELLOW verifier) → Task 1.
- Item 2 (Interactions sections) → Task 2.
- Item 3 (description form) → Task 4 (conditional on Task 3 audit).
- Item 4 (run C1-C7 audit) → Task 3 (baseline) + Task 5 (post-rewrite, conditional).
- Item 5 (don't add commands/agents/MCP) → listed in Non-goals.

No item is uncovered.

**2. Placeholder scan.**
- "Affected skills: <fill in from Task 3 decision list>" in Task 4's commit message is a literal fill-in for the executor when they know the list — acceptable because it depends on a runtime audit result, not on prior task state. Documented intent.
- No `TODO`, `TBD`, `implement later`, `add appropriate error handling`, or `similar to Task N` placeholders.
- Every code/edit step shows the exact text to write.

**3. Type/name consistency.**
- Skill names referenced in the Interactions mapping match disk directory names (verified by Step 25 grep).
- Verifier whitelist words referenced in Task 1 match `scripts/verify/checks/discoverability.ts:3-12` exactly.
- Audit report filenames consistent: `2026-04-29-c1-c7-baseline.md` and `2026-04-29-c1-c7-post-rewrite.md`.
- No mismatched function/type names since this plan does not add code.

Plan is self-consistent. Ready to execute.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-29-skill-set-improvements.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Fresh subagent per task with two-stage review between tasks. Best fit because Task 3 already requires subagent dispatch.

**2. Inline Execution** — REQUIRED SUB-SKILL: Use superpowers:executing-plans. Batch execution with checkpoints between tasks for the executor to confirm verifier+tests stay green.

**Which approach?**
