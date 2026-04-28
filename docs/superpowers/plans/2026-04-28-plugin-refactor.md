---
skills_invoked:
  - anthropic-tooling-dev
  - plugin-dev:plugin-structure
  - plugin-dev:plugin-settings
  - plugin-dev:hook-development
  - plugin-dev:skill-development
  - plugin-dev:agent-development
  - plugin-dev:mcp-integration
  - plugin-dev:create-plugin
  - claude-md-management:claude-md-improver
  - simplify
  - superpowers:brainstorming
  - superpowers:writing-plans
  - superpowers:requesting-code-review
  - superpowers:verification-before-completion
---

# Plugin Refactor — Implementation Plan (`global-plugin@0.4.0`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **REQUIRED BACKGROUND for any subagent dispatched off this plan:** invoke every relevant `global-plugin:*` skill plus every `plugin-dev:*` skill, `anthropic-tooling-dev`, `simplify`, and applicable `superpowers:*`. Subagents do NOT inherit parent context — name the skills explicitly in the dispatch prompt and require a `skills_invoked:` YAML frontmatter block on the deliverable.

**Goal:** Refactor `plugin/` to ship `global-plugin@0.4.0`: drop four shipped defects (broken MCP placeholders, dead `dependencies` field, per-prompt context burn, log litter), remove maintainer/meta surface from consumers, consolidate three overlapping risk skills into one, apply progressive disclosure to six oversized skills, and relocate `_baseline` out of the consumer-facing skill surface into a new repo-root `templates/` directory.

**Architecture:** Sequential commit-per-concern refactor on the `logan` branch. Each commit is independently revertable. Verification gates at clearly-marked checkpoints (vitest skill-verifier + manual smoke). 15 baseline commits with the count free to grow if conditional splits land as separate commits.

**Tech Stack:** existing — TypeScript (tsx), vitest, husky, pnpm, Node ESM hooks, Claude Code plugin loader.

**Source spec:** `docs/superpowers/specs/2026-04-28-plugin-refactor-design.md` (read it for full design rationale; this plan is the executable form).

---

## Decisions resolved up front

These are baked into the plan — the executor does not have to re-decide them.

| # | Decision | Resolution |
|---|---|---|
| 1 | Items in scope vs. parked | In scope: items in §3 of this plan. Parked: `anthropic-tooling-dev` placement, `plugin/scripts/bootstrap-new-project.sh` + `plugin/templates/project/` rework, `_baseline` runtime inheritance fix. |
| 2 | Version bump target | `0.3.0` → `0.4.0`. Pre-1.0 minor bump. |
| 3 | Bump timing | Commit 15 (last). Every prior commit stays at `0.3.0`. |
| 4 | New top-level directory for `_baseline` content | `templates/` at repo root. NOT `docs/` (per Logan: docs is for what the codebase is/does, not for files that are part of the system). |
| 5 | `_baseline` file split | Two files: `templates/new-skill-template.md` (scaffold) + `templates/baseline-standards.md` (cross-cutting rules). |
| 6 | Domain skills' `## Assumes _baseline. Adds:` line | Rename to `## Assumes baseline-standards. Adds:` in 23 surviving SKILL.md files at commit 7. |
| 7 | Three-skill consolidation target | `change-risk-evaluation` keeps the name; absorbs `regression-risk-check` and `rollback-planning`; the other two are deleted. |
| 8 | Consolidation overflow handling | If the merged `change-risk-evaluation/SKILL.md` exceeds ~3,000 words, apply progressive disclosure. May happen within commit 6 OR as a follow-on commit (per Q1: don't artificially pin commit count). Pick the cleaner option at commit time. |
| 9 | UserPromptSubmit hook payload | One-line reinforcement (per Logan's override): "global-plugin reminder: invoke EVERY relevant skill, not just the first one that matches. When dispatching subagents, name the required skills in the prompt and require a `skills_invoked:` YAML frontmatter block on the artifact." |
| 10 | SessionStart hook payload | ~2-sentence skill-loading-discipline reminder (no full skill roster — auto-discovery already exposes that to the model). |
| 11 | Subagent-propagation prose in hook | Drop entirely (prose-as-enforcement is theater). |
| 12 | Both timestamp loggers | Delete entirely (no purpose, litters consumer repos). |
| 13 | Skill-verification relocation | Move to `.claude/skills/skill-verification/` (project-local). Parent created and committed; not gitignored. |
| 14 | Skill-authoring merge strategy | Option B (interleave by topic) — see Task 5 below for the 8-step recipe. |
| 15 | Six fat skills to split | `accessibility-guard`, `cicd-pipeline-safety`, `queue-and-retry-safety`, `resilience-and-error-handling`, `secrets-and-config-safety`, `infra-safe-change`. Other 22 skills not split. |
| 16 | Progressive-disclosure split shape | Lean SKILL.md (≤2,000 words) + `references/patterns.md` + `references/review-checklist.md`. Pointer line in lean SKILL.md. |
| 17 | Plugin/README.md "New project setup" section | Remove in commit 14 (consumers no longer directed at the still-broken bootstrap workflow that this refactor parks). |
| 18 | `anthropic-tooling-dev` README catalog entry | List under "Maintainer / experimental skills" subheading with a one-line caveat noting placement is being evaluated post-0.4.0. |

---

## Scope summary

**In scope (15 baseline commits, count may grow per Q1):**

1. Manifest hygiene (drop `dependencies`, version bump)
2. MCP placeholder file deletion
3. Hook simplification (drop loggers, simplify injector, drop subagent-propagation prose)
4. Skill-verification relocation
5. Skill-authoring merge into existing guide (Option B interleave)
6. Three-skill risk consolidation
7. `_baseline` relocation to `templates/` (atomic with 23-skill rename + root doc updates)
8-13. Six progressive-disclosure splits
14. plugin/README.md refresh
15. Version bump

**Parked (not in this plan):**
- `anthropic-tooling-dev` placement
- Bootstrap script + `plugin/templates/` rework
- `_baseline` runtime inheritance (consumer-side auto-load)

---

## Task 1 — Drop `dependencies` field from manifest

**Files:**
- Modify: `plugin/.claude-plugin/plugin.json`

- [ ] **Step 1: Verify current state**

```bash
cat plugin/.claude-plugin/plugin.json
```

Expected output:
```json
{
  "name": "global-plugin",
  "description": "Company-wide Claude Code plugin for full-stack React/Next.js + Node/NestJS + Prisma/Postgres + AWS projects, with optional mobile guardrails for React Native.",
  "version": "0.3.0",
  "author": {
    "name": "logan"
  },
  "dependencies": [
    { "name": "superpowers", "marketplace": "claude-plugins-official" },
    { "name": "frontend-design", "marketplace": "claude-plugins-official" },
    { "name": "prisma", "marketplace": "claude-plugins-official" },
    { "name": "deploy-on-aws", "marketplace": "claude-plugins-official" },
    { "name": "semgrep", "marketplace": "claude-plugins-official" }
  ]
}
```

- [ ] **Step 2: Edit the file — remove the `dependencies` array**

Replace the file contents with:

```json
{
  "name": "global-plugin",
  "description": "Company-wide Claude Code plugin for full-stack React/Next.js + Node/NestJS + Prisma/Postgres + AWS projects, with optional mobile guardrails for React Native.",
  "version": "0.3.0",
  "author": {
    "name": "logan"
  }
}
```

(Keep `version` at `0.3.0` — bumped to `0.4.0` only at Task 15.)

- [ ] **Step 3: Verify the JSON parses**

```bash
node -e "JSON.parse(require('fs').readFileSync('plugin/.claude-plugin/plugin.json'))" && echo OK
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add plugin/.claude-plugin/plugin.json
git commit -m "chore: drop dead dependencies field from manifest

The dependencies array was non-standard — Claude Code does not honor
this field and does not auto-install marketplace plugins from it. The
list was misleading consumers into thinking required companions would
be installed automatically. Move the list to plugin/README.md as
documented recommended companions instead (Task 14)."
```

---

## Task 2 — Delete broken MCP placeholder file

**Files:**
- Delete: `plugin/.mcp.json`

- [ ] **Step 1: Verify current state**

```bash
cat plugin/.mcp.json
```

Expected: 5 servers, each with `"command": "echo"`. This file ships broken — `echo` does not speak the MCP protocol, so consumers see five permanently-broken servers in `/mcp`.

- [ ] **Step 2: Delete the file**

```bash
git rm plugin/.mcp.json
```

- [ ] **Step 3: Verify it's gone**

```bash
[ ! -e plugin/.mcp.json ] && echo OK
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat!: remove broken MCP placeholder file

plugin/.mcp.json shipped five servers all running 'echo \"Replace
with...\"'. echo exits 0 but does not speak the MCP protocol, so the
MCP client repeatedly fails handshake on every session and the
consumer sees five permanently-broken servers in /mcp.

BREAKING CHANGE: 0.3.0 consumers using these placeholder names with
their own commands by editing the shipped file will need to manage
their own .mcp.json after upgrade. Recommended server names will be
documented in plugin/README.md as a checklist (Task 14)."
```

---

## Task 3 — Drop hook loggers and simplify `inject-skills-reminder.mjs`

**Files:**
- Modify: `plugin/hooks/hooks.json`
- Rewrite: `plugin/hooks/inject-skills-reminder.mjs`

- [ ] **Step 1: Pre-commit auto-discovery smoke (verify the design assumption)**

This step verifies that Claude Code's built-in auto-discovery exposes skill names + descriptions to the model — the assumption that motivates dropping the heavy roster injection. Run this BEFORE editing the hook so the OLD heavy injection is still active for comparison.

```bash
SMOKE=$(mktemp -d -t global-plugin-disco-XXXX)
cd "$SMOKE"
# Confirm fixture is clean — no CLAUDE.md present
[ ! -e CLAUDE.md ] && [ ! -e .claude ] && echo OK_CLEAN
# Note any user-global ~/.claude/CLAUDE.md that will load (this is fine for the smoke; just record it)
[ -e "$HOME/.claude/CLAUDE.md" ] && echo "INFO: user-global CLAUDE.md present"
claude --plugin-dir /absolute/path/to/global-plugin/plugin
```

In the session, ask the model: *"Without using any tools, list every global-plugin skill available to you and what each one does."*

The model should be able to enumerate all ~28 skills with their descriptions. If it can, auto-discovery is exposing them and the assumption holds — proceed with the rewrite. If it cannot list any without invoking a tool, the assumption is wrong and the rewrite must keep a minimal roster injection. Record the outcome in the commit message.

Exit the session.

- [ ] **Step 2: Modify `plugin/hooks/hooks.json` — remove loggers and PostToolUse**

Replace the file contents with:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/inject-skills-reminder.mjs\" SessionStart"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/inject-skills-reminder.mjs\" UserPromptSubmit"
          }
        ]
      }
    ]
  }
}
```

Changes from current:
- Removed the SessionStart `mkdir -p .claude && printf 'session_start ...'` sub-step.
- Removed the entire `PostToolUse` block.
- Kept only the two `inject-skills-reminder.mjs` invocations.

- [ ] **Step 3: Verify hooks.json parses**

```bash
node -e "JSON.parse(require('fs').readFileSync('plugin/hooks/hooks.json'))" && echo OK
```

- [ ] **Step 4: Rewrite `plugin/hooks/inject-skills-reminder.mjs` to a fixed-payload emitter**

Replace the entire file contents with:

```javascript
#!/usr/bin/env node

