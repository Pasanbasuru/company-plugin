---
skills_invoked:
  - superpowers:brainstorming
  - anthropic-tooling-dev
  - simplify
  - plugin-dev:plugin-structure
  - plugin-dev:skill-development
---

# Baseline-Standards Cleanup — Make `plugin/` Self-Contained

- **Date:** 2026-04-29
- **Status:** Draft — awaiting user review
- **Author:** Logan + Claude
- **Scope:** Closes parked follow-up item #6 (`templates/baseline-standards.md` runtime inheritance gap) by deleting the file outright rather than fixing the inheritance. Also deletes `templates/new-skill-template.md` (option (b) per brainstorm) since the canonical scaffold guidance lives in `docs/superpowers/skill-authoring-guide.md`. After this work, `plugin/` references nothing at the repo root — fully self-contained, ready to ship to a marketplace cache as a standalone unit. Supersedes the previously parked item: same problem, different resolution (delete vs. fix-the-inheritance).

## 1. Background

`templates/baseline-standards.md` is a 69-line / 8-section reference doc (TypeScript, security, observability, testing, a11y, performance, resilience, stack-assumed) that every domain skill in `plugin/skills/` references textually via a `## Assumes baseline-standards. Adds:` heading. It does **not** auto-load when a domain skill triggers in a consumer session — it's documentation, not runtime composition.

Two facts make it deletable:

1. **The model has these conventions in training data.** TypeScript `strict: true`, Zod validation at boundaries, structured JSON logs with correlation IDs, exponential-backoff retries — none of these are exotic; they're the canonical defaults. The "documented but not loaded" gap is a smaller real loss than the cross-boundary reference cost.
2. **The references break `plugin/`'s self-containment.** A consumer who installs the plugin via marketplace gets `plugin/` only — `templates/` lives at repo root and never reaches them. Every `## Assumes baseline-standards. Adds:` header in a shipped skill points at a file the consumer cannot resolve. Karpathy lens: less code, fewer moving parts; delete the dangling reference rather than build runtime machinery to honor it.

The 2026-04-28 plugin refactor explicitly accepted this gap (spec §4 non-goal). This spec withdraws that acceptance.

## 2. Problem statement

