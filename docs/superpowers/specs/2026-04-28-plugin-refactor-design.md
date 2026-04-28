# Plugin Refactor — Design

- **Date:** 2026-04-28
- **Status:** Draft — awaiting user review
- **Author:** Logan + Claude (audit + brainstorming session)
- **Scope:** Refactor `plugin/` runtime to ship `global-plugin@0.4.0`. Drops four shipped defects, removes maintainer/meta surface from consumers, consolidates three duplicated guard skills, applies progressive disclosure to six oversized skills, and relocates `_baseline` out of the consumer-facing skill surface into a new repo-root `templates/` directory.

## 1. Background

A consumer-audit subagent ran a thorough review of `plugin/` on 2026-04-28. The plugin's *content* — the rules, descriptions, and domain knowledge inside each skill — is strong. The *packaging* has four shipped defects and several over-engineering issues that bloat the consumer surface.

The plugin is currently at `0.3.0`. After this refactor it ships as `0.4.0` (pre-1.0 minor bump = breaking changes acceptable).

## 2. Problem statement

The audit found four shipped defects that affect every consumer install:

| # | Finding | Severity |
|---|---|---|
| F1 | `plugin/.mcp.json` ships five `echo` placeholders that don't speak the MCP protocol — consumers see five permanently-broken servers in `/mcp`. | High |
| F2 | `plugin/.claude-plugin/plugin.json` declares a `dependencies` array, but Claude Code does not read this field. Consumers who skip installing `superpowers` / `frontend-design` / etc. get no error, and skill cross-references silently break. | High |
| F3 | `UserPromptSubmit` hook injects ~5KB on every prompt: full-roster regeneration of all skills + an "EXTREMELY_IMPORTANT" prose block. Re-injection on every prompt is pure context burn. | High |
| F4 | `PostToolUse` Write/Edit logger and `SessionStart` logger both append timestamps to `.claude/plugin-hook.log` in the consumer's CWD. No `.gitignore` shipped, no purpose served — it's litter. | Medium-High |

And six over-engineering issues that don't break behavior but bloat the surface:

| # | Finding | In-scope here? |
|---|---|---|
| F5 | No skill uses progressive disclosure. Six skills exceed 3,000 words. | Yes — split the six. |
| F6 | Maintainer/meta skills shipped to consumers (`skill-authoring`, `skill-verification`, `anthropic-tooling-dev`). | Partial — relocate `skill-authoring` and `skill-verification`; `anthropic-tooling-dev` parked. |
| F7 | Three skills (`change-risk-evaluation`, `regression-risk-check`, `rollback-planning`) overlap on PR-time review. | Yes — consolidate into one. |
| F8 | "Subagent propagation" instruction in `inject-skills-reminder.mjs` is theater — prose telling the model to do something it cannot enforce. | Yes — drop. |
| F9 | `_baseline` straddles two worlds: shipped as a consumer-facing skill, but its description and content are maintainer-only (skill-authoring template + cross-cutting standards reference). | Yes — relocate. |
| F10 | Bootstrap script clobber bug, broken template path, additive-merge concerns. | **Parked.** |

Goal: fix every shipped defect, remove maintainer surface from consumers, eliminate duplicated skills, lean down the bloated ones, and resolve the `_baseline` ambiguity. Leave parked items for a clearly-scoped follow-up.

## 3. Approach — chosen

Single sequential refactor producing 15 commits on the same branch. Each commit is independently revertable. Verification gates (vitest + skill-verifier + smoke test) at clearly-marked checkpoints. No worktree fan-out, no parallel branches — the refactor is well-scoped enough that boring sequential execution beats clever orchestration.

Rejected alternatives:
- **Critical defects only** — would defer over-engineering issues that are cheap to fix in the same pass; would also miss the natural sequencing between consolidation (commit 6) and progressive-disclosure splits (commits 8–13).
- **Phased: critical first, over-engineering later** — adds two complete planning ceremonies for one cohesive refactor. Overhead without payoff.
- **One giant PR** — review nightmare. Sequential commits with semantic boundaries are cheap and revertable.

## 4. Non-goals (explicitly parked)

These items came up during design and are intentionally **not** in this refactor:

- **`anthropic-tooling-dev` placement.** It currently ships at `plugin/skills/anthropic-tooling-dev/`. Decision deferred: should it move to project-local `.claude/skills/`, become a `templates/` reference doc, or stay as a consumer-facing skill? Logan wants to discuss after execution.
- **Bootstrap script and `plugin/templates/` consumer-onboarding tree.** The audit surfaced three issues: (a) the shipped `.claude/CLAUDE.md` template lives at a path Claude Code does not read, so it does literally nothing on the consumer side; (b) the bootstrap script overwrites existing files without warning; (c) the `.mcp.json` template ships the same broken `echo` placeholders this refactor removes from `plugin/.mcp.json`. The fix is non-trivial (additive JSON-merge logic for `settings.json`, relocate the CLAUDE.md template if any, delete the MCP template). Parked as a separate follow-up plan.
- **`_baseline` runtime inheritance fix.** The current refactor relocates `_baseline` out of `plugin/skills/` (resolving the consumer-facing skill ambiguity), but does not attempt to make the `## Assumes baseline-standards. Adds:` cross-reference auto-load in consumer sessions. Domain skills' baseline rules remain "documented but not loaded" — same as today, just with a doc reference instead of a sibling skill reference. The model has most baseline conventions in training data anyway; the practical loss is mild and accepting it is a deliberate Karpathy-style choice ("less code, fewer moving parts").

## 5. Locked decisions

Each decision below was made in brainstorming with Logan; rationales recorded so a future maintainer doesn't have to re-derive them.

### 5.1 — Manifest

| Decision | Choice | Rationale |
|---|---|---|
| `dependencies` array | Remove | Field is not honored by Claude Code; documenting it as if it were is misleading. Move list to `plugin/README.md` under "Recommended companion plugins" with explicit `claude plugin install` commands. |
| Version | `0.3.0` → `0.4.0` | Pre-1.0 minor bump. Skill removals + hook trim + MCP file removal = breaking by any reasonable interpretation. |
| Bump timing | Last commit | Every prior commit stays at `0.3.0`. If we cut at any earlier commit (rollback scenario), the tip is clearly an in-flight 0.3.x state. The version-bump commit is the explicit "this tip is `0.4.0`" marker. |

### 5.2 — MCP

| Decision | Choice | Rationale |
|---|---|---|
| `plugin/.mcp.json` | Delete entirely | Five `echo` placeholders are worse than no servers — they break `/mcp` permanently for the consumer. Empty `{"mcpServers": {}}` would be functionally equivalent to no file but adds nothing. README documents the placeholder names as a checklist for consumers to fill in. |
| `plugin/templates/project/.mcp.json` | **Parked** | Templates and bootstrap parked together as a separate follow-up. |

### 5.3 — Hooks