const hookEvent = process.argv[2] || "SessionStart";

const sessionStartBody = `global-plugin is active. Invoke EVERY relevant skill (not just the first match) before writing code, editing files, or dispatching subagents. When dispatching subagents, name the required \`global-plugin:*\` skills in the subagent prompt and require a \`skills_invoked:\` YAML frontmatter block on the artifact.`;

const userPromptSubmitBody = `global-plugin reminder: invoke EVERY relevant skill, not just the first one that matches. When dispatching subagents, name the required skills in the prompt and require a \`skills_invoked:\` YAML frontmatter block on the artifact.`;

const body = hookEvent === "UserPromptSubmit" ? userPromptSubmitBody : sessionStartBody;

const payload = {
  hookSpecificOutput: {
    hookEventName: hookEvent,
    additionalContext: body,
  },
};

process.stdout.write(JSON.stringify(payload));
```

Changes from current:
- Removed the SKILL.md scanner (`readdirSync(skillsDir, ...)` and the loop).
- Removed the YAML frontmatter parser (`parseFrontmatter` function).
- Removed the per-skill `rosterLines` rendering.
- Removed the "EXTREMELY_IMPORTANT" wrapper, the "Subagent propagation (critical)" prose block, and the embedded propagation instruction.
- Preserved the JSON envelope shape: `{ "hookSpecificOutput": { "hookEventName": ..., "additionalContext": ... } }`. This is the contract the SessionStart and UserPromptSubmit hooks require.

File goes from 98 lines to ~21 lines.

- [ ] **Step 5: Test the rewrite — SessionStart payload**

```bash
node plugin/hooks/inject-skills-reminder.mjs SessionStart | node -e "
const p = JSON.parse(require('fs').readFileSync(0, 'utf8'));
if (!p.hookSpecificOutput) { console.error('FAIL: no hookSpecificOutput'); process.exit(1); }
if (p.hookSpecificOutput.hookEventName !== 'SessionStart') { console.error('FAIL: wrong hookEventName'); process.exit(1); }
if (typeof p.hookSpecificOutput.additionalContext !== 'string') { console.error('FAIL: additionalContext not string'); process.exit(1); }
const len = p.hookSpecificOutput.additionalContext.length;
if (len > 700) { console.error('FAIL: SessionStart additionalContext '+len+' chars > 700'); process.exit(1); }
console.log('OK SessionStart length='+len);
"
```
Expected: `OK SessionStart length=<some number under 700>`

- [ ] **Step 6: Test the rewrite — UserPromptSubmit payload**

```bash
node plugin/hooks/inject-skills-reminder.mjs UserPromptSubmit | node -e "
const p = JSON.parse(require('fs').readFileSync(0, 'utf8'));
if (!p.hookSpecificOutput) { console.error('FAIL: no hookSpecificOutput'); process.exit(1); }
if (p.hookSpecificOutput.hookEventName !== 'UserPromptSubmit') { console.error('FAIL: wrong hookEventName'); process.exit(1); }
if (typeof p.hookSpecificOutput.additionalContext !== 'string') { console.error('FAIL: additionalContext not string'); process.exit(1); }
const len = p.hookSpecificOutput.additionalContext.length;
if (len > 300) { console.error('FAIL: UserPromptSubmit additionalContext '+len+' chars > 300'); process.exit(1); }
console.log('OK UserPromptSubmit length='+len);
"
```
Expected: `OK UserPromptSubmit length=<some number under 300>`

- [ ] **Step 7: Commit**

```bash
git add plugin/hooks/hooks.json plugin/hooks/inject-skills-reminder.mjs
git commit -m "refactor(hooks): drop loggers, simplify inject-skills-reminder

