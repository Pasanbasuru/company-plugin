---
skills_invoked:
  - superpowers:brainstorming
  - anthropic-tooling-dev
  - simplify
  - plugin-dev:plugin-structure
  - plugin-dev:skill-development
  - plugin-dev:hook-development
  - plugin-dev:mcp-integration
---

# `org-ai-tooling` — Rename + Trigger Tighten + Verifier-Shape Conformance

- **Date:** 2026-04-29
- **Status:** Draft — awaiting user review
- **Author:** Logan + Claude
- **Scope:** Closes parked follow-up #5 from `docs/followups.md` (anthropic-tooling-dev placement). Renames the skill to `org-ai-tooling`, rewrites the description in verifier-compliant `Use when …` form so it triggers only on Claude Code tooling work, and restructures the body to satisfy the four-section domain-skill shape so the verifier goes from RED to GREEN.

## 1. Background

`plugin/skills/anthropic-tooling-dev/` was kept (deferred from the 0.4.0 refactor) as a "Maintainer / experimental" entry in `plugin/README.md`'s skill catalog. The 0.4.0 acceptance pass left it RED in the verifier with the note that the RED was expected and parked.

Three things were always going to be done together:
1. Decide the name (Logan: keep, but rename).
2. Tighten the description so it fires on tooling work and not on every TypeScript edit a consumer makes.
3. Close the verifier RED so `pnpm verify` is fully GREEN across the consumer-facing skill surface.

This spec bundles all three because they touch the same file and the rename has cross-references in `plugin/README.md`, root `CLAUDE.md`, and `docs/followups.md`. Splitting them would leave the repo in inconsistent intermediate states.

## 2. Problem statement

| # | Finding | Severity | Source |
|---|---|---|---|
| F1 | Name `anthropic-tooling-dev` no longer matches purpose — skill is about Claude Code / AI tooling generally, not Anthropic-internal work. | Low | Logan's direction this session. |
| F2 | Description does not start with `Use when` and lacks a concrete trigger verb. | Medium (CONCERN) | `pnpm verify` output. |
| F3 | Description is path-blind — model interprets "claude code plugin / skill / hook / agent" loosely and the skill auto-triggers on app code that has nothing to do with the harness. | Medium | Karpathy-mode review (consumer-impact: skill burns context on irrelevant work). |
| F4 | `SKILL.md` is missing the four sections the verifier requires of any plugin skill: `Core rules`, `Red flags`, `Review checklist`, `Interactions with other skills`. The skill *has* equivalent content (`The Mindset` ≈ Core rules, `Red Flags — you are NOT in this mindset` ≈ Red flags, `What "done" looks like` ≈ Review checklist) but under different headings, and `Interactions with other skills` is missing entirely. | High (FAIL × 4) | `pnpm verify` output. |
| F5 | Two physical copies exist: `plugin/skills/anthropic-tooling-dev/SKILL.md` (ships to consumers) and `.claude/skills/anthropic-tooling-dev/SKILL.md` (project-local, used when maintaining this repo because the plugin is not dogfooded on itself). They are intentional duplicates per `CLAUDE.md`'s no-dogfooding rule. The rename must touch both. | Operational | Glob check this session. |
| F6 | Description currently uses `This skill should be used when …` (third-person), which the verifier flags as missing the `Use when` imperative. | Medium (CONCERN) | `pnpm verify` output. |

## 3. Approach — chosen

Single atomic commit. The rename, description rewrite, body restructure, and cross-reference updates all touch interconnected text — splitting them produces a repo state where, e.g., the SKILL.md says `name: org-ai-tooling` but the directory is still `anthropic-tooling-dev`, or `plugin/README.md` references a skill that no longer exists. Atomic commit is the correct shape.

**Rejected alternatives:**

- **Rename-only commit, defer verifier-shape fix to a separate spec.** Loses the parked-item closure — the whole point of taking on item #5 was closing the RED, and a follow-up spec adds ceremony for what fits in one commit.
- **Verifier-code change to add a `kind: reference` exemption** for skills that aren't domain-guard skills. Cleaner architecturally but is a TypeScript change to `scripts/verify/` for one skill's benefit. YAGNI — fit the shape instead.
- **Move to `templates/` or `.claude/skills/` only** (drop the consumer-facing copy). Logan: stay. Closed.

