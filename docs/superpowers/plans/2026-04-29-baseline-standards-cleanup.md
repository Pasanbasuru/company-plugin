---
skills_invoked:
  - superpowers:brainstorming
  - superpowers:writing-plans
  - anthropic-tooling-dev
  - simplify
  - plugin-dev:plugin-structure
  - plugin-dev:skill-development
---

# Baseline-Standards Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Skill-loading discipline (non-negotiable for any subagent dispatched against this plan):** Before any substantive work, invoke EVERY relevant skill via the `Skill` tool — breadth-first, exhaustive. Required set when working on this repo: `anthropic-tooling-dev`, every `plugin-dev:*` skill, `claude-md-management:claude-md-improver` (when touching `CLAUDE.md`), `simplify`, plus matching `superpowers:*` skills. Each subagent has its own context and must independently invoke the full set. Subagent artifacts MUST start with the YAML `skills_invoked:` frontmatter block. Log "Skills loaded: [list]" as the first line of substantive work.

**Goal:** Delete `templates/baseline-standards.md` and `templates/new-skill-template.md` (and the now-empty `templates/` dir). Remove every reference to baseline-standards from `plugin/` so the plugin is fully self-contained. Update repo-root `CLAUDE.md` / `README.md` and `docs/superpowers/skill-authoring-guide.md` to match. Mark the org-ai-tooling rename spec/plan DEFERRED. All in one atomic commit.

**Architecture:** Single atomic commit (per spec §3 and §7). Sequential tasks edit files in the working tree; the final commit lands them together so the repo never enters a half-cleaned state where references dangle on a deleted file. Pre-commit `pnpm verify` runs against staged SKILL.md files and gates the commit on no-regression-from-current-baseline (21 GREEN + 2 YELLOW + 1 RED `anthropic-tooling-dev`).

**Tech Stack:** Markdown + git + perl (one-liner for bulk heading removal) + pnpm verify.

**Spec:** [`docs/superpowers/specs/2026-04-29-baseline-standards-cleanup-design.md`](../specs/2026-04-29-baseline-standards-cleanup-design.md).

---

## Pre-flight

### Pre-flight Step 1: Confirm branch state

- [ ] **Step 1: Branch state**

Run:

```bash
git status && git log --oneline -1
```

Expected: branch `logan`, working tree clean (or only `docs/superpowers/plans/2026-04-29-org-ai-tooling-rename.md` untracked from the prior session). Tip at commit `07250f4` ("docs(spec): baseline-standards cleanup — make plugin/ self-contained") or later.

### Pre-flight Step 2: Confirm baseline-standards artifacts exist

- [ ] **Step 2: Sanity check the things to delete**

Run:

```bash
ls templates/baseline-standards.md templates/new-skill-template.md
```

Expected: both paths print without error. If either is missing, stop and investigate — the plan's deletion premise is wrong.

### Pre-flight Step 3: Snapshot pre-cleanup verifier baseline

- [ ] **Step 3: Establish baseline verifier verdict distribution**

Run:

```bash
for f in plugin/skills/*/SKILL.md; do
  echo "=== $f ==="
  pnpm verify "$f" 2>&1 | grep "^Verdict:"
done
```