Three problems converged in the hooks layer:

1. PostToolUse Write/Edit logger and SessionStart logger appended
   context-free timestamps to .claude/plugin-hook.log in the consumer's
   CWD. No purpose, litters consumer repos. Both deleted.

2. UserPromptSubmit re-injected the full ~28-skill roster + heavy
   prose on every prompt — ~5KB per prompt of redundant context burn.
   Auto-discovery already exposes skill names+descriptions to the
   model (verified by pre-commit smoke test against current 0.3.0
   hook). Replaced with a one-line reinforcement of skill-loading
   discipline.

3. The injector contained a 'subagent propagation' prose block telling
   the model to embed an instruction into subagent prompts. Pure
   prose-as-enforcement; cannot enforce. Dropped entirely.

The injector now emits fixed payloads:
- SessionStart: ~2 sentences reminding to invoke every relevant skill
  and to name required skills in subagent dispatches with a
  skills_invoked: YAML frontmatter requirement.
- UserPromptSubmit: a one-line variant of the same reminder.

JSON envelope shape (hookSpecificOutput.hookEventName +
additionalContext) preserved — this is the hook contract.

Script size: 98 lines -> 21 lines."
```

---

## Task 4 — Move `skill-verification` to project-local `.claude/skills/`

**Files:**
- Create: `.claude/skills/` (parent directory)
- Move: `plugin/skills/skill-verification/` → `.claude/skills/skill-verification/`

- [ ] **Step 1: Verify `.claude/skills/` does not yet exist**

```bash
[ ! -d .claude/skills ] && echo OK_NEW_DIR
```
Expected: `OK_NEW_DIR`. (`.claude/` itself may already exist with other contents — that's fine; only the `skills/` subdir is new.)

- [ ] **Step 2: Verify the source is present**

```bash
[ -d plugin/skills/skill-verification ] && [ -f plugin/skills/skill-verification/SKILL.md ] && echo OK_SRC_PRESENT
```
Expected: `OK_SRC_PRESENT`

- [ ] **Step 3: Confirm `.gitignore` does NOT exclude `.claude/skills/`**

```bash
git check-ignore .claude/skills/ 2>/dev/null && echo "FAIL: .claude/skills/ is gitignored" || echo OK_NOT_IGNORED
```
Expected: `OK_NOT_IGNORED`. If it returns `FAIL`, edit `.gitignore` (or `.claude/.gitignore` if present) to allow `.claude/skills/`.

- [ ] **Step 4: Move the directory**

```bash
mkdir -p .claude/skills
git mv plugin/skills/skill-verification .claude/skills/skill-verification
```

- [ ] **Step 5: Verify the move**

```bash
[ -f .claude/skills/skill-verification/SKILL.md ] && [ ! -d plugin/skills/skill-verification ] && echo OK_MOVED
```
Expected: `OK_MOVED`

- [ ] **Step 6: Verify the moved skill still parses**

```bash
pnpm verify .claude/skills/skill-verification/SKILL.md
```
Expected: verifier reports GREEN or YELLOW (no FAIL).

- [ ] **Step 7: Commit**

```bash
git add -A .claude/skills/ plugin/skills/
git commit -m "refactor(skills): relocate skill-verification to project-local

skill-verification describes how to run the maintainer-side skill
verifier (pnpm verify). It has no consumer use — a consumer's
React/NestJS app does not need this loaded.

Moved to .claude/skills/skill-verification/ where it auto-discovers
when working in this repo and does not ship via the plugin
marketplace. The .claude/skills/ parent directory is checked in
(not gitignored)."
```

---

## Task 5 — Merge `skill-authoring` into `skill-authoring-guide.md` (Option B interleave)

**Files:**
- Modify: `docs/superpowers/skill-authoring-guide.md`
- Delete: `plugin/skills/skill-authoring/`

This task is editorial: the goal is a single coherent document interleaved by topic from the existing guide and the soon-to-be-deleted skill. Read both files in full before editing.

- [ ] **Step 1: Read both source files**

```bash
cat docs/superpowers/skill-authoring-guide.md
cat plugin/skills/skill-authoring/SKILL.md
```

The guide is procedural (file layout → section order → rule writing → red flags → etc.); the skill is enforcement-shaped (frontmatter → 6 numbered Core rules with `*Why:*` lines → Red flags → Authoring flow → Good vs bad → Review checklist → Interactions). They overlap ~70% on description requirements, the four-section Review checklist shape, size targets, Interactions, and red flags.

- [ ] **Step 2: Apply the 8-step interleave recipe**

Edit `docs/superpowers/skill-authoring-guide.md` according to:

1. **Keep the guide's overall spine.** Section order: file layout → section order → writing the description → rule writing → red flags → good vs bad → interactions → review checklist → what every skill assumes → size target → self-review before commit. Do not restructure these sections.

2. **For each topic in both sources, pick the strongest wording.** The skill's "Description MUST have trigger signals" rule (with the `*Why:*` line) is sharper than the guide's "The frontmatter description is how Claude decides whether to apply the skill" — replace the latter with the former. Apply this principle per section.

3. **Graft `*Why:*` lines onto guide rules.** The skill's six Core rules each have a `*Why:*` line giving the failure mode. Where the guide has a similar rule without a Why, add the Why from the skill. Where the guide has a Why and the skill doesn't, keep the guide's. Where both have a Why, keep the more specific one.

4. **Graft TRIGGER/SKIP guidance into the description-writing section.** The skill's "Description MUST have trigger signals" rule names `TRIGGER when:` and `SKIP when:` patterns explicitly. Add this guidance to the guide's "Writing the `description`" section.

5. **Lift the skill's "Authoring flow" as a new top-level section near the top of the guide.** Place it immediately after the opening paragraph ("How to write a `SKILL.md`...") and before "File layout". Content:

   ```markdown
   ## Authoring flow

   1. Run `superpowers:brainstorming` to pin down the skill's purpose and attach point.
   2. Follow `superpowers:writing-skills` for file layout and metadata.
   3. Apply the company conventions in this guide (Core rules + Section order below).
   4. Run `pnpm verify plugin/skills/<name>/SKILL.md` before committing. (See `.claude/skills/skill-verification/` for the procedural skill.)
   ```

6. **Add a templates-pointer section** — also near the top, right after "Authoring flow":

   ```markdown
   ## Templates and standards reference

   Two repo-root files support skill authoring:

   - **`templates/new-skill-template.md`** — a verifier-GREEN scaffold to copy when starting a new skill. Replace the `[Placeholder]` markers with domain-specific content.
   - **`templates/baseline-standards.md`** — the cross-cutting rules every domain skill assumes (TypeScript strictness, security defaults, observability, testing, accessibility, performance, resilience). Each domain skill opens with `## Assumes baseline-standards. Adds:` referencing this file.

   Do not hand-roll a new SKILL.md from scratch — start from the template.
   ```

7. **Keep the guide's "Self-review before commit" section verbatim.** The skill does not have this; preserve.

8. **Update the guide's "What every skill assumes" section** — replace any `_baseline` reference with `templates/baseline-standards.md`. Lines in the current guide:

   ```
   - `_baseline` is in effect. Do not restate TypeScript strict, observability floor, testing floor, etc.
   - The stack pinned in `_baseline` (Next.js 15, NestJS 11, Prisma 6, Postgres 16, Node 22).
   ```

   Become:

   ```
   - `templates/baseline-standards.md` is in effect. Do not restate TypeScript strict, observability floor, testing floor, etc.
   - The stack pinned in `templates/baseline-standards.md` (Next.js 15, NestJS 11, Prisma 6, Postgres 16, Node 22).
   ```

   (Note: this guide update happens at Task 5; the actual `templates/` directory is created at Task 7. The guide will reference a not-yet-existing path until Task 7 commits. Acceptable because Task 7 commits before any release; if the order were reversed, the guide reference would be live before its target. As-is the reference is forward-pointing and resolved within the same branch before merge.)

- [ ] **Step 3: Verify the guide is internally consistent after edits**

```bash
# No leftover [Placeholder] markers (the skill had them; they should not survive into a docs file)
grep -n '\[Placeholder\]' docs/superpowers/skill-authoring-guide.md && echo "FAIL: placeholder leaked" || echo OK_NO_PLACEHOLDERS