## 4. Non-goals (explicitly parked)

- **Verifier code changes.** The verifier expectations are fitted, not relaxed.
- **Body persona phrasing edits.** "You are a senior engineer at Anthropic … you think the way Karpathy thinks …" — the Anthropic phrasing is editorial flavor, not a structural concern of this rename. Logan can revisit in a future cosmetic pass; out of scope here.
- **Item #6 (`_baseline` runtime inheritance gap).** `plugin/` currently has ~29 references pointing at the repo-root `templates/baseline-standards.md` — 23 `## Assumes baseline-standards. Adds:` headings, 5 explicit body-text mentions, 1 README prose mention. By a strict "plugin/ must be self-contained" standard, those are all defects. They predate this work and are tracked as item #6. **This spec deliberately does NOT add a 24th `## Assumes baseline-standards. Adds:` line** to `org-ai-tooling` SKILL.md — the new skill stays self-contained on that axis. The existing 23 violations remain parked under item #6 and will be addressed in a separate spec.
- **Item #4 (bootstrap rework).** Separate spec.
- **Sync mechanism for the two copies.** A pre-commit hook that diffs `plugin/skills/<name>` against `.claude/skills/<name>` would catch drift, but the duplication is rare (one skill today) and cheap to grep manually. YAGNI.

## 5. Locked decisions

### 5.1 — New name: `org-ai-tooling`

Per Logan's direction this session.

| Considered | Verdict | Rationale |
|---|---|---|
| `org-ai-tooling` | **Chosen** | Logan's call. `org-` namespacing makes it clear this is internal tooling guidance; `ai-tooling` describes the content scope (Claude Code, MCP, Agent SDK, …). |
| `karpathy-tooling` | Rejected (Karpathy-lens self-veto) | Tribute name; doesn't tell a consumer what fires it. |
| `claude-code-tooling-dev` | Rejected | Most descriptive, but redundant given the consumer context (the plugin is for Claude Code projects). |
| `claude-tooling` | Rejected | Conflates Claude API work with Claude Code harness work. |

### 5.2 — Description rewrite

Replaces the current 530-char third-person description with a verifier-compliant imperative form that includes explicit TRIGGER and SKIP clauses so the model gets a clean discoverability signal:

```
Use when editing Claude Code tooling files (SKILL.md, hooks.json, agents/*.md, .mcp.json, .claude-plugin/plugin.json, CLAUDE.md) or designing/auditing plugins, skills, hooks, subagents, MCP servers, or Agent SDK applications. Do NOT use for app code (React components, NestJS services, Prisma schemas) — those have dedicated guard skills. Covers: harness primitives, plugin design, skill authoring, hook patterns, MCP integration, Agent SDK usage. TRIGGER when: editing files matching the paths above, or task mentions "claude code", "agent SDK", "MCP server", "subagent", "plugin design", "skill authoring", "hook". SKIP when: writing app/feature code in a consumer project — those route to the matching guard skill (frontend-implementation-guard, nestjs-service-boundary-guard, etc.).
```

Verifier requirements satisfied:
- Starts with `Use when` (passes the discoverability check that flagged the current description).
- Contains concrete trigger verbs (`editing`, `designing`, `auditing`).
- Has explicit `Do NOT use for` and `SKIP when` clauses (path-blind triggering was finding F3).
- Names target paths and trigger phrases (model can match deterministically).
- Length: ~620 chars — within the established norm for skills in this plugin.

### 5.3 — Body restructure (RED → GREEN)

Maps the existing content onto the four required sections. The skill keeps its Karpathy-mindset character; only headings and one new section change.