Expected (per spec §10 #7): 21 `Verdict: GREEN` + 2 `Verdict: YELLOW` + 1 `Verdict: RED` (`anthropic-tooling-dev`). Total = 24 skills.

Record this baseline. After cleanup, the same distribution must hold.

### Pre-flight Step 4: Confirm reference inventory

- [ ] **Step 4: Confirm 23 `## Assumes` headings exist + 6 body-text refs**

Run:

```bash
grep -l "^## Assumes \`baseline-standards\`. Adds:" plugin/skills/*/SKILL.md | wc -l
```

Expected: `23`.

Run:

```bash
git grep "templates/baseline-standards" plugin/ | grep -v "^## Assumes"
```

Expected: 7 hits — 6 body-text references in 4 skill files + 1 in `plugin/README.md`. Specifically:

- `plugin/README.md:17`
- `plugin/skills/accessibility-guard/SKILL.md:75`
- `plugin/skills/typescript-rigor/SKILL.md:11`
- `plugin/skills/typescript-rigor/SKILL.md:114`
- `plugin/skills/typescript-rigor/SKILL.md:192`
- `plugin/skills/mobile-implementation-guard/SKILL.md:293`
- `plugin/skills/supply-chain-and-dependencies/SKILL.md:265`

If counts don't match, stop and reconcile against the spec before proceeding.

---

## Task 1: Remove `## Assumes baseline-standards. Adds:` heading from all 23 domain skills

**Files:**
- Modify: 23 `plugin/skills/<name>/SKILL.md` files (per spec §5.3)

The structural pattern in every skill is:

```
[previous content]

## Assumes `baseline-standards`. Adds:

<one-line content describing what this skill adds>

## <next heading>
```

The bulk operation deletes: heading line + blank line + content line + that content line's trailing newline. The blank line BEFORE the heading is preserved (it becomes the blank line before the next heading).

- [ ] **Step 1: Run the bulk perl one-liner**

Run:

```bash
for f in plugin/skills/*/SKILL.md; do
  if grep -q "^## Assumes \`baseline-standards\`\. Adds:" "$f"; then
    perl -i -0pe 's/\n## Assumes `baseline-standards`\. Adds:\n\n[^\n]*\n//g' "$f"
  fi
done
```

Expected: no output (success on each iteration).

- [ ] **Step 2: Verify all 23 headings are gone**

Run:

```bash
grep -l "^## Assumes \`baseline-standards\`. Adds:" plugin/skills/*/SKILL.md
```

Expected: no output (no matching files).

If any file still has the heading (e.g., because its content line spans multiple lines or has unusual formatting), edit it manually:

```bash
# For each remaining file, identify the block and remove with the Edit tool:
# old_string = the 3 lines (heading + blank + content)
# new_string = ""
```

- [ ] **Step 3: Spot-check three files for clean structure**

Run:

```bash
for f in plugin/skills/typescript-rigor/SKILL.md plugin/skills/architecture-guard/SKILL.md plugin/skills/coverage-gap-detection/SKILL.md; do
  echo "=== $f ==="
  sed -n '8,18p' "$f"
done
```

Expected: each file's section after `## Purpose & scope` flows directly into `## Core rules` (or its equivalent next section), with one blank line between, no orphan content where the `## Assumes` block used to be.

No commit yet — single atomic commit at Task 11.

---

## Task 2: Surgical edits to body-text references in 4 skills

**Files:**
- Modify: `plugin/skills/accessibility-guard/SKILL.md`
- Modify: `plugin/skills/typescript-rigor/SKILL.md` (3 edits)
- Modify: `plugin/skills/mobile-implementation-guard/SKILL.md`
- Modify: `plugin/skills/supply-chain-and-dependencies/SKILL.md`

After Task 1 deleted the headings, these surgical edits remove the remaining body-text references. Line numbers below are the PRE-Task-1 numbers; after Task 1, line numbers shift by ~3 lines per file. Use the `Edit` tool with the literal `old_string` shown — line-number drift doesn't matter for `Edit` since it matches text content.

### Task 2.1: accessibility-guard

- [ ] **Step 1: Delete the `Does not duplicate` bullet**

Use the `Edit` tool on `plugin/skills/accessibility-guard/SKILL.md`:

`old_string`:

```
- **Does not duplicate:** `templates/baseline-standards.md`'s accessibility floor; this skill enforces it in concrete review.
```

`new_string`: empty string `""`.

Note: this leaves an extra blank line where the bullet was. If the surrounding markdown becomes a double-blank-line, fix it: replace `\n\n\n` with `\n\n` in that vicinity. Inspect with `grep -B2 -A2 "Does not duplicate" plugin/skills/accessibility-guard/SKILL.md` after the edit.

- [ ] **Step 2: Verify removal**

Run:

```bash
grep -n "templates/baseline-standards" plugin/skills/accessibility-guard/SKILL.md
```

Expected: no output.

### Task 2.2: typescript-rigor — 3 edits

- [ ] **Step 1: Edit `## Purpose & scope` (line ~11)**

Use the `Edit` tool on `plugin/skills/typescript-rigor/SKILL.md`:

`old_string`:

```
Enforce strong type discipline beyond `templates/baseline-standards.md`: model correctness-by-construction at boundaries and in domain code so invalid states are unrepresentable.
```

`new_string`:

```
Enforce strong type discipline: model correctness-by-construction at boundaries and in domain code so invalid states are unrepresentable.
```

(Drops the ` beyond \`templates/baseline-standards.md\`` clause; rest of the sentence stays.)

- [ ] **Step 2: Edit the `tsconfig.json` options paragraph (line ~114)**

Use the `Edit` tool on `plugin/skills/typescript-rigor/SKILL.md`:

`old_string`:

```
Options that go beyond `templates/baseline-standards.md`'s floor; add these to `tsconfig.json`:
```

`new_string`:

```
Recommended `tsconfig.json` options for projects that want stricter TS than the language's defaults:
```

- [ ] **Step 3: Delete the `Does not duplicate` bullet (line ~192)**

Use the `Edit` tool on `plugin/skills/typescript-rigor/SKILL.md`:

`old_string`:

```
- **Does not duplicate:** `templates/baseline-standards.md`'s `strict: true` requirement — this skill adds rigour on top.
```

`new_string`: empty string `""`. Inspect surrounding lines for double-blank cleanup as in Task 2.1.

- [ ] **Step 4: Verify removal**

Run:

```bash
grep -n "templates/baseline-standards" plugin/skills/typescript-rigor/SKILL.md
```

Expected: no output.

### Task 2.3: mobile-implementation-guard

- [ ] **Step 1: Delete the `REQUIRED BACKGROUND` bullet**

Use the `Edit` tool on `plugin/skills/mobile-implementation-guard/SKILL.md`:

`old_string`:

```
- **REQUIRED BACKGROUND:** `templates/baseline-standards.md` — structural expectations shared with all domain skills.
```

`new_string`: empty string `""`. Inspect for double-blank cleanup.

- [ ] **Step 2: Verify the marker check is still satisfied**

Run:

```bash
grep -n "REQUIRED SUB-SKILL\|REQUIRED BACKGROUND\|Hands off to\|Does not duplicate" plugin/skills/mobile-implementation-guard/SKILL.md
```

Expected: at least 3 hits (the surviving `Hands off to:` lines for `state-integrity-check`, `integration-contract-safety`, `accessibility-guard`). The verifier `markers` check requires at least one — three is plenty.

- [ ] **Step 3: Verify removal**

Run:

```bash
grep -n "templates/baseline-standards" plugin/skills/mobile-implementation-guard/SKILL.md
```

Expected: no output.

### Task 2.4: supply-chain-and-dependencies

- [ ] **Step 1: Rewrite the `Does not duplicate` bullet to drop the baseline clause**

Use the `Edit` tool on `plugin/skills/supply-chain-and-dependencies/SKILL.md`:

`old_string`:

```
- **Does not duplicate:** `templates/baseline-standards.md`'s initial stack selection; `architecture-guard`'s enforcement of which internal packages may import which others.
```

`new_string`:

```
- **Does not duplicate:** `architecture-guard`'s enforcement of which internal packages may import which others.
```

(Drops the `templates/baseline-standards.md` clause + the semicolon-separator; keeps the architecture-guard clause.)

- [ ] **Step 2: Verify removal**

Run:

```bash
grep -n "templates/baseline-standards" plugin/skills/supply-chain-and-dependencies/SKILL.md
```

Expected: no output.

---

## Task 3: Update plugin/README.md intro paragraph

**Files:**
- Modify: `plugin/README.md` (intro paragraph at line ~17)

- [ ] **Step 1: Replace the intro paragraph**

Use the `Edit` tool on `plugin/README.md`:

`old_string`:

```
Skills reference the shared baseline (now in `templates/`) for TypeScript strictness, security-by-default, observability, testing, accessibility, performance, and resilience. Skills only document what they add on top.
```

`new_string`:

```
Each skill is self-contained — no cross-references to anything outside the plugin. Skills hold their own domain rules; cross-cutting expectations like TypeScript strictness, security defaults, structured observability, and the test pyramid are in the model's training as canonical defaults rather than restated here.
```

- [ ] **Step 2: Verify**

Run:

```bash
grep -n "baseline\|templates/" plugin/README.md
```

Expected: hits only on `plugin/templates/project/` mentions in the mermaid diagrams (those are intra-plugin references to `plugin/templates/project/`, separate from the deleted root `templates/`). No `baseline-standards` or root-`templates/` hits.

---

## Task 4: Update root CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (repo root) — tree diagram block + standing instruction

- [ ] **Step 1: Drop the `templates/` block from the tree diagram (around line 27–30)**

Use the `Edit` tool on `CLAUDE.md`:

`old_string`:

```
├── templates/                   # skill-author scaffolds + cross-cutting standards
│   ├── new-skill-template.md    # verifier-GREEN skill scaffold
│   └── baseline-standards.md    # baseline rules referenced by domain skills
```

`new_string`: empty string `""`. (Drops the entire 3-line block.)

After the edit, inspect the tree diagram to make sure the surrounding lines (`├── scripts/` above and `├── .husky/pre-commit` below — or whatever sits adjacent) read cleanly. If a stray blank line is left, remove it with another `Edit` call.

- [ ] **Step 2: Delete the standing instruction at line ~89**

Use the `Edit` tool on `CLAUDE.md`:

`old_string`:

```
- Skills should reference `templates/baseline-standards.md` rather than re-stating the cross-cutting TypeScript / security / observability / testing / a11y / perf / resilience standards. Adding the same paragraph to ten skills is a maintenance trap — put it in `templates/baseline-standards.md` and have skills say "additionally, this skill...".
```

`new_string`: empty string `""`.

- [ ] **Step 3: Verify**

Run:

```bash
grep -n "baseline-standards\|templates/" CLAUDE.md
```

Expected: zero hits (no baseline-standards references and no root-`templates/` references). If any survive, investigate.

---

## Task 5: Update root README.md

**Files:**
- Modify: `README.md` (repo root) — intro at line ~19 + layout-table row at line ~28

- [ ] **Step 1: Rewrite the intro paragraph (line ~19)**

Use the `Edit` tool on `README.md`:

`old_string`:

```
Every skill builds on shared baseline standards (kept in `templates/baseline-standards.md` in this source repo, referenced by every domain skill's `## Assumes baseline-standards. Adds:` header) so cross-cutting TypeScript / security / observability / testing / a11y / perf / resilience standards aren't duplicated. A pair of lightweight hooks (SessionStart + UserPromptSubmit) inject a brief skill-loading-discipline reminder; no MCP servers and no loggers ship with the plugin in 0.4.0.
```

`new_string`:

```
Each skill is self-contained — domain skills hold their own rules. A pair of lightweight hooks (SessionStart + UserPromptSubmit) inject a brief skill-loading-discipline reminder; no MCP servers and no loggers ship with the plugin in 0.4.0.
```

- [ ] **Step 2: Delete the `templates/` row from the layout table (line ~28)**

Use the `Edit` tool on `README.md`:

`old_string`:

```
| `templates/` | Skill-author infrastructure: scaffolds and standards reference for skills authored in this repo | No |
```

`new_string`: empty string `""`. After the edit, inspect the surrounding table rows; the table should still parse cleanly (no stray `| --- |` separators left orphan).

- [ ] **Step 3: Verify**

Run:

```bash
grep -n "baseline-standards\|templates/" README.md
```

Expected: zero hits.

---

## Task 6: Update docs/superpowers/skill-authoring-guide.md

**Files:**
- Modify: `docs/superpowers/skill-authoring-guide.md` — 6 edits at lines 16, 17, 38, 170, 171, 180

The exact content of each line was inspected earlier. Apply per-edit:

- [ ] **Step 1: Delete the templates pointer bullets at lines 16–17**

Use the `Edit` tool on `docs/superpowers/skill-authoring-guide.md`:

`old_string`:

```
- **`templates/new-skill-template.md`** — a verifier-GREEN scaffold to copy when starting a new skill. Fill in all placeholder markers with domain-specific content.
- **`templates/baseline-standards.md`** — the cross-cutting rules every domain skill assumes (TypeScript strictness, security defaults, observability, testing, accessibility, performance, resilience). Each domain skill opens with `## Assumes baseline-standards. Adds:` referencing this file.
```

`new_string`: empty string `""`.

- [ ] **Step 2: Delete the `## Assumes` requirement item at line ~38**

Use the `Edit` tool on `docs/superpowers/skill-authoring-guide.md`:

`old_string`:

```
4. `` ## Assumes `baseline-standards`. Adds: `` — one line naming the additional domain (the bare name `baseline-standards` is the canonical reference; it points at `templates/baseline-standards.md` in the source repo).
```

`new_string`: empty string `""`.

After this edit, the surrounding numbered list may have a gap (item 4 missing). Inspect with `grep -B2 -A8 "^1\." docs/superpowers/skill-authoring-guide.md` (or similar) and renumber the subsequent items if the list is sequential. If the list uses just `1. 2. 3.` style, the renumbering is mechanical.

- [ ] **Step 3: Delete the baseline-coverage bullets at lines ~170–171**

Use the `Edit` tool on `docs/superpowers/skill-authoring-guide.md`:

`old_string`:

```
- `templates/baseline-standards.md` is in effect. Do not restate TypeScript strict, observability floor, testing floor, etc.
- The stack pinned in `templates/baseline-standards.md` (Next.js 15, NestJS 11, Prisma 6, Postgres 16, Node 22).
```

`new_string`: empty string `""`.

- [ ] **Step 4: Delete the "Baseline leak" item at line ~180**

Use the `Edit` tool on `docs/superpowers/skill-authoring-guide.md`:

`old_string`:

```
2. **Baseline leak:** rules that restate `templates/baseline-standards.md` get removed.
```

`new_string`: empty string `""`. Renumber the surrounding numbered list if needed (same pattern as Step 2).

- [ ] **Step 5: Verify**

Run:

```bash
grep -n "baseline-standards\|new-skill-template\|templates/" docs/superpowers/skill-authoring-guide.md
```

Expected: zero hits.

---

## Task 7: Mark `docs/followups.md` item #6 RESOLVED

**Files:**
- Modify: `docs/followups.md` — item #6

- [ ] **Step 1: Apply strikethrough + status + resolution note**

Use the `Edit` tool on `docs/followups.md`:

`old_string`:

```
## 6. `templates/baseline-standards.md` runtime inheritance gap

**Status:** OPEN, deliberately deferred (2026-04-28 spec §4).

**Summary:** Every domain skill opens with `## Assumes \`baseline-standards\`. Adds:` referencing the cross-cutting standards doc at `templates/baseline-standards.md`. The reference is textual only — the doc does not auto-load in a consumer session alongside the domain skill. The model has these conventions in training data, so the practical loss is mild, but it is suboptimal compared to the documented intent. Future work could either (a) move the standards into a real consumer-facing skill that the model invokes alongside any domain skill, or (b) make the inheritance explicit via a hook that injects baseline standards at SessionStart.
```

`new_string`:

```
## 6. ~~`templates/baseline-standards.md` runtime inheritance gap~~

**Status:** RESOLVED in 2026-04-29 (delete-not-fix). Implemented per [`docs/superpowers/specs/2026-04-29-baseline-standards-cleanup-design.md`](superpowers/specs/2026-04-29-baseline-standards-cleanup-design.md).

**Resolution:** `templates/baseline-standards.md` deleted outright rather than fixing the inheritance gap. The 8 baseline sections (TypeScript strict, security-by-default, observability floor, testing floor, accessibility floor, performance floor, resilience floor, stack-assumed) are in the model's training as canonical defaults; loading them at runtime adds tokens for marginal benefit. All 23 `## Assumes baseline-standards. Adds:` headings removed from domain skills, plus 6 explicit body-text references in 4 skills. `templates/new-skill-template.md` also deleted (canonical scaffold guidance lives in `docs/superpowers/skill-authoring-guide.md`); the `templates/` directory is gone. Cross-references in `plugin/README.md`, root `CLAUDE.md`, root `README.md`, and `docs/superpowers/skill-authoring-guide.md` updated to match. After this work, `plugin/` references nothing at the repo root — fully self-contained.
```

- [ ] **Step 2: Verify**

Run:

```bash
grep -n "templates/baseline-standards\|baseline-standards" docs/followups.md
```

Expected: hits only inside the new resolution note (mentions of "baseline-standards" in describing what was deleted), and the strikethrough title. No other live references.

---

## Task 8: Mark org-ai-tooling rename spec/plan DEFERRED

**Files:**
- Modify: `docs/superpowers/specs/2026-04-29-org-ai-tooling-rename-design.md`
- Modify + add: `docs/superpowers/plans/2026-04-29-org-ai-tooling-rename.md` (currently untracked)

The DEFERRED callout is identical text in both files (modulo the path the file points back at).

- [ ] **Step 1: Add DEFERRED callout to the rename spec**

Use the `Edit` tool on `docs/superpowers/specs/2026-04-29-org-ai-tooling-rename-design.md`:

`old_string`:

```
# `org-ai-tooling` — Rename + Trigger Tighten + Verifier-Shape Conformance
```

`new_string`:

```
# `org-ai-tooling` — Rename + Trigger Tighten + Verifier-Shape Conformance

> **STATUS: DEFERRED** — paused on 2026-04-29 to land the broader baseline-standards cleanup first ([`docs/superpowers/specs/2026-04-29-baseline-standards-cleanup-design.md`](2026-04-29-baseline-standards-cleanup-design.md)). Some specifics in §5.5 (cross-references) and §6.2 (file-by-file map) will need revision once the cleanup lands, because `plugin/README.md` and root `CLAUDE.md` change. Revisit after that spec ships.
```

- [ ] **Step 2: Add DEFERRED callout to the rename plan**

Use the `Edit` tool on `docs/superpowers/plans/2026-04-29-org-ai-tooling-rename.md`:

`old_string`:

```
# `org-ai-tooling` Rename Implementation Plan
```

`new_string`:

```
# `org-ai-tooling` Rename Implementation Plan

> **STATUS: DEFERRED** — paused on 2026-04-29 to land the broader baseline-standards cleanup first ([`docs/superpowers/specs/2026-04-29-baseline-standards-cleanup-design.md`](../specs/2026-04-29-baseline-standards-cleanup-design.md)). The plan's task list is largely still valid, but Task 5 (plugin/README.md catalog row), Task 6 (root CLAUDE.md non-negotiable list), and the cross-reference grep expectations in Task 8 will shift after the cleanup lands. Re-derive against the new state when re-engaging.
```

- [ ] **Step 3: Track the plan file in git**

Run:

```bash
git add docs/superpowers/plans/2026-04-29-org-ai-tooling-rename.md
```

(The plan file is currently untracked; this stages it for the atomic commit alongside the DEFERRED marker.)

---

## Task 9: Delete `templates/` files

**Files:**
- Delete: `templates/baseline-standards.md`
- Delete: `templates/new-skill-template.md`
- Delete: `templates/` directory (auto-removed when both files are gone)

- [ ] **Step 1: Delete both files**

Run:

```bash
git rm templates/baseline-standards.md templates/new-skill-template.md
```

Expected:

```
rm 'templates/baseline-standards.md'
rm 'templates/new-skill-template.md'
```

- [ ] **Step 2: Confirm `templates/` is gone**

Run:

```bash
ls templates/ 2>&1
```

Expected: `ls: cannot access 'templates/': No such file or directory` (or the bash equivalent — directory does not exist).

If the directory persists with hidden files, investigate; otherwise, git's working-tree representation no longer has the directory once both files are removed.

---

## Task 10: Verify everything

This is the hard gate before the commit.

- [ ] **Step 1: Re-run the per-skill verifier and confirm no regression**

Run:

```bash
for f in plugin/skills/*/SKILL.md; do
  echo "=== $f ==="
  pnpm verify "$f" 2>&1 | grep "^Verdict:"
done
```

Expected: same distribution as Pre-flight Step 3 — 21 GREEN + 2 YELLOW + 1 RED (`anthropic-tooling-dev`). Specifically:

- No GREEN skill regresses to YELLOW or RED.
- No YELLOW skill regresses to RED.
- The pre-existing RED (`anthropic-tooling-dev`) is still RED — its rename is the next spec, not this one.

If any skill regresses, investigate. The most likely culprits:

- Double-blank-line that broke a section boundary (fix: re-edit to single blank).
- Lost a `Hands off to:` / `Does not duplicate:` / `REQUIRED BACKGROUND:` marker — re-inspect Task 2 edits in that file.

- [ ] **Step 2: Run the full test suite**

Run:

```bash
pnpm test
```

Expected: all tests pass — no regression from the `logan` tip.

- [ ] **Step 3: Consumer-facing self-containment grep**

Run:

```bash
git grep "baseline-standards" plugin/
```

Expected: **zero hits**. This is the headline outcome — `plugin/` references no baseline-standards anywhere.

Run:

```bash
git grep "templates/" plugin/
```

Expected: hits only on `plugin/templates/project/...` paths inside `plugin/scripts/bootstrap-new-project.sh` and `plugin/README.md`'s mermaid diagrams (intra-plugin; tracked separately as parked item #4). No hits on bare `templates/` (without the `project/` qualifier).

- [ ] **Step 4: Repo-level grep — cleanup completeness**

Run:

```bash
git grep "baseline-standards"
```

Expected hits, and only these:

- Files under `docs/superpowers/audits/`, `docs/superpowers/specs/`, `docs/superpowers/plans/` (historical artifacts plus the new cleanup spec/plan; preserved per the no-historical-edits convention).
- `docs/followups.md` — exactly two expected hits inside item #6 (the struck-through title + the resolution note).

Any hit in `plugin/`, root `CLAUDE.md`, root `README.md`, or `docs/superpowers/skill-authoring-guide.md` is a defect — fix it and re-run.

- [ ] **Step 5: Confirm `## Assumes` heading is gone everywhere**

Run:

```bash
git grep "## Assumes \`baseline-standards\`"
```

Expected hits, and only these: same `docs/superpowers/{audits,specs,plans}/` historical artifacts and the cleanup spec/plan describing what was removed. No hits in `plugin/skills/`.

---

## Task 11: Commit

**Files staged:** all changes from Tasks 1–9.

- [ ] **Step 1: Review staged changes**

Run:

```bash
git status && git diff --stat HEAD
```

Expected `git status` includes (some as `modified`, some as `deleted`, one as `new file`):

- `modified: plugin/skills/<name>/SKILL.md` × 23 (heading removals from Task 1)
- `modified: plugin/skills/accessibility-guard/SKILL.md` (also from Task 2.1 — may show as a single combined entry)
- `modified: plugin/skills/typescript-rigor/SKILL.md` (also from Task 2.2)
- `modified: plugin/skills/mobile-implementation-guard/SKILL.md` (also from Task 2.3)
- `modified: plugin/skills/supply-chain-and-dependencies/SKILL.md` (also from Task 2.4)
- `modified: plugin/README.md`
- `modified: CLAUDE.md`
- `modified: README.md`
- `modified: docs/superpowers/skill-authoring-guide.md`
- `modified: docs/followups.md`
- `modified: docs/superpowers/specs/2026-04-29-org-ai-tooling-rename-design.md` (DEFERRED callout)
- `new file: docs/superpowers/plans/2026-04-29-org-ai-tooling-rename.md` (DEFERRED, freshly tracked)
- `deleted: templates/baseline-standards.md`
- `deleted: templates/new-skill-template.md`

- [ ] **Step 2: Stage everything**

Run:

```bash
git add plugin/ CLAUDE.md README.md docs/
```

(Task 9's `git rm` already staged the templates/ deletions; Task 8 Step 3 staged the rename plan. This `git add` covers everything else.)

- [ ] **Step 3: Commit**

Run:

```bash
git commit -m "$(cat <<'EOF'
refactor: delete templates/, drop baseline-standards cross-references; plugin/ now self-contained

Closes followups item #6. Single atomic cleanup:

- Delete templates/baseline-standards.md and templates/new-skill-template.md;
  the templates/ directory itself goes with them.
- Remove ## Assumes `baseline-standards`. Adds: heading + 1-line follow-on
  from all 23 domain skills under plugin/skills/.
- Surgical edits in 4 skills (accessibility-guard, typescript-rigor x3,
  mobile-implementation-guard, supply-chain-and-dependencies) to drop the
  remaining body-text references to templates/baseline-standards.md.
- Update plugin/README.md intro paragraph; update root CLAUDE.md
  (tree diagram block + standing instruction); update root README.md
  (intro paragraph + drop templates/ row from layout table); update
  docs/superpowers/skill-authoring-guide.md (6 line edits).
- Mark followups item #6 RESOLVED with strikethrough title and resolution
  note.
- Mark org-ai-tooling rename spec and plan DEFERRED, awaiting revisit
  post-cleanup. Plan file added to git (was previously untracked).

After this commit: git grep "baseline-standards" plugin/ returns zero hits.
plugin/ is fully self-contained.

Spec: docs/superpowers/specs/2026-04-29-baseline-standards-cleanup-design.md
Plan: docs/superpowers/plans/2026-04-29-baseline-standards-cleanup.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected:

- The husky pre-commit hook runs `pnpm verify` against staged `plugin/skills/*/SKILL.md`. It must produce the same verdict distribution as Task 10 Step 1 (no regression).
- A new commit is created.

If the pre-commit hook fails, do NOT use `--no-verify`. Re-read the verifier output, fix the offending file, re-stage, and create a NEW commit (never amend across a hook failure per repo convention).

- [ ] **Step 4: Confirm commit landed**

Run:

```bash
git log --oneline -1 && git status
```

Expected: latest commit is the cleanup; working tree clean.

- [ ] **Step 5: Do NOT push**

Per the user's session-default workflow, commits stay local until the user explicitly pushes. Stop after Step 4.

---

## Acceptance criteria (from spec §10)

The plan is complete when **all** of the following hold (verified across Tasks 9–10):

1. `templates/baseline-standards.md` does not exist. ✓ Task 9 Step 1 + Step 2.
2. `templates/new-skill-template.md` does not exist. ✓ Task 9 Step 1 + Step 2.
3. `templates/` directory does not exist. ✓ Task 9 Step 2.
4. `git grep "baseline-standards" plugin/` returns zero hits. ✓ Task 10 Step 3.
5. `git grep "templates/" plugin/` returns hits only inside `plugin/templates/project/` and `plugin/scripts/`. ✓ Task 10 Step 3.
6. No `## Assumes baseline-standards. Adds:` heading appears in any `plugin/skills/*/SKILL.md`. ✓ Task 1 Step 2 + Task 10 Step 5.
7. `pnpm verify` returns same verdict-distribution as pre-cleanup baseline (21 GREEN + 2 YELLOW + 1 RED `anthropic-tooling-dev`). ✓ Task 10 Step 1.
8. `pnpm test` passes (no regression). ✓ Task 10 Step 2.
9. `plugin/README.md` line 17 area no longer references baseline-standards or root `templates/`. ✓ Task 3 Step 2.
10. Root `CLAUDE.md` no longer references `baseline-standards.md` or root `templates/`. ✓ Task 4 Step 3.
11. Root `README.md` no longer has a `templates/` row in the layout table or a baseline-standards mention in the intro. ✓ Task 5 Step 3.
12. `docs/superpowers/skill-authoring-guide.md` no longer references baseline-standards or `templates/new-skill-template.md`. ✓ Task 6 Step 5.
13. `docs/followups.md` item #6 marked RESOLVED with strikethrough title and resolution note. ✓ Task 7 Step 2.
14. Org-ai-tooling rename spec and plan carry DEFERRED callouts pointing at this cleanup spec. ✓ Task 8 Steps 1–2.

---

## Self-review notes

**Spec coverage:** Every locked decision in spec §5 maps to a task — §5.1 (delete baseline-standards.md) → Task 9; §5.2 (delete new-skill-template.md + templates/ dir) → Task 9; §5.3 (heading removal in 23 skills) → Task 1; §5.4 (6 surgical body-text edits in 4 skills) → Task 2; §5.5 (doc updates across plugin/README, root CLAUDE.md, root README.md, skill-authoring-guide, followups item #6) → Tasks 3–7; §5.6 (DEFERRED markers on org-ai-tooling artifacts) → Task 8. File-by-file map (§6) → Tasks 1–9. Single-commit rule (§7) → Task 11. All risks (§8) addressed by per-step verification: R1 (skill content thinness) → Task 10 Step 1 verifier check; R2 (verifier markers) → Task 2.3 Step 2 explicit marker check; R3 (CLAUDE.md straggler) → Task 4 Step 3 grep; R4 (templates/ dir survival) → Task 9 Step 2; R5 (DEFERRED callout text) → Task 8 written explicitly; R6 (test regression) → Task 10 Step 2.

**Placeholder scan:** No "TBD", "TODO", "implement later", "fill in details", or "similar to Task N" anywhere. Every `Edit` invocation has the exact `old_string` and `new_string` content. The bulk perl one-liner (Task 1) handles the 23 sed-able edits without needing per-file content.

**Type consistency:** N/A — no code types. Heading-name consistency: this plan removes `## Assumes baseline-standards. Adds:` everywhere; no other heading is renamed or introduced. Marker-name consistency: only `REQUIRED BACKGROUND` removal (mobile-implementation-guard); other markers (`Hands off to:`, `Does not duplicate:`, `REQUIRED SUB-SKILL:`) are unaffected.

If you find a spec requirement with no task or a contradiction between tasks, fix it inline.