| Decision | Choice | Rationale |
|---|---|---|
| `PostToolUse` Write/Edit logger | Delete | Context-free timestamps appended to `.claude/plugin-hook.log` in consumer's CWD. No purpose. |
| `SessionStart` `mkdir/printf` logger sub-step | Delete | Same. |
| `inject-skills-reminder.mjs` SessionStart payload | Trim to one paragraph (~2 sentences) | Skill-loading-discipline reminder only; auto-discovery already exposes skill names + descriptions to the model, so the full-roster regeneration was redundant. |
| `inject-skills-reminder.mjs` UserPromptSubmit payload | One line (Logan's override of original "drop entirely") | Original Karpathy call was to drop UserPromptSubmit injection completely. Logan overruled: agents skip skill-loading discipline often enough in practice that a one-line reinforcement is cheap insurance. The line: *"global-plugin reminder: invoke EVERY relevant skill, not just the first one that matches. When dispatching subagents, name the required skills in the prompt and require a `skills_invoked:` YAML frontmatter block on the artifact."* |
| Subagent-propagation prose in injector | Drop | Theater — prose-as-enforcement cannot actually force subagents to do anything. If subagent propagation matters mechanically, the right primitive is a `PreToolUse` hook on `Agent` with `modifyToolInput`. That's its own design decision and not in scope here. |
| Inject script implementation | Strip the SKILL.md scanner, the YAML parser, the per-skill description rendering | The script's complexity existed solely to support the now-deleted full-roster regeneration. Fixed-payload emitter is a fraction of the code. |

### 5.4 — Skill surface (relocations & deletions)

| Decision | Choice | Rationale |
|---|---|---|
| `skill-verification` | Move to `.claude/skills/skill-verification/` (project-local) | Procedural skill describing how to run the maintainer-side verifier. No consumer use. Project-local placement auto-discovers in this repo, doesn't ship. |
| `skill-authoring` | Merge content into `docs/superpowers/skill-authoring-guide.md`, delete the skill directory | Existing guide already covers similar ground. Two sources of truth → one. |
| `regression-risk-check`, `rollback-planning` | Absorb into `change-risk-evaluation`, delete | Three skills triggered on the same diff with overlapping checklists. A router skill or delegation chain would add ceremony to mask duplication. Single skill keeps the most general name. |
| `_baseline` | Relocate to `templates/` at repo root, split into `new-skill-template.md` + `baseline-standards.md`, delete `plugin/skills/_baseline/` | See 5.5. |
| `anthropic-tooling-dev` | **Parked.** | See Non-goals (§4). |

### 5.5 — `_baseline` relocation

The most muddled decision. `_baseline` serves three roles:

1. **Authoring scaffold** — copy `_baseline/SKILL.md` to start a new skill; frontmatter, section headings, `[Placeholder]` markers are already verifier-GREEN.
2. **Cross-cutting standards reference** — TypeScript / security / observability / testing / a11y / performance / resilience rules live in this single file. Every domain skill says `## Assumes _baseline. Adds: ...` and inherits these textually.
3. **(Aspirational, half-broken) Runtime inheritance** — when a domain skill triggers in a consumer session, only the domain skill's SKILL.md loads. `_baseline` does not auto-load. The textual cross-reference is documentation, not runtime composition. The model has these conventions in training data anyway, so the practical loss is mild — but it is suboptimal compared to documented intent.

| Decision | Choice | Rationale |
|---|---|---|
| Where does `_baseline` belong? | Repo-root `templates/` directory (new) | It's authoring infrastructure (scaffold + standards reference), not consumer surface. `_baseline` shipping as a consumer-facing skill with a maintainer-only description was the source of the role muddle. |
| Why `templates/` and not `docs/`? | Logan's distinction: *"docs say what the codebase is and what it does. It isn't intended to be used for storing things that are technically part of the system."* The scaffold and standards reference are operational artifacts. | Templates is the right semantic. |
| File split | Two files: `templates/new-skill-template.md` (scaffold) + `templates/baseline-standards.md` (standards) | One file per role. Future authors know which one to copy (template) vs. which one to read (standards). |
| Domain skills' `## Assumes _baseline. Adds:` line | Rename to `## Assumes baseline-standards. Adds:` in the 23 surviving SKILL.md files (25 carry the line today; commits 5 and 6 delete `regression-risk-check` and `rollback-planning` before commit 7 runs the rename, so 23 files are actually edited) | Cross-reference becomes a doc reference; otherwise the line is identical in shape. |
| Runtime inheritance fix? | **Not in this refactor.** | See Non-goals (§4). |
| Verifier impact | None | Verifier doesn't hard-enforce the `_baseline` reference (confirmed by grep — single permissive test case in `frontmatter.test.ts:42-43` allows underscore-prefixed names but does not require any specific skill to exist). Verifier code untouched. |
| Disambiguation with existing `plugin/templates/` | None — different audiences, different scopes, different lifetimes | `plugin/templates/` is consumer-onboarding scaffolds (CLAUDE.md skeleton, settings.json) and ships to consumers via the plugin marketplace. New repo-root `templates/` is skill-author infrastructure and stays in the source repo. The `plugin/` boundary keeps them clearly separated. |

### 5.6 — Progressive disclosure (six fat skills)

| Decision | Choice | Rationale |
|---|---|---|
| Which skills get split? | Six: `accessibility-guard`, `cicd-pipeline-safety`, `queue-and-retry-safety`, `resilience-and-error-handling`, `secrets-and-config-safety`, `infra-safe-change` | All exceed 3,000 words. The other 22 skills are at 1,500-2,000 words and would not benefit. |
| Split shape | Trim `SKILL.md` to ≤2,000 words; create `references/patterns.md` (long code patterns) and `references/review-checklist.md` (full PR-time checklist) | Three files per skill. Lean SKILL.md keeps the trigger description, frontmatter, the 5-10 most essential numbered Core rules, Red flags table, Interactions section, and a brief Review checklist summary. |
| Pointer in lean SKILL.md | One line near bottom: *"For detailed code patterns, see `references/patterns.md`. For the full PR review checklist, see `references/review-checklist.md`."* | Lets Claude pull in the references files only when the work calls for them. |
| Apply same pattern to consolidated `change-risk-evaluation`? | Only if word count exceeds ~3,000 after the merge | Same threshold as the six fat skills. Decided in commit 6 based on actual post-merge word count. |
| Apply to all 28 skills? | No | A 1,500-word skill is already lean. Splitting it adds two extra files containing almost nothing, plus a pointer line that's a higher fraction of the file than the splitting saves. Pure ceremony. Apply where it pays back. |

### 5.7 — Documentation refresh

| Decision | Choice | Rationale |
|---|---|---|
| `plugin/README.md` | Refreshed for 0.4.0 — skill catalog (no removed skills; consolidated `change-risk-evaluation` description broadened); hook section reflects trimmed payloads + dropped loggers; new "Recommended companion plugins" subsection (former `dependencies` list); MCP section says no servers ship. | Consumer-facing source of truth must match what the plugin actually does. |
| `docs/superpowers/skill-authoring-guide.md` | Receives merged `skill-authoring/SKILL.md` content; new section pointing at `templates/new-skill-template.md` (scaffold) and `templates/baseline-standards.md` (standards reference). | Procedural authoring guide explaining how to use the new templates. |
| Repo root `CLAUDE.md` | Standing-instructions line about `_baseline` updates to reference `templates/baseline-standards.md`. | Maintainer-mode rules must reflect the new location. |
| Repo root `README.md` | Add `templates/` row to layout table (Shipped to consumers: No). | Layout table is the canonical inventory of what's in the repo. |

## 6. File-by-file map

### 6.1 — Manifest & MCP

| Operation | Path | Change |
|---|---|---|
| Modify | `plugin/.claude-plugin/plugin.json` | Remove `dependencies` array (commit 1). Version bump deferred to commit 15. |
| Delete | `plugin/.mcp.json` | Entire file removed (commit 2). |

### 6.2 — Hooks

| Operation | Path | Change |
|---|---|---|
| Modify | `plugin/hooks/hooks.json` | Remove `PostToolUse` Write/Edit logger block. Remove `mkdir/printf` SessionStart logger sub-step. Keep only the `inject-skills-reminder.mjs` invocations for `SessionStart` and `UserPromptSubmit`. |
| Rewrite | `plugin/hooks/inject-skills-reminder.mjs` | Strip SKILL.md scanner, YAML parser, per-skill description rendering, subagent-propagation prose. Emit fixed payloads: SessionStart = ~2-sentence skill-loading-discipline reminder; UserPromptSubmit = the one-line reminder per Logan's override. |

### 6.3 — Skills (relocations & deletions)

| Operation | Path | Change |
|---|---|---|
| Move | `plugin/skills/skill-verification/` → `.claude/skills/skill-verification/` | Project-local maintainer skill. |
| Merge + delete | `plugin/skills/skill-authoring/SKILL.md` → `docs/superpowers/skill-authoring-guide.md` | Merge content into existing guide; delete the skill directory. |
| Delete | `plugin/skills/regression-risk-check/` | Content absorbed into `change-risk-evaluation`. |
| Delete | `plugin/skills/rollback-planning/` | Content absorbed into `change-risk-evaluation`. |
| Delete | `plugin/skills/_baseline/` | Content split into `templates/`. |

### 6.4 — Skills: `change-risk-evaluation` consolidation

| Operation | Path | Change |
|---|---|---|
| Modify | `plugin/skills/change-risk-evaluation/SKILL.md` | Absorb unique rules + review-checklist content from `regression-risk-check` and `rollback-planning`. Broaden trigger description. If merged word count exceeds ~3,000, apply progressive disclosure inline (split to `references/patterns.md` + `references/review-checklist.md`). |

### 6.5 — `templates/` (new top-level directory at repo root)

| Operation | Path | Change |
|---|---|---|
| Create | `templates/new-skill-template.md` | Scaffold portion of current `_baseline/SKILL.md`: frontmatter shape, section headings, `[Placeholder]` markers, scaffolding guidance for authors. ~50 lines. |
| Create | `templates/baseline-standards.md` | Standards portion of current `_baseline/SKILL.md`: TypeScript, Security-by-default, Observability floor, Testing floor, Accessibility floor, Performance floor, Resilience floor, Stack assumed. Add header explaining what the doc is and that domain skills' `## Assumes baseline-standards. Adds:` lines reference it. ~80 lines. |
| Modify (23 files) | `plugin/skills/<every-surviving-domain-skill>/SKILL.md` | Rename `## Assumes _baseline. Adds:` → `## Assumes baseline-standards. Adds:`. |

The 23 affected domain skills (those that carry the line *and* survive commits 4–6): `accessibility-guard`, `architecture-guard`, `auth-and-permissions-safety`, `aws-deploy-safety`, `change-risk-evaluation`, `cicd-pipeline-safety`, `coverage-gap-detection`, `frontend-implementation-guard`, `infra-safe-change`, `integration-contract-safety`, `mobile-implementation-guard`, `nestjs-service-boundary-guard`, `nextjs-app-structure-guard`, `observability-first-debugging`, `performance-budget-guard`, `prisma-data-access-guard`, `queue-and-retry-safety`, `resilience-and-error-handling`, `secrets-and-config-safety`, `state-integrity-check`, `supply-chain-and-dependencies`, `test-strategy-enforcement`, `typescript-rigor`.

`regression-risk-check` and `rollback-planning` carry the line today but are deleted in commit 6 before the rename runs, so they don't get edited at commit 7 — their content was already absorbed into the surviving `change-risk-evaluation` (which keeps its own `## Assumes` line and gets renamed normally). The four maintainer skills (`_baseline`, `skill-authoring`, `skill-verification`, `anthropic-tooling-dev`) are either deleted, moved, merged into docs, or parked, so commit 7 doesn't touch them.

### 6.6 — Skills: progressive disclosure (six splits)

For each of `accessibility-guard`, `cicd-pipeline-safety`, `queue-and-retry-safety`, `resilience-and-error-handling`, `secrets-and-config-safety`, `infra-safe-change`:

| Operation | Path | Change |
|---|---|---|
| Modify | `plugin/skills/<skill>/SKILL.md` | Trim to ≤2,000 words. Keep frontmatter, Purpose & scope, Assumes-baseline-standards line, the 5-10 most essential numbered Core rules, Red flags table, Interactions with other skills, brief Review checklist summary. Add pointer line near bottom referencing `references/patterns.md` and `references/review-checklist.md`. |
| Create | `plugin/skills/<skill>/references/patterns.md` | "Good vs bad" code blocks, detailed pattern walkthroughs, longer prose explanations. |
| Create | `plugin/skills/<skill>/references/review-checklist.md` | Full PR-time review checklist with required explicit scans. |

### 6.7 — Documentation

| Operation | Path | Change |
|---|---|---|
| Modify | `plugin/README.md` | Skill catalog, hook section, MCP section, Recommended companion plugins subsection, version `0.4.0`. |
| Modify | `docs/superpowers/skill-authoring-guide.md` | Receives merged `skill-authoring/SKILL.md` content + section pointing at `templates/`. |
| Modify | `CLAUDE.md` (repo root) | Update standing-instructions line for `_baseline` → `templates/baseline-standards.md`. |
| Modify | `README.md` (repo root) | Add `templates/` row to layout table (Shipped: No). |

### 6.8 — Total churn

- **5 deletions** (1 MCP file, 4 skill directories: `regression-risk-check`, `rollback-planning`, `_baseline`, `skill-authoring`)
- **1 move** (`skill-verification` → `.claude/skills/`)
- **2 created files** in `templates/`
- **12 created files** across the six progressive-disclosure splits
- **37 file modifications** (1 manifest + 2 hook files + 23 domain skills' `Assumes` line + 1 `change-risk-evaluation` consolidation + 6 fat-skill SKILL.md trims + plugin/README + skill-authoring-guide + root CLAUDE.md + root README — note that `plugin/.claude-plugin/plugin.json` is touched twice, in commits 1 and 15, but counts as one file)

## 7. Commit sequence

15 commits, sequential, each independently revertable.

| # | Commit | Files |
|---|---|---|
| 1 | `chore: drop dead dependencies field from manifest` | `plugin/.claude-plugin/plugin.json` |
| 2 | `feat!: remove broken MCP placeholder file` | Delete `plugin/.mcp.json` |
| 3 | `refactor(hooks): drop loggers, simplify inject-skills-reminder` | `plugin/hooks/hooks.json`, `plugin/hooks/inject-skills-reminder.mjs` |
| 4 | `refactor(skills): relocate skill-verification to project-local` | Move `plugin/skills/skill-verification/` → `.claude/skills/skill-verification/` |
| 5 | `refactor(docs): merge skill-authoring guide` | Merge content into `docs/superpowers/skill-authoring-guide.md`, delete `plugin/skills/skill-authoring/` |
| 6 | `refactor(skills): consolidate change-risk-evaluation` | Modify `change-risk-evaluation/SKILL.md`, delete `regression-risk-check/` and `rollback-planning/` |
| 7 | `refactor: relocate _baseline to templates/ at repo root` | Create `templates/new-skill-template.md`, `templates/baseline-standards.md`; delete `plugin/skills/_baseline/`; rename `## Assumes _baseline. Adds:` → `## Assumes baseline-standards. Adds:` in surviving domain skills; update root `CLAUDE.md` + `README.md` references. **Atomic** — relocation + skill-text update travel together. |
| 8 | `refactor(skills): split accessibility-guard` | Trim SKILL.md, create `references/patterns.md` + `references/review-checklist.md` |
| 9 | `refactor(skills): split cicd-pipeline-safety` | Same shape |
| 10 | `refactor(skills): split queue-and-retry-safety` | Same shape |
| 11 | `refactor(skills): split resilience-and-error-handling` | Same shape |
| 12 | `refactor(skills): split secrets-and-config-safety` | Same shape |
| 13 | `refactor(skills): split infra-safe-change` | Same shape |
| 14 | `docs(plugin): refresh README for 0.4.0` | `plugin/README.md` |
| 15 | `chore: bump plugin version to 0.4.0` | `plugin/.claude-plugin/plugin.json` (version field only) |

**Sequencing rationale:**
- Commits 1-2 are isolated, low-risk hygiene fixes; placed first so the simplest changes ship before the complex ones.
- Commit 3 (hook simplification) is self-contained and high-value (eliminates per-prompt context burn immediately).
- Commits 4-5 are independent skill relocations.
- Commit 6 (consolidation) precedes commits 8-13 (progressive-disclosure splits) because the merge could in principle pull content from a skill that's about to be split — though `regression-risk-check` and `rollback-planning` are not in the fat-six list, the principle of "merge before split" stands.
- Commit 7 is intentionally atomic. The 23 skill text edits (rename of `## Assumes` line) and the relocation of `_baseline` to `templates/` are inseparable: they must travel together so the repo never has a state where the line points at a missing reference.
- Commits 8-13 are six identical-shape splits, one per fat skill. Order within these six is arbitrary; alphabetic for predictability.
- Commit 14 (README) precedes the version bump so the bumped version aligns with documentation.
- Commit 15 (version bump) is last. Every prior commit stays at `0.3.0`; tip is unambiguously `0.4.0`.

## 8. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | `_baseline` relocation breaks the verifier | Low | Low | Verifier doesn't hard-enforce the `_baseline` reference (confirmed). Test in `frontmatter.test.ts:42-43` allows underscore-prefixed names but does not require any specific skill. Run `pnpm test` after commit 7. |
| R2 | Domain skills' `Assumes baseline-standards` line referenced by something downstream | Low | Low | Searched: only `_baseline/SKILL.md` itself + the 25 domain skills carry the pattern. No verifier check, no docs/scripts dependency. |
| R3 | Trimmed hooks change consumer behavior in unexpected ways | Medium | Medium | New SessionStart payload preserves the skill-loading-discipline rule (per Logan's override). UserPromptSubmit reduced to a one-liner (also per override). Smoke test against a fixture before merging commit 3. |
| R4 | Progressive-disclosure splits drop a critical rule from the lean SKILL.md | Medium | Medium | For each of the six splits, the SKILL.md must keep all numbered Core rules + the trigger description. Only "Good vs bad" code walkthroughs and verbose review-checklist explanations move to `references/`. Per-split smoke test: trigger the skill against a fixture, confirm rules are still cited. |
| R5 | `change-risk-evaluation` consolidation drops unique rules from `regression-risk-check` or `rollback-planning` | Medium | Medium | Diff each source skill's rules and review-checklist sections. Every unique rule must surface in the consolidated skill. If merged skill exceeds ~3,000 words, apply progressive disclosure inline (in commit 6). |
| R6 | Consumer's pre-existing `.claude/plugin-hook.log` files keep accumulating | Low | Cosmetic | Document in plugin/README's 0.4.0 release notes that consumers can delete the file; the hook no longer writes to it. |
| R7 | Pre-1.0 breaking-change semantics not honored by every plugin marketplace | Low | Low | The `dependencies` field was never auto-installed in the first place, so removing it loses no working behavior — just stops misleading the consumer. Other breaking changes (skill removals, hook trim) get a "0.4.0 breaking changes" section in plugin/README. |
| R8 | Verifier test for underscore-prefixed names becomes orphan | Low | None | Test in `frontmatter.test.ts:42-43` confirms the validator *allows* underscore-prefixed names. Test still passes after `_baseline` removal. Leave it alone. |

**Rollback strategy:** every commit is independently revertable. Sequential ordering means reverting commits 15 → 1 in reverse leaves the repo in a working `0.3.0` state at any point. The husky pre-commit hook (`pnpm verify` on staged SKILL.md) is the per-commit gate.

## 9. Testing & verification

### 9.1 — Per commit (automatic)

Husky pre-commit hook runs `pnpm verify` on any staged `plugin/skills/*/SKILL.md`. Blocks the commit on verifier FAIL.

### 9.2 — Per commit (manual, when relevant)

- `pnpm test` after any commit touching `scripts/` or that the verifier could catch (commits 6, 7, 8-13). One vitest run.
- `pnpm verify plugin/skills/<changed-skill>/SKILL.md` for each modified skill.

### 9.3 — Targeted checkpoints

- **After commit 3** (hooks): execute `node plugin/hooks/inject-skills-reminder.mjs SessionStart` and `node plugin/hooks/inject-skills-reminder.mjs UserPromptSubmit` directly. Confirm output is the trimmed payload, valid JSON, and the `additionalContext` field carries the new short prose.
- **After commit 6** (consolidation): word-count the merged `change-risk-evaluation/SKILL.md`. If >3,000, apply progressive disclosure inline (same commit).
- **After commit 7** (`_baseline` relocation): full `pnpm test` + spot `pnpm verify` on three domain skills.
- **After each of commits 8-13**: word-count the trimmed SKILL.md to confirm ≤2,000; verifier check on the skill.

### 9.4 — Final smoke test (after commit 15)

From a clean fixture directory (not the repo root — per the test-isolation rule in `CLAUDE.md`):

```bash
cd /tmp/fixture-project
claude --plugin-dir /absolute/path/to/global-plugin/plugin
```

Verify in-session:
1. `/help` lists the new skill set: no `_baseline`, `skill-authoring`, `skill-verification`, `regression-risk-check`, `rollback-planning`. `change-risk-evaluation` description reflects the broadened scope.
2. `/mcp` shows no servers (graceful empty, no `echo` placeholders).
3. SessionStart additional context is the trimmed paragraph.
4. UserPromptSubmit additional context on a test prompt is the one-liner.
5. Trigger `accessibility-guard` with a test prompt referencing accessibility — confirm the lean SKILL.md loads, the `references/` files exist, and the model can pull them in when needed.

## 10. Acceptance criteria

The refactor is complete when:

1. `pnpm test` passes (vitest skill-verifier suite).
2. `pnpm verify plugin/skills/<every-skill>/SKILL.md` passes for every remaining skill.
3. From a clean fixture directory, `claude --plugin-dir <plugin>` produces the expected behavior on the five smoke-test items above.
4. `plugin/.claude-plugin/plugin.json` is at version `0.4.0` and has no `dependencies` field.
5. Repo root contains a new `templates/` directory with two files (`new-skill-template.md`, `baseline-standards.md`).
6. No skill in `plugin/skills/` carries the line `## Assumes _baseline. Adds:` — every domain skill uses `## Assumes baseline-standards. Adds:`.
7. `plugin/.mcp.json` does not exist.
8. `plugin/skills/_baseline/`, `plugin/skills/skill-authoring/`, `plugin/skills/skill-verification/` (moved), `plugin/skills/regression-risk-check/`, `plugin/skills/rollback-planning/` do not exist.
9. `plugin/hooks/hooks.json` has no `PostToolUse` block and no `mkdir/printf` logger sub-steps in `SessionStart`.
10. `plugin/README.md` documents the 0.4.0 changes including the "Recommended companion plugins" section.
11. Implementation plan exists at `docs/superpowers/plans/2026-04-28-plugin-refactor.md` (produced by the next step, `superpowers:writing-plans`).

## 11. Handoff

After Logan reviews and approves this spec, invoke `superpowers:writing-plans` to produce the implementation plan at `docs/superpowers/plans/2026-04-28-plugin-refactor.md`. The plan will decompose this spec into bite-sized tasks per the `superpowers:writing-plans` template.
