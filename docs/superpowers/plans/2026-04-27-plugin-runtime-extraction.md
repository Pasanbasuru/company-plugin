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
  - simplify
  - superpowers:brainstorming
  - superpowers:writing-plans
---

# Plugin Runtime Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **REQUIRED BACKGROUND for any subagent dispatched off this plan:** invoke every relevant `company-plugin:*` skill from the SessionStart roster (the same way `inject-skills-reminder.mjs` expects). Subagents do NOT inherit parent context — name the skills explicitly when you dispatch.

**Goal:** Move every consumer-facing component of the `company-plugin` into `plugin/` and keep maintainer-only / build-only tooling at the repo root, so a consumer who installs the plugin via marketplace gets *only* the runtime, while contributors keep the full dev harness.

**Architecture:** Mirror the two-mode pattern used in `board-plugin` (`/c/Users/logan/Desktop/projects/org/board-plugin`). Repo root holds dev infra: skill-verifier TypeScript, husky pre-commit, vitest, docs, audits, plans, specs, workflows. The `plugin/` subdir is self-contained (manifest, hooks, skills, MCP config, consumer README) and is the *only* path a marketplace `git-subdir` source would publish.

**Tech Stack:** existing — TypeScript (tsx), vitest, husky, pnpm, Node ESM hooks, Claude Code plugin loader.

---

## Decisions resolved up front

The following choices are baked into this plan; no decisions are left to the executor.

| # | Decision | Resolution | Notes |
|---|---|---|---|
| 1 | Plugin runtime directory name | `plugin/` (singular, matches `board-plugin`) | No nested `<name>/` subfolder; one plugin = one dir. |
| 2 | Bootstrap script + `templates/` disposition | Ship inside the plugin | Consumers get them via marketplace install. |
| 3 | The 38-byte root `settings.json` (`{"agent":"security-reviewer"}`) | Delete | No documented auto-load path; references the agent we're also dropping. |
| 4 | `agents/security-reviewer.md` | Delete (for now) | Removed entirely; `agents/` dir disappears with it. Plugin ships zero agents. |
| 5 | `CLAUDE.md` at repo root | Add | Encodes the two-mode rule for future agents working in this repo. |
| 6 | Stale slash-command namespace in docs (`/company-superpowers-plugin:` → `/company-plugin:`) | Fix in this PR | Pure text replacement; manifest already says `company-plugin`. |
| 7 | `.claude-plugin/marketplace.json` at repo root | Skip — file as follow-up | Requires real GitHub owner/URL; not committing a placeholder. |
| 8 | Broken `.mcp.json` echo-placeholder MCP servers | Skip — file as follow-up | Pre-existing; behavior change, out of scope here. |
| 9 | `skill-verification` CLI unavailable to consumers (`pnpm verify`) | Skip — file as follow-up | Pre-existing; needs design (ship verifier in plugin? rewrite skill text?). |

---

## Two-mode rationale (one paragraph)

Today every file in this repo is "the plugin." A consumer cloning the source can't tell what they should install vs. what's only there for contributors. A marketplace `git-subdir` install can't fetch only the runtime — there's no subdir to point at. The husky pre-commit, vitest tests, scripts/verify TypeScript, audits, and superpowers plan/spec history all currently sit next to the plugin's auto-discovered `hooks/`, `skills/`, `.mcp.json` — meaning they'd ship to a consumer's plugin cache if we ever wired a marketplace source at this repo root. Splitting along "what gets fetched by Claude Code's plugin loader" vs. "what supports the maintainer's workflow" gives a clean boundary that matches how `board-plugin` ships and what the plugin-dev skills expect.

---

## Target file structure