| Existing section | Action | New section |
|---|---|---|
| `## Overview` + `**Core principle:**` | Keep, light edit | `## Purpose & scope` |
| `## The Mindset` (7 numbered principles) | Rename heading; reformat each principle as one-line imperative + `*Why:*` line + supporting prose | `## Core rules` |
| `## Decision Framework` (tree diagram) | Move to `references/patterns.md` | (referenced from Core rules) |
| `## Red Flags — you are NOT in this mindset` (table) | Rename heading; reshape table from `Symptom \| Meaning` to `Thought \| Reality` (template-required) | `## Red flags` |
| `## Quick Reference` (primitive table) | Move to `references/patterns.md` | (referenced) |
| `### Key flags you actually use` | Move to `references/patterns.md` | (referenced) |
| `### Key commands you actually use` | Move to `references/patterns.md` | (referenced) |
| `## Common Mistakes` | Adapt as Findings categories under Review checklist | `## Review checklist` |
| `## What "done" looks like` (6-point checklist) | Adapt as the four-subsection report shape (Summary / Findings / Safer alternative / Checklist coverage) | `## Review checklist` |
| (none) | New | `## Interactions with other skills` |

The new `## Interactions with other skills` section names the explicit overlaps:

- **Owns:** harness-primitive selection (skill vs hook vs subagent vs MCP vs CLAUDE.md), plugin/skill/hook/agent/MCP authoring guidance, Agent SDK usage patterns.
- **Hands off to:** `superpowers:brainstorming` for design exploration before authoring; `superpowers:writing-plans` for multi-step implementation; `simplify` for second-draft trim; the `plugin-dev:*` family for skill-/hook-/command-/agent-specific deep-dives.
- **Does not duplicate:** consumer-side guard skills (`frontend-implementation-guard`, `nestjs-service-boundary-guard`, `prisma-data-access-guard`, etc.) — those guard app code, this guards harness/tooling code.

Word-count target: SKILL.md ≤2,000 words (hard cap from `templates/new-skill-template.md`). Deeper prose (Decision Framework, Quick Reference, Key flags, Key commands) lives in `references/patterns.md` so the lean SKILL.md stays under the cap. Current SKILL.md is ~1,900 words; the restructure shifts the reference-style content to `references/` and adds the new `Interactions with other skills` section. Exact final word count is execution-determined.

### 5.4 — Two-copy treatment

Both copies rename and restructure together in the same commit. Both get identical content. Identity is enforced by reading once and writing twice (or by `cp` after the SKILL.md is finalized in one location).

The duplication is intentional per `CLAUDE.md`'s no-dogfooding rule — `.claude/skills/<name>/` is what the maintainer sees while working in this repo because the plugin is not installed on itself. A pre-commit drift check is **not** in scope (one skill today; cheap to grep).

### 5.5 — Cross-references

Live docs that reference `anthropic-tooling-dev` (per grep, 9 hits across 9 files):

| File | Action |
|---|---|
| `plugin/skills/anthropic-tooling-dev/SKILL.md` | Renamed (directory move + frontmatter `name`) |
| `.claude/skills/anthropic-tooling-dev/SKILL.md` | Renamed (same) |
| `plugin/README.md` | Catalog row under "Maintainer / experimental" updates code reference and description |
| `CLAUDE.md` (repo root) | Standing-instructions list: `anthropic-tooling-dev` → `org-ai-tooling` |
| `docs/followups.md` | Item #5: status OPEN → RESOLVED in 2026-04-29. Strikethrough the title (`~~anthropic-tooling-dev placement decision~~`) per the item #3 precedent so historical search still hits, then add a resolution note pointing at this spec and the implementing commit. |
| `docs/superpowers/audits/2026-04-29-plugin-refactor-execution-report.md` | **Do NOT edit** — historical artifact; preserves audit trail |
| `docs/superpowers/specs/2026-04-28-plugin-refactor-design.md` | **Do NOT edit** — historical |
| `docs/superpowers/plans/2026-04-28-plugin-refactor.md` | **Do NOT edit** — historical |
| `docs/superpowers/plans/2026-04-27-plugin-runtime-extraction.md` | **Do NOT edit** — historical |

Live docs (1–5) update; historical artifacts (6–9) are immutable per the project's "stale specs poisoning agents" design concern (`CLAUDE.md` §"#1 design concern"). Editing them would erase the trace of what the system looked like at past dates.