| # | Finding | Severity |
|---|---|---|
| F1 | `templates/baseline-standards.md` is referenced by 23 domain skills' `## Assumes baseline-standards. Adds:` heading + 1-line follow-on, but the file is at repo root and does not ship with `plugin/`. Consumers cannot resolve the reference. | High (consumer-facing inconsistency) |
| F2 | Six explicit body-text references to `templates/baseline-standards.md` exist in 4 skills (1 in `accessibility-guard`, 3 in `typescript-rigor`, 1 in `mobile-implementation-guard`, 1 in `supply-chain-and-dependencies`) — same problem, different prose locations. | High (consumer-facing inconsistency) |
| F3 | `plugin/README.md` line 17 introduces consumers to the baseline-standards concept and points at the repo-root path — guarantees consumer confusion. | Medium |
| F4 | `templates/new-skill-template.md` is a verifier-GREEN scaffold whose content includes the `## Assumes baseline-standards. Adds:` section. Once `baseline-standards.md` is deleted, the scaffold dangles. | Medium |
| F5 | Root `CLAUDE.md` (lines 29, 89), root `README.md` (lines 19, 28), and `docs/superpowers/skill-authoring-guide.md` (lines 16, 17, 38, 170, 171, 180) all reference baseline-standards as if it were a live design feature. After deletion these are stale. | Low (maintainer-side; doesn't affect consumers) |
| F6 | `docs/followups.md` item #6 tracks this gap as OPEN. Marking RESOLVED bookkeeps the resolution. | Low |

## 3. Approach — chosen

Single atomic commit. The repo never enters a state where some skills reference a deleted file. Pre-commit `pnpm verify` runs against the staged SKILL.md files and gates the commit on GREEN.

**Rejected alternatives:**

- **Multi-commit sequential** (e.g., commit 1 removes references, commit 2 deletes file, commit 3 updates docs). Each individual commit would leave the repo in a half-complete state where, e.g., the file still exists but no longer documents what skills assume, or the file is deleted but skills still reference it. Atomicity wins for cleanup work where the "in-flight" state is strictly worse than either endpoint.
- **Move `baseline-standards.md` into `plugin/`** (rather than delete). Solves the cross-boundary problem but adds runtime tokens for content the model already has in training. The user's direction was explicit: get rid of it.
- **Keep `templates/new-skill-template.md`, just rewrite its baseline section.** Option (a) from the brainstorm. Rejected via brainstorm: the `skill-authoring-guide.md` is already the canonical source for skill authors; two sources is two-source-of-truth drift waiting to happen.

## 4. Non-goals (explicitly parked)

- **Org-ai-tooling rename** (parked at `docs/superpowers/specs/2026-04-29-org-ai-tooling-rename-design.md`). That spec gets revisited *after* this cleanup lands — not bundled here. The rename's plan (`docs/superpowers/plans/2026-04-29-org-ai-tooling-rename.md`, currently uncommitted in the working tree) will need revision once the post-cleanup state is known. Both rename artifacts are marked DEFERRED in this commit so future readers know they're stale relative to the current repo state.
- **Item #4 (bootstrap rework).** Separate spec. Still parked.
- **Verifier code changes.** No changes to `scripts/verify/`. The `markers` check still requires at least one of `REQUIRED SUB-SKILL` / `REQUIRED BACKGROUND` / `Hands off to` / `Does not duplicate`. Mobile-implementation-guard has 3 `Hands off to` markers, so removing its single `REQUIRED BACKGROUND: \`templates/baseline-standards.md\`` line keeps the check satisfied without other adjustments. Verified via `scripts/verify/checks/markers.ts:5-48`.
- **Reformulating each domain skill's `## Purpose & scope` section.** Where a skill's purpose statement happens to mention "beyond `templates/baseline-standards.md`" (e.g., `typescript-rigor:11`), the prose is rewritten to drop the cross-reference, but the skill's intent and content otherwise stays put. No content rebalancing.

## 5. Locked decisions

### 5.1 — Delete `templates/baseline-standards.md`

Per Logan's direction. The 8 baseline sections (TypeScript, security, observability, testing, a11y, performance, resilience, stack-assumed) are in the model's training data and don't need to ship as a doc.

### 5.2 — Delete `templates/new-skill-template.md` and the `templates/` directory itself

Per option (b) from the brainstorm. Once both files in `templates/` are gone, the directory itself is empty and should be removed too. Skill authors are directed to `docs/superpowers/skill-authoring-guide.md` instead — that's where the canonical scaffold guidance landed in the 0.4.0 refactor.

### 5.3 — `## Assumes baseline-standards. Adds:` heading removal

For each of the 23 domain skills, **remove the heading and the one-line follow-on under it**. Do not replace with a different heading. The remaining content of each skill is self-contained (Core rules, Red flags, Review checklist, Interactions with other skills, etc., per the verifier shape).

The 23 skills (confirmed by grep `## Assumes` in `plugin/skills/`):

```
accessibility-guard, architecture-guard, auth-and-permissions-safety,
aws-deploy-safety, change-risk-evaluation, cicd-pipeline-safety,
coverage-gap-detection, frontend-implementation-guard, infra-safe-change,
integration-contract-safety, mobile-implementation-guard,
nestjs-service-boundary-guard, nextjs-app-structure-guard,
observability-first-debugging, performance-budget-guard,
prisma-data-access-guard, queue-and-retry-safety,
resilience-and-error-handling, secrets-and-config-safety,
state-integrity-check, supply-chain-and-dependencies,
test-strategy-enforcement, typescript-rigor
```

### 5.4 — Body-text reference disposition (per file)

| File | Line | Current | Action |
|---|---|---|---|
| `accessibility-guard/SKILL.md` | 75 | `- **Does not duplicate:** \`templates/baseline-standards.md\`'s accessibility floor; this skill enforces it in concrete review.` | Delete the bullet entirely. The remaining `Does not duplicate` line(s) on adjacent lines (if any) keep the marker satisfied. |
| `typescript-rigor/SKILL.md` | 11 (Purpose & scope) | `Enforce strong type discipline beyond \`templates/baseline-standards.md\`: model correctness-by-construction at boundaries…` | Rewrite to: `Enforce strong type discipline: model correctness-by-construction at boundaries and in domain code so invalid states are unrepresentable…` (drop the cross-reference; keep the rest of the sentence). |
| `typescript-rigor/SKILL.md` | 114 | `Options that go beyond \`templates/baseline-standards.md\`'s floor; add these to \`tsconfig.json\`:` | Rewrite to: `Recommended \`tsconfig.json\` options for projects that want stricter TS than the language's defaults:` (drop the cross-reference). |
| `typescript-rigor/SKILL.md` | 192 | `- **Does not duplicate:** \`templates/baseline-standards.md\`'s \`strict: true\` requirement — this skill adds rigour on top.` | Delete the bullet. |
| `mobile-implementation-guard/SKILL.md` | 293 | `- **REQUIRED BACKGROUND:** \`templates/baseline-standards.md\` — structural expectations shared with all domain skills.` | Delete the bullet. Verifier `markers` check still satisfied by 3 surviving `Hands off to:` bullets at lines 294–296. |
| `supply-chain-and-dependencies/SKILL.md` | 265 | `- **Does not duplicate:** \`templates/baseline-standards.md\`'s initial stack selection; \`architecture-guard\`'s enforcement of which internal packages may import which others.` | Rewrite to: `- **Does not duplicate:** \`architecture-guard\`'s enforcement of which internal packages may import which others.` (drop the baseline-standards clause; keep the architecture-guard clause). |

### 5.5 — Documentation updates

| File | Action |
|---|---|
| `plugin/README.md` line 17 | Rewrite the intro paragraph to drop the baseline-standards reference. New text: "Each skill is self-contained — no cross-references to anything outside the plugin. A pair of lightweight hooks (SessionStart + UserPromptSubmit) inject a brief skill-loading-discipline reminder; no MCP servers and no loggers ship with the plugin in 0.4.0." (Rest of paragraph after that point unchanged.) |
| Root `CLAUDE.md` line 29 (tree diagram) | Drop the `templates/` block from the tree diagram (3 lines: `├── templates/` line plus its `new-skill-template.md` and `baseline-standards.md` children). |
| Root `CLAUDE.md` line 89 (standing instruction) | Delete the entire bullet. The instruction telling skill authors to reference baseline-standards is moot once the file is gone. |
| Root `README.md` line 19 | Rewrite to drop the baseline-standards reference. New text: "Each skill is self-contained — domain skills hold their own rules. A pair of lightweight hooks (SessionStart + UserPromptSubmit) inject a brief skill-loading-discipline reminder; no MCP servers and no loggers ship with the plugin in 0.4.0." |
| Root `README.md` line 28 (layout table) | Delete the `templates/` row from the layout table. |
| `docs/superpowers/skill-authoring-guide.md` lines 16, 17 | Delete both bullets (the `templates/new-skill-template.md` and `templates/baseline-standards.md` entries). |
| `docs/superpowers/skill-authoring-guide.md` line 38 | Delete the entire item describing the `## Assumes` heading requirement. Renumber subsequent items if numbered. |
| `docs/superpowers/skill-authoring-guide.md` lines 170, 171 | Delete both bullets that describe what baseline-standards covers. |
| `docs/superpowers/skill-authoring-guide.md` line 180 | Delete the "Baseline leak" item. |
| `docs/followups.md` item #6 | Status: OPEN → RESOLVED in 2026-04-29. Strikethrough title (`~~\`templates/baseline-standards.md\` runtime inheritance gap~~`) per the item #3 precedent. Add resolution note pointing at this spec and the implementing commit. |

### 5.6 — Org-ai-tooling artifacts marked DEFERRED

| File | Action |
|---|---|
| `docs/superpowers/specs/2026-04-29-org-ai-tooling-rename-design.md` | Add a top-of-file callout: `> **STATUS: DEFERRED** — this spec was paused on 2026-04-29 to land the broader baseline-standards cleanup first (`docs/superpowers/specs/2026-04-29-baseline-standards-cleanup-design.md`). Some specifics in §5.5 (cross-references) and §6.2 (file-by-file map) will need revision once the cleanup lands, because `plugin/README.md` and root `CLAUDE.md` change. Revisit after that spec ships.` |
| `docs/superpowers/plans/2026-04-29-org-ai-tooling-rename.md` (currently uncommitted in working tree) | Add the same DEFERRED callout. Commit the file in the same commit so it's tracked and clearly marked stale, rather than leaving it as an untracked working-tree file. (Alternative considered: delete the plan file outright. Rejected: the plan represents real design work; keeping it with a DEFERRED marker is cheaper than re-deriving it from scratch later.) |

## 6. File-by-file map

### 6.1 — Deletions

| Path | Reason |
|---|---|
| `templates/baseline-standards.md` | Per §5.1 |
| `templates/new-skill-template.md` | Per §5.2 |
| `templates/` directory | Empty after the two deletions; remove via `git rm -r` (the directory naturally goes away when both files are removed and the commit lands) |

### 6.2 — Modifications inside `plugin/`

| Path | Lines / sections | Change |
|---|---|---|
| 23 `plugin/skills/<name>/SKILL.md` files (per §5.3) | The `## Assumes baseline-standards. Adds:` heading + the one-line follow-on under it | Delete both lines; preserve everything else |
| `plugin/skills/accessibility-guard/SKILL.md` | Line 75 | Delete the `Does not duplicate: templates/baseline-standards.md...` bullet |
| `plugin/skills/typescript-rigor/SKILL.md` | Line 11, 114, 192 | Per §5.4 |
| `plugin/skills/mobile-implementation-guard/SKILL.md` | Line 293 | Delete the `REQUIRED BACKGROUND: templates/baseline-standards.md` bullet |
| `plugin/skills/supply-chain-and-dependencies/SKILL.md` | Line 265 | Rewrite to drop the baseline-standards clause (keep the architecture-guard clause) |
| `plugin/README.md` | Line 17 area (intro paragraph) | Rewrite per §5.5 |

### 6.3 — Modifications outside `plugin/`

| Path | Change |
|---|---|
| `CLAUDE.md` (repo root) | Drop `templates/` block from tree diagram (around line 29); delete the standing-instruction bullet at line 89 |
| `README.md` (repo root) | Rewrite line 19; delete `templates/` row from layout table at line 28 |
| `docs/superpowers/skill-authoring-guide.md` | Edits at lines 16, 17, 38, 170, 171, 180 per §5.5 |
| `docs/followups.md` | Item #6 status update + strikethrough title + resolution note |
| `docs/superpowers/specs/2026-04-29-org-ai-tooling-rename-design.md` | DEFERRED callout per §5.6 |
| `docs/superpowers/plans/2026-04-29-org-ai-tooling-rename.md` | DEFERRED callout per §5.6 (also: add to git in this commit since the file is currently untracked) |

### 6.4 — Total churn

- 3 deletions (2 files + 1 empty directory cleanup)
- 23 sed-able heading removals + 6 surgical body-text edits + 1 README intro rewrite (within `plugin/`)
- 4 docs files updated outside `plugin/`
- 2 stale-spec/plan files marked DEFERRED

## 7. Commit sequence

Single atomic commit:

```
refactor: delete templates/, drop baseline-standards cross-references; plugin/ now self-contained
```

Rationale for atomicity:

- Any partial state is strictly worse than either endpoint. If we delete `templates/baseline-standards.md` first, the 23+ references dangle. If we remove the references first, the file is unreferenced but the doc is still there. Atomic avoids both.
- Pre-commit `pnpm verify` runs against staged SKILL.md files. With all 23 skills' `## Assumes` heading removed in one commit, the verifier sees the final consistent state. Each skill is checked independently and must pass.
- Single-commit cleanup is cleanly revertable: one `git revert` puts everything back.

## 8. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | A domain skill's content depends implicitly on baseline-standards rules in a way that becomes unclear after removal (e.g., `accessibility-guard` assumes WCAG 2.2 AA without restating it) | Medium | Low | Most skills are explicit about their domain rules; the `## Assumes` heading was a cross-reference, not load-bearing content. If a specific skill reads thin after removal, that's a follow-up issue, not a blocker for this cleanup. |
| R2 | Verifier `markers` check fails on a skill that loses its sole `REQUIRED BACKGROUND: baseline-standards` line and has no other markers | Low | Medium | Confirmed via grep: `mobile-implementation-guard` is the only skill with a `REQUIRED BACKGROUND` line referencing baseline, and it has 3 surviving `Hands off to:` markers. The other body-text references are `Does not duplicate` lines (also markers); removing them does not zero out a skill's marker count because each skill has at least one other `Hands off to` or `Does not duplicate` marker. To be safe, run `pnpm verify plugin/skills/*/SKILL.md` for every skill after edits. |
| R3 | Root `CLAUDE.md` standing instruction at line 89 (telling skill authors to reference `templates/baseline-standards.md`) is also referenced indirectly by other docs | Low | Low | Grep on commit pre-check (Task 1 of plan) catches any straggler references. |
| R4 | `templates/` directory survives the file deletions (e.g., due to a hidden file or git quirk) and shows up as empty in the repo | Low | Cosmetic | Run `ls templates/` post-edit; if anything's left, investigate; if empty, `git status` will confirm the directory is gone after `git add` of the deletions. |
| R5 | Org-ai-tooling rename DEFERRED callout text is wrong (e.g., points at the wrong spec path) | Low | Low | Self-review the DEFERRED callout text; the new spec path is `docs/superpowers/specs/2026-04-29-baseline-standards-cleanup-design.md` (this file). |
| R6 | `pnpm test` regression — a verifier test fixture references baseline-standards | Low | Low | Per grep, the only `REQUIRED BACKGROUND` references in `scripts/` are to `superpowers:brainstorming` (test fixtures), not to baseline-standards. Test suite is unaffected. Run `pnpm test` to confirm. |

## 9. Testing & verification

### 9.1 — Per-skill verifier (hard gate)

```bash
pnpm verify plugin/skills/<every-skill>/SKILL.md
```

Goal: every skill returns `Verdict: GREEN` (or pre-existing YELLOW; no new RED). Specifically:

- The 21 skills that were GREEN at 0.4.0 tip stay GREEN.
- The 2 YELLOW skills (`integration-contract-safety`, `observability-first-debugging` per `2026-04-28-plugin-refactor-design.md` audit) stay YELLOW (not regressing further).
- The current RED skill (`anthropic-tooling-dev`) stays RED — its rename is the *next* spec and out of scope here. The cleanup must not make it worse.

### 9.2 — Test suite

```bash
pnpm test
```

Goal: no regression from the `logan` tip count.

### 9.3 — Cross-reference grep (consumer-facing self-containment)

```bash
git grep "baseline-standards" plugin/
```

Goal: zero hits inside `plugin/`. This is the headline outcome of the cleanup — the consumer-facing surface no longer references a file outside it.

```bash
git grep "templates/" plugin/
```

Goal: hits only inside `plugin/templates/project/` (intra-plugin, not the deleted root-level `templates/`). Specifically, hits in `plugin/scripts/bootstrap-new-project.sh` referencing `$PLUGIN_ROOT/templates/project/...` are expected — those are intra-plugin references that survive (and are tracked separately as parked item #4).

### 9.4 — Repo-level grep (cleanup completeness)

```bash
git grep "baseline-standards"
```

Goal: hits limited to historical artifacts under `docs/superpowers/{audits,specs,plans}/` (immutable per the no-historical-edits convention) and the struck-through `docs/followups.md` item #6. Any hit in `plugin/`, root `CLAUDE.md`, root `README.md`, or `docs/superpowers/skill-authoring-guide.md` is a defect.

### 9.5 — Templates directory check

```bash
ls templates/ 2>&1
```

Goal: directory does not exist (or returns `No such file or directory`). If anything remains, investigate.

## 10. Acceptance criteria

The cleanup is complete when **all** of the following hold:

1. `templates/baseline-standards.md` does not exist.
2. `templates/new-skill-template.md` does not exist.
3. `templates/` directory does not exist (empty after both deletions).
4. `git grep "baseline-standards" plugin/` returns zero hits.
5. `git grep "templates/" plugin/` returns hits only inside `plugin/templates/project/` and `plugin/scripts/` (intra-plugin).
6. No `## Assumes baseline-standards. Adds:` heading appears in any `plugin/skills/*/SKILL.md`.
7. `pnpm verify` returns the same verdict-distribution as on the `logan` tip pre-commit (21 GREEN + 2 YELLOW + 1 RED `anthropic-tooling-dev`); no GREEN skill regresses to YELLOW or RED, no YELLOW regresses to RED.
8. `pnpm test` passes (no regression).
9. `plugin/README.md` line 17 area no longer references baseline-standards or `templates/`.
10. Root `CLAUDE.md` no longer references `baseline-standards.md` or the `templates/` directory.
11. Root `README.md` no longer has a `templates/` row in the layout table or a baseline-standards mention in the intro.
12. `docs/superpowers/skill-authoring-guide.md` no longer references baseline-standards or `templates/new-skill-template.md`.
13. `docs/followups.md` item #6 is marked RESOLVED with a strikethrough title and a resolution note pointing at this spec.
14. `docs/superpowers/specs/2026-04-29-org-ai-tooling-rename-design.md` and `docs/superpowers/plans/2026-04-29-org-ai-tooling-rename.md` carry a DEFERRED callout pointing at this spec.

## 11. Handoff

After Logan reviews and approves this spec, invoke `superpowers:writing-plans` to produce the implementation plan at `docs/superpowers/plans/2026-04-29-baseline-standards-cleanup.md`. The plan will decompose this spec into bite-sized tasks per the writing-plans template.

After this work lands, return to the org-ai-tooling rename: re-derive the rename plan against the new (post-cleanup) state of `plugin/README.md` and root `CLAUDE.md`, then execute. The original rename spec is largely still valid; only the cross-reference table in §5.5 and §6.2 of that spec will need revisiting against post-cleanup line numbers and surrounding text.