```
global-plugin/                                   # source repo (NOT shipped to consumers)
├── .claude/
│   ├── settings.json                            # maintainer dev config (enabledPlugins)
│   └── settings.local.json                      # maintainer permissions
├── .husky/
│   └── pre-commit                               # MODIFIED: grep pattern updates
├── .gitignore
├── CLAUDE.md                                    # NEW: maintainer-facing two-mode rule + repo layout
├── README.md                                    # REWRITTEN: maintainer-facing
├── package.json                                 # unchanged (vitest, husky, tsx — all dev deps)
├── pnpm-lock.yaml                               # unchanged
├── tsconfig.json                                # unchanged (already only includes scripts/**)
├── docs/                                        # unchanged structure: design, installation, superpowers/
│   ├── design.md
│   ├── installation.md                          # MODIFIED: paths and slash-command namespace
│   └── superpowers/
│       ├── audits/, plans/, specs/, workflows/
│       ├── skill-authoring-guide.md
│       └── testing-skills-against-workflows.md
├── scripts/                                     # unchanged: skill-verifier dev infra
│   ├── verify-skill.ts
│   ├── verify/{parse.ts, parse.test.ts, run.ts, run.test.ts, types.ts, checks/}
│   └── fixtures/{good-skill, bad-no-interactions, bad-oversize, bad-prose-handoff, bad-weak-description}
└── plugin/                                      # PLUGIN RUNTIME — what consumers install
    ├── .claude-plugin/
    │   └── plugin.json                          # MOVED from repo-root .claude-plugin/
    ├── README.md                                # NEW: consumer-facing
    ├── hooks/
    │   ├── hooks.json                           # MOVED — uses ${CLAUDE_PLUGIN_ROOT}, no path edits
    │   └── inject-skills-reminder.mjs           # MOVED — reads ${CLAUDE_PLUGIN_ROOT}/skills, no edits
    ├── skills/                                  # MOVED (28 skill dirs, including _baseline)
    │   ├── _baseline/, accessibility-guard/, architecture-guard/, …
    │   ├── skill-authoring/                     # consumer-facing meta-skill
    │   └── skill-verification/                  # consumer-facing meta-skill
    ├── .mcp.json                                # MOVED (placeholder content; flagged as follow-up)
    ├── scripts/
    │   └── bootstrap-new-project.sh             # MOVED+RENAMED, switched to BASH_SOURCE-relative paths
    └── templates/
        └── project/.claude/{CLAUDE.md, settings.json}, project/.mcp.json
```

Note: no `agents/` dir at root or in `plugin/` — the only agent file is being deleted.

---

## Disposition matrix (every existing top-level entry)