## 6. File-by-file map

### 6.1 — Renames

| Operation | From | To |
|---|---|---|
| `git mv` | `plugin/skills/anthropic-tooling-dev/SKILL.md` | `plugin/skills/org-ai-tooling/SKILL.md` |
| `git mv` | `.claude/skills/anthropic-tooling-dev/SKILL.md` | `.claude/skills/org-ai-tooling/SKILL.md` |

### 6.2 — Modified files

| Path | Changes |
|---|---|
| `plugin/skills/org-ai-tooling/SKILL.md` | Frontmatter `name: org-ai-tooling`. Description rewrite per §5.2. Body restructure per §5.3. Do NOT add a `## Assumes baseline-standards. Adds:` line — see §4 for rationale (avoid extending item #6's cross-boundary references; the section is not verifier-required). |
| `.claude/skills/org-ai-tooling/SKILL.md` | Identical to above. |
| `plugin/README.md` | Catalog row L143–L147: `<code>anthropic-tooling-dev</code>` → `<code>org-ai-tooling</code>`; description text "Guidance for Claude Code harness work…" stays accurate; remove "(placement under review post-0.4.0)" caveat since it is now resolved. |
| `CLAUDE.md` (root) | "Skill-loading discipline" non-negotiable list: `anthropic-tooling-dev` → `org-ai-tooling`. |
| `docs/followups.md` | Item #5: change `Status: OPEN` → `Status: RESOLVED in 2026-04-29 (rename + verifier-shape conformance)`. Add a one-line resolution note pointing at this spec and the implementing commit (filled in after commit). |

### 6.3 — Created files

| Path | Contents |
|---|---|
| `plugin/skills/org-ai-tooling/references/patterns.md` | Decision Framework tree, Quick Reference primitive table, Key flags list, Key commands list. ~700 words. |
| `.claude/skills/org-ai-tooling/references/patterns.md` | Identical to above. |

### 6.4 — Total churn

- 2 directory renames (4 file paths via git rename)
- 2 file modifications inside the rename (SKILL.md content changes)
- 2 new files (`references/patterns.md` × 2)
- 3 cross-reference updates (`plugin/README.md`, root `CLAUDE.md`, `docs/followups.md`)

## 7. Commit sequence

Single commit:

```
refactor(skills): rename anthropic-tooling-dev → org-ai-tooling, tighten trigger, conform to verifier shape
```

Rationale for atomicity:

- The rename, description rewrite, body restructure, and cross-reference updates touch interconnected text. Any non-atomic ordering produces a repo state where, e.g., `plugin/README.md` references a directory that no longer exists.
- This is one clean unit of work that will revert cleanly if needed.
- Pre-commit `pnpm verify` runs only against staged `plugin/skills/*/SKILL.md` per the husky hook, so the gate fires inside this commit.

## 8. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Restructure into Core rules / Red flags / Review checklist / Interactions strips the Karpathy-mindset character | Medium | Medium | Keep the 7 principles' core text intact under `Core rules`; preserve "you are NOT in this mindset" framing as a one-line intro to the `Red flags` table. The headings change, the voice does not. |
| R2 | New description over-narrows; skill stops triggering on legitimate tooling work | Low | Medium | The TRIGGER clause names paths AND keywords AND scope tags. Smoke-test by triggering on (a) a SKILL.md edit, (b) a prompt mentioning "MCP server", (c) a prompt about Agent SDK — all three must fire. |
| R3 | New description under-narrows; skill still fires on app code | Low | Low | The SKIP clause is explicit. Smoke-test: a prompt about a React component or a NestJS controller must NOT fire this skill. |
| R4 | Verifier still RED after restructure due to subtle four-section-shape mismatch (e.g., the `## Review checklist` four-subsection report shape genuinely doesn't fit a mindset skill) | Low–Medium | Low | Run `pnpm verify` after each substantial body edit during execution; iterate until GREEN. If structurally impossible after a good-faith try, fall back to documenting the residual finding in `followups.md` rather than forcing nonsensical content. |
| R5 | One copy renamed, the other missed | Low | Low | Grep for `anthropic-tooling-dev` after the commit — should return zero hits in live docs. Historical artifacts in `docs/superpowers/{audits,specs,plans}/` are expected hits. |
| R6 | Skill body persona ("You are a senior engineer at Anthropic…") feels off after the org-ai-tooling rename | Low | Cosmetic | Out of scope per §4. Note in followups for a future cosmetic pass if it bothers anyone. |

## 9. Testing & verification

### 9.1 — Verifier

```bash
pnpm verify plugin/skills/org-ai-tooling/SKILL.md
```

Goal: `Verdict: GREEN`. Acceptance gate is hard.

### 9.2 — Test suite

```bash
pnpm test
```

Goal: 46/46 still pass. The verifier test fixtures don't reference `anthropic-tooling-dev` (confirmed in 0.4.0 spec §5.5 R1), so the rename should not break tests.

### 9.3 — Trigger smoke test (local)

From a fresh fixture directory (per `CLAUDE.md` test-isolation rule):

```bash
SMOKE=$(mktemp -d -t org-ai-tooling-smoke-XXXX)
cd "$SMOKE"
[ ! -e CLAUDE.md ] && [ ! -e .claude ] && echo OK_CLEAN
claude --plugin-dir /absolute/path/to/global-plugin/plugin
```

Then verify in-session by triggering the skill against four prompts. Expected behavior:

| Prompt | Expected | Tests |
|---|---|---|
| "I'm editing my plugin's SKILL.md and need to add a trigger description" | Skill **fires** | TRIGGER on path + keyword |
| "Help me design an MCP server for our internal API" | Skill **fires** | TRIGGER on keyword |
| "Refactor this React component to use Suspense" | Skill **does NOT fire** (frontend-implementation-guard fires instead) | SKIP on app code |
| "Add a Prisma migration for the orders table" | Skill **does NOT fire** (prisma-data-access-guard fires instead) | SKIP on app code |

### 9.4 — Cross-reference grep

```bash
git grep "anthropic-tooling-dev"
```

After commit: expected hits are (a) historical artifacts under `docs/superpowers/{audits,specs,plans}/` and (b) the struck-through title of item #5 in `docs/followups.md` (preserved per the item #3 precedent so historical search still works). Any hit in `plugin/`, `.claude/skills/`, root `CLAUDE.md`, root `README.md`, or `plugin/README.md` is a defect.

## 10. Acceptance criteria

The work is complete when **all** of the following hold:

1. `plugin/skills/org-ai-tooling/SKILL.md` exists with frontmatter `name: org-ai-tooling`.
2. `.claude/skills/org-ai-tooling/SKILL.md` exists with content identical to the plugin/ copy.
3. `plugin/skills/anthropic-tooling-dev/` and `.claude/skills/anthropic-tooling-dev/` do not exist.
4. `pnpm verify plugin/skills/org-ai-tooling/SKILL.md` returns `Verdict: GREEN`.
5. `pnpm test` returns `46/46` (or whatever the current count is on `logan` tip — must not regress).
6. The skill's `description` starts with `Use when`, contains a trigger verb, and includes both a `Do NOT use for` and a `SKIP when:` clause.
7. SKILL.md contains all four required sections at the correct heading level: `## Core rules`, `## Red flags`, `## Review checklist`, `## Interactions with other skills`.
8. SKILL.md is ≤2,000 words; longer reference content lives in `references/patterns.md`.
9. Live docs reference `org-ai-tooling`, not `anthropic-tooling-dev`: `plugin/README.md` catalog row, root `CLAUDE.md` non-negotiable list, `docs/followups.md` item #5 status. Historical artifacts under `docs/superpowers/{audits,specs,plans}/` are unchanged.
10. Trigger smoke test (§9.3) shows the skill fires on tooling prompts (paths or keywords) and does not fire on app-code prompts.

## 11. Handoff

After Logan reviews and approves this spec, invoke `superpowers:writing-plans` to produce the implementation plan at `docs/superpowers/plans/2026-04-29-org-ai-tooling-rename.md`. The plan will decompose this spec into bite-sized tasks per the `superpowers:writing-plans` template.