# Confirm the new sections landed
grep -n "## Authoring flow" docs/superpowers/skill-authoring-guide.md && \
  grep -n "## Templates and standards reference" docs/superpowers/skill-authoring-guide.md && \
  echo OK_NEW_SECTIONS_PRESENT

# Confirm Self-review before commit survived
grep -n "## Self-review before commit" docs/superpowers/skill-authoring-guide.md && \
  echo OK_SELF_REVIEW_PRESENT

# Confirm _baseline reference is gone (replaced with templates/baseline-standards.md)
grep -n "_baseline" docs/superpowers/skill-authoring-guide.md && \
  echo "FAIL: leftover _baseline reference" || echo OK_BASELINE_REF_UPDATED
```

Expected: all four checks return `OK_*`.

- [ ] **Step 4: Delete the source skill directory**

```bash
git rm -r plugin/skills/skill-authoring
```

- [ ] **Step 5: Verify deletion**

```bash
[ ! -d plugin/skills/skill-authoring ] && echo OK_DELETED
```

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/skill-authoring-guide.md plugin/skills/skill-authoring/
git commit -m "refactor(docs): merge skill-authoring guide (Option B interleave)

Two parallel sources of truth (the SKILL.md in plugin/skills/ and the
guide in docs/superpowers/) interleaved into one coherent document.
The guide's procedural spine is preserved; the skill's *Why:* lines
and TRIGGER/SKIP guidance are grafted onto matching topics; the
skill's Authoring flow is lifted as a new top section; a templates-
pointer section is added; the guide's Self-review before commit and
What every skill assumes sections are kept (the latter updated to
reference templates/baseline-standards.md, which is created in
Task 7).

The plugin/skills/skill-authoring/ directory is deleted — its
content lives in the guide now."
```

---

## Task 6 — Consolidate `change-risk-evaluation` (absorb `regression-risk-check` + `rollback-planning`)

**Files:**
- Modify: `plugin/skills/change-risk-evaluation/SKILL.md`
- Delete: `plugin/skills/regression-risk-check/`
- Delete: `plugin/skills/rollback-planning/`
- Possibly create (if word count exceeds ~3,000 after merge): `plugin/skills/change-risk-evaluation/references/patterns.md` and `references/review-checklist.md`

The three skills overlap on PR-time risk review. After consolidation:
- `change-risk-evaluation` covers top-level risk posture (rating, deploy strategy, monitoring) AND blast-radius analysis (importer graph, classification, query-plan, spooky-action) AND rollback design (mechanism taxonomy, migration reversibility, feature flags, dual-support, rehearsal).
- The other two skills are deleted.

- [ ] **Step 1: Read all three source skills**

```bash
cat plugin/skills/change-risk-evaluation/SKILL.md
cat plugin/skills/regression-risk-check/SKILL.md
cat plugin/skills/rollback-planning/SKILL.md
```

- [ ] **Step 2: Diff their Core rules and absorb unique ones**

`change-risk-evaluation` currently has 6 Core rules (rating, affected scope, deploy strategy, monitoring, rollback trigger, stakeholders).

`regression-risk-check` has 6 Core rules (importer mapping, classification, breaking-change consumer enumeration, behavioural-change evidence, data-layer query-plan, spooky-action surfaces).

`rollback-planning` has 6 Core rules (rollback path written before merge, migration reversibility, feature-flag kill switch, time-to-rollback measured, dual-support windows, rehearsal for high-risk).

The merged skill's Core rules section becomes 18 numbered rules in three logical groups. Suggested grouping:

```markdown
## Core rules

### Group A — Risk posture (top-level)
1. Produce a risk rating (low / med / high / critical)...
2. List every affected user segment, downstream service, and business process...
3. Name the deploy strategy explicitly: canary, blue/green, rolling, feature flag, or straight-through...
4. Name the monitoring signals — dashboard link, CloudWatch alarm name, Datadog monitor ID...
5. Name the rollback trigger: the specific signal and threshold...
6. List every stakeholder who must be notified before deploy...

### Group B — Blast radius
7. Map every importer before claiming the change is isolated...
8. Classify every change before assessing impact (internal / API-compat / breaking / behavioural)...
9. For API-breaking changes, enumerate every consumer and its migration path...
10. Flag behavioural changes as hidden-breakage risk...
11. Data-layer changes require a query-plan diff or benchmark...
12. Check for spooky action at a distance (in-memory caches, global middleware, env var readers...)...

### Group C — Rollback
13. Rollback path is written before merge — a change with no rollback path is either trivial or not mergeable...
14. Data migrations are reversible in code, or explicitly forward-only with a stated reason and recovery plan...
15. A feature flag with a kill switch is the rollback mechanism for behavioural changes...
16. Time-to-rollback is measured...
17. Contract/breaking changes require a period of dual support...
18. For high-risk changes, the rollback is practised in staging before the production deploy...
```

Each rule keeps its `*Why:*` line from the source skill. Pull the rule text verbatim from the source.

- [ ] **Step 3: Absorb other unique sections**

The source skills have detailed sections beyond Core rules. Absorb each one:

- From `regression-risk-check`: "Blast radius estimation", "Change classification (internal / API-compat / breaking / behavioural)", "Schema and query-plan impact", "Spooky-action warning list".
- From `rollback-planning`: "Rollback mechanism taxonomy", "Data migration reversibility", "Feature flags as rollback", "Dual-support windows", "Rehearsal for high-risk".

These become subsections in the merged skill, organized by group.

- [ ] **Step 4: Broaden the trigger description**

Update the frontmatter `description` to cover all three concerns. Replace the current:

```yaml
description: Use when evaluating the blast radius of a planned change at PR time — produces the top-level risk posture an on-call or lead reads before approving. Do NOT use for code-level review (that's the domain skills). Covers overall risk rating, deploy strategy, monitoring plan, stakeholder list.
```

With:

```yaml
description: Use when evaluating risk for a planned change at PR time. Covers risk rating, blast-radius analysis (importer graph, change classification, query-plan regression, spooky-action surfaces), deploy strategy, monitoring signals, rollback path (mechanism choice, migration reversibility, kill-switch design, time-to-rollback, dual-support, rehearsal), and stakeholder notification. Do NOT use for code-level review (that's the domain skills) or simple feature-flagged changes that default off.
```

- [ ] **Step 5: Merge the Red flags tables**

`change-risk-evaluation`, `regression-risk-check`, and `rollback-planning` each have a Red flags table. Combine them, dedup overlapping rows, into one table in the merged skill.

- [ ] **Step 6: Merge the Review checklists**

Each source skill has a Review checklist with the four-section format (Summary / Findings / Safer alternative / Checklist coverage). The merged Checklist coverage table will list 18 rules. Findings categories expand to cover all three concerns:

```markdown
- `category`: `rating | affected-scope | deploy-strategy | monitoring | rollback-trigger | stakeholders | importer-coverage | classification | api-breaking | behavioural | query-plan | spooky-action | rollback-path | migration-reversibility | feature-flag | time-to-rollback | contract-dual-support | rehearsal`
```

- [ ] **Step 7: Merge Interactions section**

Replace the current `change-risk-evaluation` Interactions section with:

```markdown
## Interactions with other skills

- **Owns:** end-to-end risk posture for a planned change — rating, blast-radius, deploy strategy, monitoring, rollback, stakeholders.
- **REQUIRED BACKGROUND:** superpowers:requesting-code-review (PR-time review pipeline)
- **Hands off to:** observability-first-debugging for deep monitoring guidance and incident debugging.
- **Hands off to:** aws-deploy-safety for ECS/Lambda deploy mechanics (task-def revision, alias retarget, health-check gates).
- **Hands off to:** infra-safe-change for IaC rollback (Terraform/CloudFormation state reversal, drift handling).
- **Hands off to:** queue-and-retry-safety for async blast radius when event emitters or message bus handlers are touched.
- **Hands off to:** coverage-gap-detection for missing tests on enumerated importers.
- **Does not duplicate:** PR code review; domain skill findings (typescript-rigor, prisma-data-access-guard, etc.).
```

- [ ] **Step 8: Word-count the merged file**

```bash
wc -w plugin/skills/change-risk-evaluation/SKILL.md
```

If word count is **≤3,000**: skip Step 9, proceed to Step 10.

If word count is **>3,000**: apply progressive disclosure. Two options (per Q1, pick the cleaner):

- **Option A (inline within commit 6):** Move "Blast radius estimation", "Change classification", "Schema and query-plan impact", "Spooky-action warning list" sections to a new file `plugin/skills/change-risk-evaluation/references/patterns.md`. Move "Rollback mechanism taxonomy", "Data migration reversibility", "Feature flags as rollback", "Dual-support windows", "Rehearsal for high-risk" to either `references/patterns.md` (single file) or `references/rollback-patterns.md` (separate). Move the full Review checklist with all 18 rule entries to `references/review-checklist.md`. Trim the SKILL.md to ≤2,000 words: keep Core rules (all 18 with Why lines), Red flags table, brief Review checklist summary, Interactions section, and pointer line near the bottom.
- **Option B (follow-on commit):** Commit the merge as-is with a SKILL.md that exceeds 3,000 words, then immediately follow up with a `refactor(skills): split change-risk-evaluation` commit applying progressive disclosure. Adds one commit (now 16 total).

Pick Option A unless the merge produces dramatically more content than expected (in which case the follow-on commit gives a cleaner review boundary).

### Task 6.5 — Conditional follow-on commit (only if Step 8 chose Option B)

If Step 8 chose Option B (separate follow-on commit for the progressive-disclosure split), execute the per-skill split template from Tasks 8-13 against `plugin/skills/change-risk-evaluation/` after Task 6 commits. Commit message: `refactor(skills): split change-risk-evaluation into SKILL.md + references/`. This becomes commit 6.5 (or shifts subsequent commit numbers up by 1). Per Q1, Logan does not mind the commit count growing.

If Step 8 chose Option A (inline split within commit 6), continue to Step 9 below — Task 6.5 is skipped.

- [ ] **Step 9 (conditional, Option A only): Apply progressive disclosure if Step 8 chose Option A**

```bash
mkdir -p plugin/skills/change-risk-evaluation/references
```

Move the bulk sections to `references/patterns.md` and `references/review-checklist.md` per the split above. Add the pointer line to `SKILL.md`:

```markdown
For detailed patterns (blast-radius estimation, classification, query-plan analysis, rollback mechanism taxonomy, dual-support windows, rehearsal), see `references/patterns.md`. For the full PR review checklist with all 18 rule entries, see `references/review-checklist.md`.
```

Re-word-count: `wc -w plugin/skills/change-risk-evaluation/SKILL.md` should now be ≤2,000.

- [ ] **Step 10: Delete the two source skills**

```bash
git rm -r plugin/skills/regression-risk-check plugin/skills/rollback-planning
```

- [ ] **Step 11: Verify the merged skill passes the verifier**

```bash
pnpm verify plugin/skills/change-risk-evaluation/SKILL.md
```
Expected: GREEN or YELLOW.

- [ ] **Step 12: Commit**

```bash
git add -A plugin/skills/
git commit -m "refactor(skills): consolidate change-risk-evaluation

Three skills triggered on roughly the same diff (change-risk-evaluation,
regression-risk-check, rollback-planning) with overlapping checklists.
The model would plausibly invoke all three plus
superpowers:requesting-code-review on a single PR, generating four
overlapping reports.

Merged regression-risk-check and rollback-planning content into
change-risk-evaluation, organized as three Core rule groups (Risk
posture / Blast radius / Rollback). Trigger description broadened.
Red flags tables merged with dedup. Interactions section updated to
cover all three concerns.

[If progressive disclosure was applied: trimmed SKILL.md to <wc> words
and split detail to references/patterns.md + references/review-checklist.md.]

regression-risk-check/ and rollback-planning/ directories deleted —
their content lives in change-risk-evaluation now."
```

---

## Task 7 — Atomic: relocate `_baseline` to `templates/`, rename references in 23 surviving skills, update root docs

**Files:**
- Create: `templates/new-skill-template.md`
- Create: `templates/baseline-standards.md`
- Delete: `plugin/skills/_baseline/`
- Modify (23 files): `plugin/skills/<every-surviving-domain-skill>/SKILL.md` — rename `## Assumes _baseline. Adds:` → `## Assumes baseline-standards. Adds:`
- Modify: `CLAUDE.md` (repo root)
- Modify: `README.md` (repo root)

This task is atomic — all changes in one commit so the repo never has a state where the cross-reference points at a deleted file.

- [ ] **Step 1: Verify the rename target count is 23 (sanity check)**