| Existing path                         | Classification          | Action                                                                          |
|---------------------------------------|-------------------------|---------------------------------------------------------------------------------|
| `.claude-plugin/plugin.json`          | Consumer (manifest)     | `git mv` → `plugin/.claude-plugin/plugin.json`                                  |
| `.claude/settings.json`               | Maintainer-local        | Stays                                                                           |
| `.claude/settings.local.json`         | Maintainer-local        | Stays                                                                           |
| `.husky/pre-commit`                   | Maintainer (build infra)| Stays; **modify grep pattern** to match new skill path                          |
| `.gitignore`                          | Maintainer              | Stays                                                                           |
| `.mcp.json`                           | Consumer (MCP config)   | `git mv` → `plugin/.mcp.json` (placeholder content; follow-up)                  |
| `agents/security-reviewer.md`         | Consumer                | **Delete** (decision #4)                                                        |
| `agents/` (dir)                       | n/a                     | Disappears with the file above                                                  |
| `docs/`                               | Maintainer              | Stays; `installation.md` paths/namespace update                                 |
| `hooks/hooks.json`                    | Consumer                | `git mv` → `plugin/hooks/hooks.json`                                            |
| `hooks/inject-skills-reminder.mjs`    | Consumer                | `git mv` → `plugin/hooks/inject-skills-reminder.mjs`                            |
| `package.json`                        | Maintainer (dev deps)   | Stays                                                                           |
| `pnpm-lock.yaml`                      | Maintainer              | Stays                                                                           |
| `README.md`                           | Both (currently mixed)  | **Rewrite** as maintainer-facing; new consumer-facing README in `plugin/`       |
| `scripts/verify-skill.ts`             | Maintainer              | Stays                                                                           |
| `scripts/verify/`                     | Maintainer              | Stays                                                                           |
| `scripts/fixtures/`                   | Maintainer              | Stays                                                                           |
| `scripts_bootstrap_new_project.sh`    | Consumer onboarding     | `git mv` + rename → `plugin/scripts/bootstrap-new-project.sh`; switch `cp` source paths to `BASH_SOURCE`-relative |
| `settings.json` (root, 38 bytes)      | Dead                    | **Delete** (decision #3)                                                        |
| `skills/` (28 dirs)                   | Consumer                | `git mv` → `plugin/skills/`                                                     |
| `templates/project/`                  | Consumer onboarding     | `git mv` → `plugin/templates/project/`                                          |
| `tsconfig.json`                       | Maintainer              | Stays                                                                           |
| `CLAUDE.md`                           | Maintainer              | **Create** (decision #5)                                                        |

---

## Tasks

> Each task has bite-sized steps, explicit `git mv` commands so history is preserved, exact expected output, and a commit at the end. **Do tasks in order** — Task 1 must land before Task 2 can be tested, etc.

---

### Task 1: Create the empty plugin directory skeleton

**Files:**
- Create: `plugin/.claude-plugin/`, `plugin/scripts/`

> **Why only these two:** `plugin/.claude-plugin/` is the destination of a *file* move (Task 2 moves `plugin.json` into it) and `plugin/scripts/` is the destination of a *file rename move* (Task 5 moves the bootstrap script into it with a new name). Both REQUIRE the parent dir to pre-exist. The other plugin subdirectories — `plugin/hooks/`, `plugin/skills/`, `plugin/templates/` — are destinations of *directory* moves (Tasks 4 and 6 do `git mv hooks plugin/hooks` etc.). For a directory rename, `git mv <src> <dest>` works correctly only when `<dest>` does NOT pre-exist; if it does, the source is nested INSIDE the destination (e.g., `plugin/hooks/hooks/hooks.json`). So pre-creating those three is actively harmful.

- [ ] **Step 1: Create the directories**

Run from repo root:

```bash
mkdir -p plugin/.claude-plugin
mkdir -p plugin/scripts
```

Expected: no output. `ls plugin/` lists exactly two directories.

- [ ] **Step 2: Verify the rule above held**

Run: `ls plugin/`
Expected output (exactly): `.claude-plugin  scripts` (two entries; nothing else).

Run: `find plugin -type f`
Expected: no output.

- [ ] **Step 3: No commit yet**

Empty dirs aren't tracked by git; the next task adds files.

---

### Task 2: Move the manifest

**Files:**
- Move: `.claude-plugin/plugin.json` → `plugin/.claude-plugin/plugin.json`
- Delete: empty `.claude-plugin/` at repo root

- [ ] **Step 1: git mv the manifest**

```bash
git mv .claude-plugin/plugin.json plugin/.claude-plugin/plugin.json
```

Expected: no output, exit 0.

- [ ] **Step 2: Remove the empty repo-root .claude-plugin directory**

```bash
rmdir .claude-plugin
```

Expected: no output, exit 0. (The directory should be empty now that the manifest is gone.)

- [ ] **Step 3: Verify the manifest is at the new path**

Run: `head -3 plugin/.claude-plugin/plugin.json`
Expected: shows `"name": "company-plugin"` line.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move plugin manifest into plugin/.claude-plugin/"
```

---

### Task 3: Delete the security-reviewer agent and the dead root `settings.json`

**Files:**
- Delete: `agents/security-reviewer.md`
- Delete: `agents/` (becomes empty after the file is gone)
- Delete: `settings.json` (root, 38 bytes)

- [ ] **Step 1: Confirm the dead `settings.json` content one more time**

Run: `cat settings.json`
Expected: `{"agent":"security-reviewer"}` (or near-identical 38-byte content).

- [ ] **Step 2: Confirm the agent file is the only thing in `agents/`**

Run: `ls agents/`
Expected: only `security-reviewer.md`.

- [ ] **Step 3: Confirm nothing else references the agent file**

Run:

```bash
grep -rn 'security-reviewer' . \
  --include='*.md' --include='*.sh' --include='*.ts' --include='*.mjs' --include='*.json' \
  | grep -v 'docs/superpowers/plans/2026-04-27' \
  | grep -v 'docs/superpowers/audits/' \
  | grep -v node_modules
```

Expected hits, all benign and addressed elsewhere:
- `README.md` mentioning the agent in the Included-agent section (rewritten in Task 9).
- `settings.json` (also being deleted in this task).

If anything else surfaces (e.g., a hook script that conditionally invokes it), pause and reassess before deleting.

- [ ] **Step 4: Delete the files**

```bash
git rm agents/security-reviewer.md
git rm settings.json
```

Expected: `agents/` directory disappears (git doesn't track empty dirs).

- [ ] **Step 5: Commit**

```bash
git commit -m "chore: drop security-reviewer agent and the dead root-level settings.json"
```

---

### Task 4: Move hooks, the MCP config, and the consumer-facing skills

**Files:**
- Move: `hooks/` → `plugin/hooks/`
- Move: `skills/` → `plugin/skills/`
- Move: `.mcp.json` → `plugin/.mcp.json`

> The hook script reads `process.env.CLAUDE_PLUGIN_ROOT` and joins `skills/` to it (`hooks/inject-skills-reminder.mjs:11`). After moving, `CLAUDE_PLUGIN_ROOT` resolves to `plugin/` in the consumer's plugin cache, so `${CLAUDE_PLUGIN_ROOT}/skills/` still works. **No code change needed in the hook script.** Verified by smoke-testing in Task 11.

- [ ] **Step 1: git mv each top-level dir/file**

```bash
git mv hooks plugin/hooks
git mv skills plugin/skills
git mv .mcp.json plugin/.mcp.json
```

Expected: no output, exit 0 on each.

- [ ] **Step 2: Verify the moves**

```bash
ls plugin/hooks/hooks.json
ls plugin/hooks/inject-skills-reminder.mjs
ls plugin/.mcp.json
ls plugin/skills/_baseline/SKILL.md
ls plugin/skills/skill-authoring/SKILL.md
ls plugin/skills/architecture-guard/SKILL.md
```

Expected: every path exists; no errors.

- [ ] **Step 3: Verify the source paths are gone**

Run: `ls hooks skills .mcp.json 2>&1 | grep -i 'no such' | wc -l`
Expected: `3`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move hooks/skills/.mcp.json into plugin/"
```

---

### Task 5: Move + rename the bootstrap script, switch to BASH_SOURCE-relative template paths

**Files:**
- Move: `scripts_bootstrap_new_project.sh` → `plugin/scripts/bootstrap-new-project.sh`
- Modify: `plugin/scripts/bootstrap-new-project.sh` (cp source paths)

- [ ] **Step 1: git mv with rename**

```bash
git mv scripts_bootstrap_new_project.sh plugin/scripts/bootstrap-new-project.sh
```

Expected: no output, exit 0.

- [ ] **Step 2: Replace the script contents**

The current contents (after move, before edit) are:

```bash
#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-.}"
mkdir -p "$TARGET_DIR/.claude"
cp templates/project/.claude/CLAUDE.md "$TARGET_DIR/.claude/CLAUDE.md"
cp templates/project/.claude/settings.json "$TARGET_DIR/.claude/settings.json"
cp templates/project/.mcp.json "$TARGET_DIR/.mcp.json"

echo "Project Claude files copied to $TARGET_DIR"
echo "Next: replace MCP placeholder commands in $TARGET_DIR/.mcp.json"
```

Replace the entire file with:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Resolve the plugin root from this script's location so the script
# works whether invoked from the source repo or the consumer's plugin cache.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TARGET_DIR="${1:-.}"
mkdir -p "$TARGET_DIR/.claude"
cp "$PLUGIN_ROOT/templates/project/.claude/CLAUDE.md" "$TARGET_DIR/.claude/CLAUDE.md"
cp "$PLUGIN_ROOT/templates/project/.claude/settings.json" "$TARGET_DIR/.claude/settings.json"
cp "$PLUGIN_ROOT/templates/project/.mcp.json" "$TARGET_DIR/.mcp.json"

echo "Project Claude files copied to $TARGET_DIR"
echo "Next: replace MCP placeholder commands in $TARGET_DIR/.mcp.json"
```

- [ ] **Step 3: Verify the script is still executable**

Run: `ls -la plugin/scripts/bootstrap-new-project.sh`
Expected: line shows `-rwxr-xr-x` (or equivalent on Windows). If not, run `chmod +x plugin/scripts/bootstrap-new-project.sh`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: ship bootstrap-new-project.sh inside plugin and resolve templates via BASH_SOURCE"
```

---

### Task 6: Move the project templates and smoke-test the bootstrap script

**Files:**
- Move: `templates/` → `plugin/templates/`

- [ ] **Step 1: git mv the templates dir**

```bash
git mv templates plugin/templates
```

Expected: no output, exit 0.

- [ ] **Step 2: Verify the templates are at the new path**

```bash
ls plugin/templates/project/.claude/CLAUDE.md
ls plugin/templates/project/.claude/settings.json
ls plugin/templates/project/.mcp.json
```

Expected: all three exist.

- [ ] **Step 3: Smoke-test the bootstrap script end-to-end**

```bash
mkdir -p /tmp/bootstrap-test
plugin/scripts/bootstrap-new-project.sh /tmp/bootstrap-test
ls /tmp/bootstrap-test/.claude/CLAUDE.md
ls /tmp/bootstrap-test/.claude/settings.json
ls /tmp/bootstrap-test/.mcp.json
rm -rf /tmp/bootstrap-test
```

Expected: all three files exist after the run; no errors. This proves the `BASH_SOURCE`-relative path math resolves correctly.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move templates/ into plugin/templates/"
```

---

### Task 7: Update `.husky/pre-commit` grep pattern

**Files:**
- Modify: `.husky/pre-commit` (line 4)

Current line 4:

```bash
staged=$(git diff --cached --name-only --diff-filter=ACM | grep -E '^skills/[^/]+/SKILL\.md$' || true)
```

After Task 4, skills live at `plugin/skills/<name>/SKILL.md`, so the grep no longer matches and the hook becomes a silent no-op.

- [ ] **Step 1: Edit the line**

Replace line 4 with:

```bash
staged=$(git diff --cached --name-only --diff-filter=ACM | grep -E '^plugin/skills/[^/]+/SKILL\.md$' || true)
```

- [ ] **Step 2: Smoke-test the hook fires on a staged SKILL.md**

```bash
git checkout plugin/skills/_baseline/SKILL.md  # ensure clean
echo "" >> plugin/skills/_baseline/SKILL.md
git add plugin/skills/_baseline/SKILL.md
.husky/pre-commit
echo "Hook exit: $?"
git reset HEAD plugin/skills/_baseline/SKILL.md
git checkout plugin/skills/_baseline/SKILL.md
```

Expected: hook prints `→ skill-verification (fast mode) on staged SKILL.md files` and runs `pnpm verify`. Exit 0 if `_baseline` is GREEN, non-zero with findings if not — either is fine; the point is the hook fired against the new path.

- [ ] **Step 3: Smoke-test the hook is a no-op when no SKILL.md is staged**

```bash
echo "scratch" > /tmp/dummy.txt
.husky/pre-commit  # nothing skill-relevant staged
echo "Hook exit: $?"
rm /tmp/dummy.txt
```

Expected: exits silently with code 0; no `pnpm verify` invocation.

- [ ] **Step 4: Commit**

```bash
git add .husky/pre-commit
git commit -m "chore(husky): update pre-commit grep to match plugin/skills/ path"
```

---

### Task 8: Smoke-test the verifier still resolves moved skill paths

**Files:** none modified — verification only.

> `scripts/verify-skill.ts:14` calls `resolve(arg)` and accepts any absolute or repo-relative path. No code change needed; just confirm.

- [ ] **Step 1: Run pnpm verify against the unchanged good fixture**

```bash
pnpm verify scripts/fixtures/good-skill/SKILL.md
```

Expected: exit 0, output ends with the same verdict as before the refactor (record the baseline if you want to compare; the refactor doesn't touch the fixture).

- [ ] **Step 2: Run pnpm verify against a real moved skill**

```bash
pnpm verify plugin/skills/architecture-guard/SKILL.md
```

Expected: exit 0 or 1 with formatted findings — either is fine. The point is the verifier resolves the new path and runs.

- [ ] **Step 3: Run the full vitest suite**

```bash
pnpm test
```

Expected: all tests pass. The verifier tests don't reference plugin paths.

- [ ] **Step 4: No commit**

Verification only.

---

### Task 9: Rewrite README + add consumer-facing plugin README + fix docs/installation.md

**Files:**
- Modify: `README.md` (root) — rewrite as maintainer-facing
- Create: `plugin/README.md` — consumer-facing
- Modify: `docs/installation.md` — paths and slash-command namespace

#### Step 1: Rewrite the root README

Replace `README.md` with maintainer-focused content. Target ≤ 80 lines. Suggested skeleton:

```markdown
# global-plugin

Source repo for the `company-plugin` Claude Code plugin.

## Status

Shipping. Plugin runtime lives in `plugin/`. Repo root is dev infra only.

## Repo layout

| Path | Purpose |
|---|---|
| `plugin/` | The plugin runtime — what consumers install. Self-contained. |
| `scripts/` | Skill-verifier (TypeScript). Dev-only. |
| `.husky/` | Pre-commit hook that runs `pnpm verify` on staged SKILL.md files. |
| `docs/` | Design notes, plans, specs, audits, workflows. |
| `package.json` | Dev deps only (vitest, husky, tsx). Not shipped. |

## Local test

From any project directory:

```bash
claude --plugin-dir /absolute/path/to/global-plugin/plugin
```

Inside Claude Code:

- `/help` lists `company-plugin` skills.
- `/mcp` lists the (placeholder) MCP servers.
- `/company-plugin:architecture-guard` triggers a skill.

## Maintainer workflow

```bash
pnpm install            # one-time
pnpm test               # vitest suite
pnpm verify plugin/skills/<name>/SKILL.md   # one skill
```

The husky pre-commit hook runs `pnpm verify` automatically on staged `plugin/skills/*/SKILL.md` files.

## Consumer-facing docs

See `plugin/README.md` for what the plugin does and how to install it.
```

#### Step 2: Write `plugin/README.md`

Move consumer content out of the (old) root README. Target ≤ 100 lines.

Move these sections from the old root README into `plugin/README.md`:
- Project description (1-line + target stack)
- Included skills (the categorized list)
- Included hooks (SessionStart logger, PostToolUse logger)
- Included MCP template (placeholder, with the disclaimer)
- External plugin dependencies
- Local test
- New project setup (the bootstrap-script invocation)

Apply these edits during the move:
- Drop the "Included agent" section entirely (no agent ships).
- Replace every `/company-superpowers-plugin:<skill>` with `/company-plugin:<skill>`.
- Update the local-test command to `claude --plugin-dir /absolute/path/to/global-plugin/plugin`.
- Update the bootstrap-script invocation to `plugin/scripts/bootstrap-new-project.sh /path/to/new-project`.

Suggested skeleton:

```markdown
# company-plugin

Company-wide guardrails for full-stack React/Next.js + Node/NestJS + Prisma/Postgres + AWS projects.

## Target stack

- React / Next.js
- Node.js / NestJS / TypeScript
- Prisma + PostgreSQL
- AWS
- optional React Native mobile apps

## Included skills

Every skill assumes the shared `_baseline` for TypeScript strictness, security-by-default, observability, testing, accessibility, performance, and resilience. Skills only document what they add on top.

[copy the categorized skill list from the old root README]

## Included hooks

- SessionStart logger
- PostToolUse logger for Write/Edit
- SessionStart + UserPromptSubmit skills-roster injector

## Included MCP template

`plugin/.mcp.json` registers placeholder MCP servers (github, ci-cd, observability, cloud, database). Replace the placeholder `echo` commands with your real MCP server commands before relying on them. (Tracked as a follow-up — see repo issues.)

## External plugin dependencies

[copy from the old root README]

## Local test

```bash
claude --plugin-dir /absolute/path/to/global-plugin/plugin
```

Inside Claude Code:
- `/help`
- `/mcp`
- `/company-plugin:architecture-guard`
- `/company-plugin:frontend-implementation-guard`

For React Native projects, also use:
- `/company-plugin:mobile-implementation-guard`

## New project setup

```bash
plugin/scripts/bootstrap-new-project.sh /path/to/new-project
```

Then replace the placeholder MCP commands in `<new-project>/.mcp.json`.
```

#### Step 3: Update `docs/installation.md`

Apply the same path/namespace fixes as Step 2:

- Lines 28–32: replace the `claude --plugin-dir` path with `/absolute/path/to/global-plugin/plugin`.
- Lines 36–38, 42: replace every `/company-superpowers-plugin:` with `/company-plugin:`.
- Lines 45–47: change template references from `templates/project/.claude/...` to `plugin/templates/project/.claude/...`.

Optional: also update lines 14–22 to drop dependencies that aren't actually declared in `plugin/.claude-plugin/plugin.json` (currently lists `postman` and `aikido-security` which aren't in the manifest's `dependencies` array).

#### Step 4: Verify the docs build clean

Run: `wc -l README.md plugin/README.md docs/installation.md`
Expected: every file > 0 lines and no obvious truncation.

#### Step 5: Commit

```bash
git add README.md plugin/README.md docs/installation.md
git commit -m "docs: split README into maintainer (root) + consumer (plugin), fix paths and slash-command namespace"
```

---

### Task 10: Add a maintainer-facing `CLAUDE.md` at repo root

**Files:**
- Create: `CLAUDE.md` (root)

- [ ] **Step 1: Write the file**

Content (target: ≤ 100 lines):

````markdown
# CLAUDE.md

This file gives guidance to Claude Code when working in this repository.

## Status

Source repo for `company-plugin`. Consumer-facing plugin runtime lives in `plugin/`. Repo root holds maintainer/build infra only.

## Repo modes — maintainer vs consumer audit

This repo has TWO modes with opposite source-of-truth rules.

**Maintainer mode** (writing skills/hooks, refactoring scripts, planning a release): trust everything in the repo — root `README.md`, `docs/`, `scripts/`, `plugin/`, the husky/vitest harness. They are the design history and the verification harness.

**Consumer-audit mode** ("will this work after install?"): trust ONLY `plugin/`. Ignore root `README.md`, `docs/`, `scripts/verify/`, `.husky/`, this `CLAUDE.md` — consumers never see them. The plugin's behavior is whatever its code under `plugin/` does, period.

If you can't tell which mode you're in, ask: "is this question about how we ship the next release, or about what consumers experience right now?" — the answer picks the rules.

## Repo layout

```
/                                # source repo root
├── docs/                        # design notes, plans, specs, audits, workflows
├── scripts/                     # skill-verifier (TypeScript) — dev-only
├── .husky/pre-commit            # runs `pnpm verify` on staged SKILL.md files
├── package.json, pnpm-lock.yaml # vitest, husky, tsx (dev deps only)
└── plugin/                      # PLUGIN RUNTIME — what consumers install
    ├── .claude-plugin/plugin.json
    ├── hooks/, skills/, .mcp.json
    └── scripts/, templates/     # consumer-onboarding tools
```

## Skill-loading discipline (ALWAYS — non-negotiable)

When working in this repo, load every relevant skill before doing anything substantive — breadth-first and exhaustive, not just the first match. Non-negotiable set: every `plugin-dev:*` skill, `anthropic-tooling-dev`, `simplify`, and the `superpowers:*` skills matching the task (`brainstorming` before any creative work, `writing-plans`/`executing-plans` for multi-step work, `test-driven-development` for any code change, `verification-before-completion` before any "done" claim).

Subagents do NOT inherit your skills, CLAUDE.md, or memory. Every subagent prompt MUST: (a) list every relevant skill by exact name as a checklist task the subagent invokes via the `Skill` tool at session start; (b) repeat this skill-loading discipline rule verbatim so it propagates recursively; (c) NOT re-type skill bodies — list names only.

Subagent artifacts MUST start with YAML frontmatter listing every skill invoked:

```yaml
---
skills_invoked:
  - skill-name-1
  - skill-name-2
---
```

## Plan and spec files

Plans live at `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`. Specs live at `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`. Existing convention; don't change it.

## #1 design concern — stale specs poisoning agents

An agent reads an old plan/spec and treats it as current truth. Prefer mechanisms that make staleness structurally impossible or loudly visible over mechanisms that ask the agent to be careful.
````

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add maintainer-facing CLAUDE.md describing two-mode rule and repo layout"
```

---

### Task 11: End-to-end smoke test the plugin via `claude --plugin-dir`

**Files:** none modified — verification only.

- [ ] **Step 1: Launch a Claude Code session pointing at the new plugin path**

Run from a *different* working directory (NOT inside this repo, to avoid Claude auto-loading the maintainer's `CLAUDE.md`). Use a scratch dir:

```bash
mkdir -p /tmp/plugin-smoke && cd /tmp/plugin-smoke
claude --plugin-dir /c/Users/logan/Desktop/projects/org/global-plugin/plugin
```

- [ ] **Step 2: Inside the session, verify components load**

Run these slash commands:

- `/help` — should list `company-plugin` skills.
- `/agents` — should list **no** company-plugin agents (the security-reviewer was deleted).
- `/mcp` — should list 5 MCP servers (placeholder `echo` commands; expected to "work" trivially).

**Specifically watch for:** the `inject-skills-reminder.mjs` hook firing at SessionStart and injecting the company-plugin skills roster as a system-reminder. The roster should list every consumer-facing skill (28 dirs minus `_baseline` which is excluded by the leading-underscore filter).

- [ ] **Step 3: Trigger a skill explicitly**

Type: `/company-plugin:architecture-guard`
Expected: skill loads and presents its content.

- [ ] **Step 4: Verify the post-tool-use logger hook**

Have Claude do a Write or Edit tool call (e.g., "create a file called test.txt with contents 'hi'"), then check the cwd:

```bash
cat .claude/plugin-hook.log
```

Expected: lines like `session_start 2026-04-27T...` and `post_tool_use 2026-04-27T...`. Confirms hooks fire and `${CLAUDE_PLUGIN_ROOT}` resolves correctly.

- [ ] **Step 5: Clean up**

```bash
rm -rf /tmp/plugin-smoke
```

- [ ] **Step 6: No commit**

Verification only.

---

### Task 12: Final verification

**Files:** none modified — verification only.

- [ ] **Step 1: Run the full test suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 2: Run the verifier across every consumer skill**

```bash
for f in plugin/skills/*/SKILL.md; do
  pnpm verify "$f" || echo "FAILED: $f"
done
```

Expected: any failures match the pre-existing baseline. Refactor should not introduce new failures.

- [ ] **Step 3: Confirm working tree is clean**

```bash
git status --short
```

Expected: clean — every committed change landed.

- [ ] **Step 4: Confirm no `agents/` directory at root or in plugin**

```bash
ls agents 2>&1 | grep -i 'no such' && echo "OK: root agents/ gone"
ls plugin/agents 2>&1 | grep -i 'no such' && echo "OK: plugin/agents/ never created"
```

Expected: both lines print `OK: ...`.

- [ ] **Step 5: No commit**

Verification only — refactor is complete.

---

### Task 13: File follow-up issues for known pre-existing problems

**Files:** none modified — issue tracker entries only. (If your team doesn't use a tracker, capture them in a `docs/followups.md` instead.)

- [ ] **Step 1: File issue: add `.claude-plugin/marketplace.json` for marketplace publishing**

Title: `Add marketplace.json so company-plugin can be installed via marketplace`
Summary: `board-plugin` publishes via a `.claude-plugin/marketplace.json` at repo root with a `git-subdir` source pointing at `plugin/`. `global-plugin` doesn't have one yet. Adding it requires the GitHub owner/URL the plugin will be published from, plus an owner email. Mirror the structure used in `/c/Users/logan/Desktop/projects/org/board-plugin/.claude-plugin/marketplace.json`.

- [ ] **Step 2: File issue: `.mcp.json` placeholders are non-functional**

Title: `company-plugin .mcp.json registers 5 MCP servers as 'echo' placeholders`
Summary: `plugin/.mcp.json` lists five servers (github, ci-cd, observability, cloud, database) with `"command": "echo"`. Either replace with real commands, replace with empty `mcpServers: {}` and document setup in the consumer README, or document why placeholders are intentional.

- [ ] **Step 3: File issue: `skill-verification` skill instructs consumers to run `pnpm verify`, which only exists in the source repo**

Title: `skill-verification fast-mode CLI is unavailable to plugin consumers`
Summary: `plugin/skills/skill-verification/SKILL.md` documents `pnpm verify skills/<name>/SKILL.md` as the fast-mode invocation. After install via marketplace, consumers don't have `package.json`/`tsx`/the verify TS sources. Either ship the verifier inside the plugin and rewrite as a Bash-only entry point, or update the skill text to acknowledge fast-mode is a maintainer-only path with a manual checklist for consumers.

- [ ] **Step 4: No commit**

Tracker entries only.

---

## Self-review

(Per `superpowers:writing-plans` self-review.)

- **Spec coverage:** every existing repo entry in the disposition matrix maps to a task or is explicitly "Stays" (no task needed). Every "MOVED"/"Modify"/"Create"/"Delete" entry has a corresponding task.
- **Placeholder scan:** no TBD/TODO. The word "placeholder" only appears in literal contexts describing the existing broken `.mcp.json` content.
- **Path consistency:** every reference to the new plugin path uses `plugin/` (singular). Every reference to skill paths uses `plugin/skills/<name>/SKILL.md`. Every reference to the husky grep pattern uses `^plugin/skills/[^/]+/SKILL\.md$`.
- **Type/command consistency:** `pnpm verify`, `git mv`, `BASH_SOURCE`-relative path math each appear in exactly one form.

## Risks and rollback

- **Risk:** A consumer or maintainer using `claude --plugin-dir <repo>` (the old path with no subdir) will silently fail to find auto-discovered components — the manifest is no longer at the path they pointed at.
  - **Mitigation:** Document the new path in both READMEs before merging. If multiple maintainers/users have local install configs, communicate the change in the merge announcement.
- **Risk:** The husky grep change (Task 7) is the only behavior-affecting line in the refactor. A mistake silently turns the pre-commit hook into a no-op.
  - **Mitigation:** Task 7 step 2 explicitly smoke-tests the hook firing. Don't skip it.
- **Risk:** `inject-skills-reminder.mjs` silently produces an empty roster if `${CLAUDE_PLUGIN_ROOT}/skills/` doesn't exist (lines 12–15: `existsSync` gate then `process.stdout.write("{}")`). If a move misses `skills/`, SessionStart context is just empty — easy to overlook.
  - **Mitigation:** Task 11 step 2 verifies the roster appears in the SessionStart system-reminder.
- **Risk:** Deleting the security-reviewer agent removes a documented capability. If anything in CI / wrappers / personal config invokes it, that breaks.
  - **Mitigation:** Task 3 step 3 greps the repo for any other reference. The dead `settings.json` is the only thing that comes up.
- **Rollback:** Every task is one or more `git mv` / `git rm` + commit. Revert is `git revert <hash>` per task; alternatively `git reset --hard` to the pre-refactor commit. Because moves preserve history (per `git mv`), the revert is mechanical.

## What this plan deliberately does NOT do

- Add `.claude-plugin/marketplace.json` — needs a real GitHub URL; tracked as a follow-up.
- Fix the `.mcp.json` echo-placeholder commands — pre-existing, behavior change, follow-up.
- Make `skill-verification`'s fast-mode CLI available to consumers — pre-existing, design work, follow-up.
- Rename the plugin (manifest's `name: company-plugin` is already correct; only the docs were stale).
- Add `tests/`, `evals/`, or the `plans/000-rebuild` patterns from `board-plugin`. Out of scope; file a separate plan if desired.
- Add a `commands/` directory. The plugin doesn't use it; user-invocable surface is exposed through skills, which is the modern pattern.

## Done criteria

- `git mv` history is preserved for every moved file.
- `pnpm test` passes.
- `pnpm verify plugin/skills/<name>/SKILL.md` works for at least one skill.
- `claude --plugin-dir <repo>/plugin` starts a session, lists components via `/help`/`/agents`/`/mcp`, fires SessionStart and PostToolUse hooks, and the skills-roster system-message appears with a non-empty roster.
- Husky pre-commit fires on staged `plugin/skills/<name>/SKILL.md` and remains a no-op for unrelated changes.
- Root README is maintainer-facing; `plugin/README.md` is consumer-facing; `docs/installation.md` paths and slash-command namespace are corrected.
- `agents/security-reviewer.md`, root `agents/` directory, and root `settings.json` no longer exist.
- Three follow-up issues filed (marketplace.json, broken .mcp.json, pnpm-verify-only-in-source-repo).