```bash
grep -rl '## Assumes `_baseline`. Adds:' plugin/skills/ | wc -l
```
Expected: `26` (the 23 surviving domain skills + `_baseline/SKILL.md` itself + `regression-risk-check` + `rollback-planning` if Task 6 hasn't deleted them yet).

If Task 6 has already shipped (commit 6 in branch history), expect:
```bash
grep -rl '## Assumes `_baseline`. Adds:' plugin/skills/ | wc -l
```
Expected: `24` (23 surviving + `_baseline` itself).

- [ ] **Step 2: Create `templates/` directory at repo root**

```bash
mkdir -p templates
```

- [ ] **Step 3: Create `templates/new-skill-template.md`**

Content (copy `[Placeholder]` markers verbatim — they're meant to be replaced by future skill authors, not by you):

```markdown
---
name: <skill-name>
description: Use when [specific trigger]. Do NOT use for [anti-trigger — point at the right skill]. Covers [comma-separated scope tags]. TRIGGER when: <sharp signal>. SKIP when: <anti-trigger>.
allowed-tools: Read, Grep, Glob
---

# <Skill Title>

## Purpose & scope

[2-3 sentences. What does this skill enforce? When does it activate? What is its scope boundary against other skills?]

## Assumes `baseline-standards`. Adds:

[One line naming the additional domain this skill enforces on top of the cross-cutting baseline. Example: "Monorepo structure and cross-package boundary rules." Do not restate baseline rules — they live in `templates/baseline-standards.md`.]

## Core rules

[Numbered list. 5-10 rules. Each rule is one imperative sentence in bold ending with a period, followed by a `*Why:*` line giving the concrete failure mode. Each rule must be testable as PASS / CONCERN / NOT APPLICABLE.]

1. **[Placeholder] State the concrete rule as a short imperative sentence ending with a period.** — *Why:* explain the concrete failure mode this rule prevents in one sentence.
2. **[Placeholder] A second rule, if the domain needs it; otherwise delete this line.** — *Why:* keep rules to the smallest set a reviewer can actually hold in their head — usually 4 to 10.

## Red flags

[Table of `Thought | Reality` pairs. Anti-patterns this skill catches.]

| Thought | Reality |
|---|---|
| "[Placeholder] An excuse the author is tempted to make" | "[Placeholder] The consequence that excuse hides — one concrete sentence." |

## Good vs bad

[Optional. 2-3 subsections each with a `Bad:` and `Good:` code block. Snippets ≤20 lines. Only snippets that illustrate a Core rule.]

## [Domain-specific deep-dive sections]

[Optional. Replace this header with topic-specific sections. Examples: "Indexing strategy", "Migration safety", "Spooky-action warning list". Move long sections to `references/patterns.md` if SKILL.md exceeds ~2,000 words.]

## Interactions with other skills

- **Owns:** [the concerns this skill is the canonical source for].
- **Hands off to:** [other skill] for [their concern].
- **Does not duplicate:** [other skill's overlapping concern].

## Review checklist

Produce a markdown report with these four sections.

### Summary

One line: pass / concerns / blocking issues. Name the reviewed surface and the overall verdict in a single sentence so a reader can scan without reading further.

### Findings

One bullet per finding, in this shape:

- `<file>:<line>` — **severity** (blocker | concern | info) — *category* (one of <list>) — what is wrong, recommended fix.

### Safer alternative

[State the lowest-blast-radius path that still achieves the change's goal, prescriptively.]

### Checklist coverage

Mark each Core rule as PASS / CONCERN / NOT APPLICABLE with a one-line justification.

- Rule 1 — [restate the rule]: PASS / CONCERN / NOT APPLICABLE.
- Rule 2 — [restate the rule]: PASS / CONCERN / NOT APPLICABLE.
```

- [ ] **Step 4: Create `templates/baseline-standards.md`**

Content (this is the cross-cutting standards portion lifted from `_baseline/SKILL.md`):

```markdown
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
```

- [ ] **Step 5: Delete `plugin/skills/_baseline/`**

```bash
git rm -r plugin/skills/_baseline
```

- [ ] **Step 6: Rename `## Assumes _baseline. Adds:` → `## Assumes baseline-standards. Adds:` in surviving domain skills**

Run a sed-replace across all surviving skills. Use `sed -i` (Linux/Mac) or `sed -i ''` (BSD/Mac) — adjust per platform. The exact string:

```bash
# Find every file matching the old pattern (sanity check — should be 23 + _baseline itself = 24 after Tasks 4, 5, 6 have shipped)
grep -rl '## Assumes `_baseline`. Adds:' plugin/skills/

# Apply the rename. Use the right sed syntax for the platform:
#   Linux / GNU sed:    sed -i 's/old/new/g' file
#   macOS / BSD sed:    sed -i '' 's/old/new/g' file
#   Windows Git Bash:   sed -i 's/old/new/g' file (GNU sed; same as Linux)
# This repo is on Windows, so use the GNU form:
grep -rl '## Assumes `_baseline`. Adds:' plugin/skills/ | xargs sed -i 's/## Assumes `_baseline`. Adds:/## Assumes `baseline-standards`. Adds:/g'

# Verify the old pattern is gone (note: this runs AFTER Step 5 deletes _baseline/SKILL.md, so the directory itself is no longer in scope)
grep -rl '## Assumes `_baseline`. Adds:' plugin/skills/ && echo "FAIL: leftover" || echo OK_RENAMED
```

- [ ] **Step 7: Update root `CLAUDE.md`**

Find the standing-instructions line that references `_baseline`:

```
- Skills should reference `_baseline` rather than re-stating the cross-cutting TypeScript / security / observability / testing / a11y / perf / resilience standards. Adding the same paragraph to ten skills is a maintenance trap — put it in `_baseline` and have skills say "additionally, this skill...".
```

Replace with:

```
- Skills should reference `templates/baseline-standards.md` rather than re-stating the cross-cutting TypeScript / security / observability / testing / a11y / perf / resilience standards. Adding the same paragraph to ten skills is a maintenance trap — put it in `templates/baseline-standards.md` and have skills say "additionally, this skill...".
```

- [ ] **Step 8: Update root `README.md`**

In the Repository layout table, add a new row after the `plugin/` row:

```markdown
| `templates/` | Skill-author infrastructure: scaffolds and standards reference for skills authored in this repo | No |
```

(This is non-disruptive — `templates/` lives at repo root and does not ship to consumers.)

- [ ] **Step 9: Run the full vitest suite**

```bash
pnpm test
```
Expected: all tests pass. The verifier test in `frontmatter.test.ts:42-43` for underscore-prefixed names continues to pass (it tests the validator, not whether `_baseline` exists).

- [ ] **Step 10: Spot-check three surviving skills with the verifier**

```bash
pnpm verify plugin/skills/architecture-guard/SKILL.md
pnpm verify plugin/skills/prisma-data-access-guard/SKILL.md
pnpm verify plugin/skills/typescript-rigor/SKILL.md
```
Expected: each reports GREEN or YELLOW.

- [ ] **Step 11: Commit (atomic — all changes together)**

```bash
git add -A templates/ plugin/skills/ CLAUDE.md README.md
git commit -m "refactor: relocate _baseline to templates/ at repo root

_baseline served three roles muddled together: skill-authoring scaffold
(template to copy when starting a new skill), cross-cutting standards
reference (TS/security/observability/testing/a11y/perf/resilience),
and aspirational runtime inheritance (## Assumes _baseline. Adds:
in every domain skill — but it never auto-loads in a consumer
session, so the inheritance was documentation-only).

Treating it as authoring infrastructure rather than consumer surface
fixes the role muddle. Relocated to a new top-level templates/
directory at the repo root:

- templates/new-skill-template.md  (the verifier-GREEN scaffold to copy)
- templates/baseline-standards.md  (the cross-cutting rules)

plugin/skills/_baseline/ deleted. The 23 surviving domain skills'
## Assumes _baseline. Adds: lines renamed to ## Assumes
baseline-standards. Adds: in the same atomic commit so the repo
never has a transient state where the cross-reference points at a
deleted file.

Root CLAUDE.md and README.md updated to reflect the new templates/
directory.

Note: the runtime-inheritance gap is unchanged — domain skills still
document baseline assumptions textually but baseline-standards.md
does not auto-load in consumer sessions. The model has these
conventions in training data; deferring the runtime fix to a
follow-up was a deliberate choice."
```

---

## Tasks 8–13 — Six progressive-disclosure splits (one per fat skill)

Each split follows the same shape. **Task template** (apply once per skill):

**Files:**
- Modify: `plugin/skills/<skill>/SKILL.md` (trim to ≤2,000 words)
- Create: `plugin/skills/<skill>/references/patterns.md`
- Create: `plugin/skills/<skill>/references/review-checklist.md`

- [ ] **Step 1: Word-count current SKILL.md**

```bash
wc -w plugin/skills/<skill>/SKILL.md
```
Confirm it's >3,000 (otherwise the split is unnecessary — abort).

- [ ] **Step 2: Identify what to keep in SKILL.md**

Lean SKILL.md should keep, in this order:
1. Frontmatter (`name`, `description`, `allowed-tools`)
2. Title (`# <Skill name>`)
3. `## Purpose & scope` (2-3 sentences)
4. `## Assumes baseline-standards. Adds:` (one line)
5. `## Core rules` (all numbered rules with `*Why:*` lines, but not the long deep-dive prose)
6. `## Red flags` table
7. (Optional) Brief `## Good vs bad` with at most 1-2 representative snippets
8. `## Interactions with other skills`
9. `## Review checklist` — Summary section format only (one line) + a brief Findings shape note + Safer alternative section format only + a one-line pointer to references/review-checklist.md for the full Checklist coverage table.
10. Pointer line: *"For detailed code patterns, see `references/patterns.md`. For the full PR review checklist, see `references/review-checklist.md`."*

- [ ] **Step 3: Identify what to move to `references/patterns.md`**

The long deep-dive sections that explain HOW to apply the rules. Examples by skill:

- `accessibility-guard`: "Form labels and ARIA", "Focus management", "Reduced motion handling", "Screen reader announcement patterns", any extensive "Good vs bad" walkthroughs beyond the 1-2 kept in SKILL.md.
- `cicd-pipeline-safety`: workflow walkthroughs, secret-handling deep dives, OIDC setup details, deployment-gate patterns.
- `queue-and-retry-safety`: SQS visibility-timeout walkthroughs, DLQ handling patterns, idempotency-key strategies.
- `resilience-and-error-handling`: circuit-breaker implementation patterns, retry-budget patterns, timeout cascade examples.
- `secrets-and-config-safety`: AWS Secrets Manager rotation patterns, KMS envelope encryption, parameter-store hierarchies.
- `infra-safe-change`: Terraform plan-review patterns, drift-handling walkthroughs, blast-radius examples for IaC.

The exact split boundaries depend on the skill. Move whatever sits between Core rules and Interactions section, except the brief representative example kept in SKILL.md.

- [ ] **Step 4: Identify what to move to `references/review-checklist.md`**

The full Review checklist body — including the Checklist coverage table with every rule restated, any "Required explicit scans" subsections, and any extended Findings examples. Keep only a brief Review checklist summary in SKILL.md (the format hint, not the full content).

- [ ] **Step 5: Apply the split**

```bash
mkdir -p plugin/skills/<skill>/references
# Author the new files
# Trim SKILL.md
```

- [ ] **Step 6: Verify lean SKILL.md is ≤2,000 words**

```bash
wc -w plugin/skills/<skill>/SKILL.md
```
Expected: ≤2,000.

- [ ] **Step 7: Verify references files have content**

```bash
[ -s plugin/skills/<skill>/references/patterns.md ] && \
  [ -s plugin/skills/<skill>/references/review-checklist.md ] && echo OK
```

- [ ] **Step 8: Run verifier on the split skill**

```bash
pnpm verify plugin/skills/<skill>/SKILL.md
```
Expected: GREEN or YELLOW.

- [ ] **Step 9: Commit**

```bash
git add -A plugin/skills/<skill>/
git commit -m "refactor(skills): split <skill> into SKILL.md + references/

Original SKILL.md was <wc> words. Trimmed to ≤2,000 words by moving
deep-dive prose to references/patterns.md and the full PR review
checklist to references/review-checklist.md. Lean SKILL.md keeps
all numbered Core rules with their *Why:* lines, the Red flags
table, the Interactions section, and a pointer to references."
```

**Apply this template to each of the six skills, in this order (alphabetic):**

| Task | Skill |
|---|---|
| 8 | `accessibility-guard` |
| 9 | `cicd-pipeline-safety` |
| 10 | `queue-and-retry-safety` |
| 11 | `resilience-and-error-handling` |
| 12 | `secrets-and-config-safety` |
| 13 | `infra-safe-change` |

After all six commits, confirm the verifier suite still passes:

```bash
pnpm test
```

---

## Task 14 — Refresh `plugin/README.md` for 0.4.0

**Files:**
- Modify: `plugin/README.md`

The README is the consumer-facing source of truth. After this refactor, multiple sections need updates.

- [ ] **Step 1: Update the skill catalog**

Remove from the catalog:
- `_baseline` (relocated to `templates/`)
- `skill-authoring` (merged into `docs/superpowers/skill-authoring-guide.md`)
- `skill-verification` (relocated to `.claude/skills/`)
- `regression-risk-check` (consolidated into `change-risk-evaluation`)
- `rollback-planning` (consolidated into `change-risk-evaluation`)

Update `change-risk-evaluation`'s description in the catalog to reflect the broader scope (now covers blast radius and rollback in addition to risk posture).

Add a new subsection under the catalog or at its end:

```markdown
### Maintainer / experimental skills

- `anthropic-tooling-dev` — guidance for working on Claude Code tooling itself. Placement is being evaluated post-0.4.0; may relocate or be removed from the consumer surface in a future release.
```

- [ ] **Step 2: Update the hooks section**

Replace the current text with content reflecting the new behavior:

```markdown
## Included hooks

- **SessionStart** — injects a one-paragraph reminder of skill-loading discipline (use every relevant skill, name skills explicitly when dispatching subagents).
- **UserPromptSubmit** — re-emits the same reminder as a one-line reinforcement on every prompt.

The previous timestamp loggers (PostToolUse Write/Edit, SessionStart) and the per-prompt full-roster injection were removed in 0.4.0.
```

- [ ] **Step 3: Update the MCP section**

Replace with:

```markdown
## MCP servers

`global-plugin` does not ship any MCP servers in 0.4.0. The previous `.mcp.json` shipped placeholder `echo` servers that broke `/mcp` for consumers and was removed.

If your project uses MCP servers, configure them in your project's own `.mcp.json`. Suggested server names that align with the plugin's guard skills:

- `github` — GitHub MCP server for repo introspection
- `ci-cd` — your CI/CD provider's MCP server (GitHub Actions, CircleCI, etc.)
- `observability` — your observability stack (Datadog, CloudWatch, etc.)
- `cloud` — your cloud provider (AWS)
- `database` — Postgres / Prisma MCP server

These are conventions, not requirements — the plugin's skills do not depend on any specific MCP server being present.
```

- [ ] **Step 4: Add "Recommended companion plugins" section**

This replaces the role of the deleted `dependencies` field. Place it as its own top-level section (e.g., right after "Included hooks" or before "Local test"):

```markdown
## Recommended companion plugins

`global-plugin` is designed to work alongside these plugins. Install them separately for full coverage:

```bash
claude plugin install superpowers --marketplace claude-plugins-official
claude plugin install frontend-design --marketplace claude-plugins-official
claude plugin install prisma --marketplace claude-plugins-official
claude plugin install deploy-on-aws --marketplace claude-plugins-official
claude plugin install semgrep --marketplace claude-plugins-official
```

These are recommendations, not enforced dependencies — the plugin works without them, but several skills cross-reference them by name. If a companion is not installed, those cross-references will be unresolved.
```

- [ ] **Step 5: Remove the "New project setup" section**

Find the section that currently reads:

```markdown
## New project setup

```bash
plugin/scripts/bootstrap-new-project.sh /path/to/new-project
```

Then replace the placeholder MCP commands in `<new-project>/.mcp.json`.
```

Remove this section entirely. Add a brief note in its place (or in the introductory section near the top):

```markdown
> Note: a one-command new-project setup script is being reworked. The previous `plugin/scripts/bootstrap-new-project.sh` is still shipped but its templates have known issues (broken `.mcp.json` placeholders, CLAUDE.md template at a path Claude Code doesn't read). Pending follow-up release.
```

- [ ] **Step 6: Confirm the README still references the right paths**

```bash
# Confirm no leftover references to deleted/moved skills
grep -n "_baseline\|skill-authoring\b\|skill-verification\|regression-risk-check\|rollback-planning" plugin/README.md && echo "FAIL: leftover" || echo OK_NO_LEFTOVER
```

(Note: `skill-authoring` should match nothing; `skill-authoring-guide` is the new doc location and is OK if mentioned.)

- [ ] **Step 7: Commit**

```bash
git add plugin/README.md
git commit -m "docs(plugin): refresh README for 0.4.0

- Skill catalog: removed _baseline, skill-authoring, skill-verification,
  regression-risk-check, rollback-planning. Updated change-risk-evaluation
  description to reflect broadened scope (blast radius + rollback).
- New 'Maintainer / experimental skills' subsection lists
  anthropic-tooling-dev with a 'placement under review' caveat.
- Hooks section updated to reflect trimmed payloads + dropped loggers.
- New 'Recommended companion plugins' section replaces the role of the
  removed dependencies field with explicit install commands.
- MCP section updated: no servers ship; suggested server names listed
  as a checklist for consumers to fill in.
- 'New project setup' section removed; consumers no longer directed
  at the still-broken bootstrap workflow that this refactor parks."
```

---

## Task 15 — Bump version to `0.4.0`

**Files:**
- Modify: `plugin/.claude-plugin/plugin.json`

- [ ] **Step 1: Edit the version field**

Open `plugin/.claude-plugin/plugin.json` and change `"version": "0.3.0"` to `"version": "0.4.0"`. Leave all other fields unchanged.

After edit, the file should be:

```json
{
  "name": "global-plugin",
  "description": "Company-wide Claude Code plugin for full-stack React/Next.js + Node/NestJS + Prisma/Postgres + AWS projects, with optional mobile guardrails for React Native.",
  "version": "0.4.0",
  "author": {
    "name": "logan"
  }
}
```

- [ ] **Step 2: Verify the JSON parses and version is correct**

```bash
node -e "
const p = JSON.parse(require('fs').readFileSync('plugin/.claude-plugin/plugin.json'));
if (p.version !== '0.4.0') { console.error('FAIL: version is '+p.version); process.exit(1); }
if (p.dependencies) { console.error('FAIL: dependencies still present'); process.exit(1); }
console.log('OK 0.4.0');
"
```

- [ ] **Step 3: Commit**

```bash
git add plugin/.claude-plugin/plugin.json
git commit -m "chore: bump plugin version to 0.4.0

Tip of the refactor branch is now unambiguously global-plugin@0.4.0.
Every prior commit on this branch stayed at 0.3.0 to support clean
rollback if any commit needed to be cut.

Breaking changes from 0.3.0 (consumer-visible):
- plugin/.mcp.json removed (was shipping broken echo placeholders)
- skills removed: _baseline, skill-authoring, skill-verification,
  regression-risk-check, rollback-planning
- skill renamed/consolidated: change-risk-evaluation now covers
  blast radius and rollback in addition to risk posture
- hook payloads trimmed (no more 5KB-per-prompt full-roster injection)
- dependencies field removed from manifest (was non-functional)
- 'New project setup' section removed from README pending bootstrap
  rework follow-up"
```

---

## Final acceptance — full smoke test

After Task 15 commits, run the full smoke test from a clean fixture directory.

- [ ] **Step 1: Set up a clean fixture**

```bash
SMOKE=$(mktemp -d -t global-plugin-smoke-XXXX)
cd "$SMOKE"
[ ! -e CLAUDE.md ] && [ ! -e .claude ] && echo OK_CLEAN
[ -e "$HOME/.claude/CLAUDE.md" ] && echo "INFO: user-global CLAUDE.md present (acceptable)"
```

- [ ] **Step 2: Start Claude with the plugin**

```bash
claude --plugin-dir /absolute/path/to/global-plugin/plugin
```

- [ ] **Step 3: In-session smoke checks**

Run each of these and confirm the expected output:

1. `/help` — lists skills. Confirm absent: `_baseline`, `skill-authoring`, `skill-verification`, `regression-risk-check`, `rollback-planning`. Confirm present: `change-risk-evaluation` with the broadened description.
2. `/mcp` — graceful empty (no `echo` placeholder servers, no errors).
3. Verify the SessionStart payload is the trimmed two-sentence reminder, not the previous 5KB roster + EXTREMELY_IMPORTANT block. Two ways to verify: (a) ask the model directly: *"Quote back the additional context the SessionStart hook injected at session start."* — the model should return the ~520-char two-sentence reminder; (b) re-run `node plugin/hooks/inject-skills-reminder.mjs SessionStart` from a shell and visually inspect the JSON payload's `additionalContext` field.
4. Type any user prompt. Verify the UserPromptSubmit hook fires with the one-line reminder. Same two verification methods as above; alternative: invoke the inject script directly with `node plugin/hooks/inject-skills-reminder.mjs UserPromptSubmit`.
5. Type a prompt that should trigger `accessibility-guard` (e.g., *"I'm building a registration form with multi-step validation"*). Confirm the lean SKILL.md loads. Confirm `references/patterns.md` and `references/review-checklist.md` exist on disk under `plugin/skills/accessibility-guard/`.

- [ ] **Step 4: Run final acceptance checklist**

| # | Criterion | How to verify |
|---|---|---|
| 1 | `pnpm test` passes | `pnpm test` from repo root |
| 2 | `pnpm verify` passes for every remaining skill | `for d in plugin/skills/*/; do pnpm verify "$d/SKILL.md"; done` |
| 3 | Smoke test items 1-5 above all pass | Manual session inspection |
| 4 | `plugin/.claude-plugin/plugin.json` is `0.4.0` and has no `dependencies` | `cat plugin/.claude-plugin/plugin.json` |
| 5 | Repo root `templates/` exists with two files | `ls templates/` |
| 6 | No skill carries `## Assumes _baseline. Adds:` | `grep -rl '## Assumes \`_baseline\`. Adds:' plugin/skills/` returns nothing |
| 7 | `plugin/.mcp.json` does not exist | `[ ! -e plugin/.mcp.json ] && echo OK` |
| 8 | The five removed-or-moved skill directories do not exist | `ls plugin/skills/` does not list `_baseline`, `skill-authoring`, `skill-verification`, `regression-risk-check`, `rollback-planning` |
| 9 | `plugin/hooks/hooks.json` has no `PostToolUse` block, no logger sub-steps | `grep -E 'PostToolUse\|mkdir.*plugin-hook.log' plugin/hooks/hooks.json` returns nothing |
| 10 | `plugin/README.md` is up to date — see Task 14 | Manual review against criterion 10 in spec §10 |

When all 10 criteria are satisfied, the refactor is complete. Push the branch.

---

## Rollback

Each commit is independently revertable. To roll back the refactor at any point, revert commits in reverse order:

```bash
git revert HEAD~14..HEAD
```

Or revert a single commit if it introduced a problem and the rest can stay:

```bash
git revert <commit-sha>
```

The husky pre-commit hook (`pnpm verify`) is the per-commit gate; nothing reaches the tree without passing.

---

## Execution choice

**1. Subagent-driven (recommended)** — Fresh subagent per task with two-stage review between tasks. Best for a refactor of this size where each commit is self-contained and benefits from independent review.

**REQUIRED SUB-SKILL:** `superpowers:subagent-driven-development`

**2. Inline execution** — Execute tasks in this session using `superpowers:executing-plans`. Batch execution with checkpoints.

**REQUIRED SUB-SKILL:** `superpowers:executing-plans`

Pick one before starting Task 1.
