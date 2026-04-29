---
skills_invoked:
  - superpowers:brainstorming
  - superpowers:writing-plans
  - anthropic-tooling-dev
  - simplify
  - plugin-dev:plugin-structure
  - plugin-dev:skill-development
  - plugin-dev:hook-development
  - plugin-dev:mcp-integration
---

# `org-ai-tooling` Rename Implementation Plan

> **STATUS: DEFERRED** — paused on 2026-04-29 to land the broader baseline-standards cleanup first ([`docs/superpowers/specs/2026-04-29-baseline-standards-cleanup-design.md`](../specs/2026-04-29-baseline-standards-cleanup-design.md)). The plan's task list is largely still valid, but Task 5 (plugin/README.md catalog row), Task 6 (root CLAUDE.md non-negotiable list), and the cross-reference grep expectations in Task 8 will shift after the cleanup lands. Re-derive against the new state when re-engaging.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Skill-loading discipline (non-negotiable for any subagent dispatched against this plan):** Before any substantive work, invoke EVERY relevant skill via the `Skill` tool — breadth-first, exhaustive. Required set when working on this repo: `anthropic-tooling-dev`, every `plugin-dev:*` skill, `claude-md-management:claude-md-improver` (when touching `CLAUDE.md`), `simplify`, plus matching `superpowers:*` skills. Each subagent has its own context and must independently invoke the full set. Subagent artifacts MUST start with the YAML frontmatter `skills_invoked:` block listing every skill loaded. Log "Skills loaded: [list]" as the first line of substantive work.

**Goal:** Rename `anthropic-tooling-dev` → `org-ai-tooling`, rewrite its description in verifier-compliant `Use when …` form so it triggers only on Claude Code tooling work, and restructure the SKILL.md body to satisfy the verifier's four-section domain-skill shape so verification goes RED → GREEN.

**Architecture:** Single atomic commit per spec §7. Two physical copies — `plugin/skills/org-ai-tooling/` (ships to consumers) and `.claude/skills/org-ai-tooling/` (project-local maintainer copy because the plugin is not dogfooded on itself per repo `CLAUDE.md`) — move and update together with identical content. Reference content (decision framework, primitive cheat-sheet, key flags, key commands, common-mistakes) moves to `references/patterns.md` to keep the lean SKILL.md ≤2,000 words. Cross-references in `plugin/README.md`, root `CLAUDE.md`, and `docs/followups.md` update; historical artifacts under `docs/superpowers/{audits,specs,plans}/` stay frozen per the project's no-historical-edits convention.

**Tech Stack:** Markdown + git + pnpm verify (TypeScript skill verifier under `scripts/verify/`).

**Spec:** [`docs/superpowers/specs/2026-04-29-org-ai-tooling-rename-design.md`](../specs/2026-04-29-org-ai-tooling-rename-design.md).

---

## Pre-flight

### Pre-flight Step 1: Confirm branch state

- [ ] **Step 1: Confirm branch tip and clean working tree**

Run:

```bash
git status && git log --oneline -1
```

Expected: branch `logan`, working tree clean (or only the spec/plan files unstaged), tip at commit `238f0d2` ("docs(spec): drop baseline-standards reference from org-ai-tooling spec") or later.

If any unrelated edits are unstaged, stash them with `git stash push -m "pre-org-ai-tooling rename"` before continuing.

### Pre-flight Step 2: Confirm parked-state baseline

- [ ] **Step 2: Confirm both `anthropic-tooling-dev` directories exist (sanity check)**

Run:

```bash
ls plugin/skills/anthropic-tooling-dev/SKILL.md && ls .claude/skills/anthropic-tooling-dev/SKILL.md
```

Expected: both files print without error.

If either is missing, stop and investigate — the rename premise is wrong.

### Pre-flight Step 3: Confirm verifier RED reproduces

- [ ] **Step 3: Confirm verifier RED on the current skill**

Run:

```bash
pnpm verify plugin/skills/anthropic-tooling-dev/SKILL.md 2>&1 | tail -30
```

Expected: `Verdict: RED` with FAIL findings on missing `Core rules`, `Red flags`, `Review checklist`, `Interactions with other skills` sections, plus CONCERN findings on description not starting with `Use when` and lacking a trigger verb.

This is the baseline this plan flips to GREEN. If it's already GREEN, the plan is moot — stop.

---

## Task 1: Rename both copies of the skill directory

**Files:**
- Move: `plugin/skills/anthropic-tooling-dev/` → `plugin/skills/org-ai-tooling/`
- Move: `.claude/skills/anthropic-tooling-dev/` → `.claude/skills/org-ai-tooling/`

- [ ] **Step 1: Rename plugin/ copy**

Run:

```bash
git mv plugin/skills/anthropic-tooling-dev plugin/skills/org-ai-tooling
```

Expected: no output (success).

- [ ] **Step 2: Rename .claude/ copy**

Run:

```bash
git mv .claude/skills/anthropic-tooling-dev .claude/skills/org-ai-tooling
```

Expected: no output (success).

- [ ] **Step 3: Verify both moves are tracked as renames**

Run:

```bash
git status
```

Expected: two `renamed:` lines (one per copy), both showing `R100` (100% rename — content unchanged at this point).

No commit yet — this is part of the single atomic commit at Task 9.

---

## Task 2: Rewrite plugin/skills/org-ai-tooling/SKILL.md

**Files:**
- Modify: `plugin/skills/org-ai-tooling/SKILL.md` (full content replacement)

- [ ] **Step 1: Overwrite SKILL.md with the restructured content**

Write this exact content to `plugin/skills/org-ai-tooling/SKILL.md`, replacing the existing file entirely:

````markdown
---
name: org-ai-tooling
description: Use when editing Claude Code tooling files (SKILL.md, hooks.json, agents/*.md, .mcp.json, .claude-plugin/plugin.json, CLAUDE.md) or designing/auditing plugins, skills, hooks, subagents, MCP servers, or Agent SDK applications. Do NOT use for app code (React components, NestJS services, Prisma schemas) — those have dedicated guard skills. Covers harness primitives, plugin design, skill authoring, hook patterns, MCP integration, Agent SDK usage. TRIGGER when editing files matching the paths above, or when the task mentions "claude code", "agent SDK", "MCP server", "subagent", "plugin design", "skill authoring", or "hook". SKIP when writing app/feature code in a consumer project — those route to the matching guard skill (frontend-implementation-guard, nestjs-service-boundary-guard, prisma-data-access-guard, etc.).
version: 1.0.0
---

# Org AI Tooling

## Purpose & scope

Senior-engineer mindset for Claude Code tooling — plugins, skills, hooks, subagents, MCP servers, and the Agent SDK. The harness is the product. Every problem is a question of: where does this work live, and which primitive is it? Activates on tooling-file edits and tooling-design tasks. Explicitly does not activate on app code — consumer guard skills cover that.

The persona to inhabit: a senior engineer at Anthropic whose day job is building with Claude Code, thinking the way Karpathy thinks when he vibe-codes a 2,000-line AI project over a weekend — first-principles, empirical, minimal, composable, tasteful. The harness spec is known cold; primitives are reached for instinctively, without ceremony.

## Core rules

1. **Think in primitives, not in code.** Before writing logic, classify the work and pick the primitive (skill / subagent / hook / MCP / plugin / CLAUDE.md / slash command / Agent SDK). — *Why:* using the wrong primitive is the #1 source of bad AI tooling. A wrapper script for something the harness already does is dead weight.

2. **Push determinism down, keep judgment up.** Mechanical work (formatting, linting, schema validation, blocking unsafe commands) goes in hooks or scripts; taste-driven work (naming, structure, what to ship) stays with the model. — *Why:* prompts that enforce mechanical rules are a code smell — that's what `PreToolUse` hooks are for.

3. **Treat context as the scarcest resource.** Use subagents (`Agent` tool, `context: fork`) for heavy research; progressive disclosure (lean `SKILL.md` + `references/`); prompt caching on stable prefixes; `@path` imports over pasting; `--bare` for hermetic CI runs; `/compact` before it runs itself; `/clear` when the task changes entirely. — *Why:* every token spent on noise is a token not spent on signal.

4. **Write evals before tuning.** For any non-trivial agent: 5–20 input/output pairs, run them, iterate, *then* ship. `claude -p "query" --output-format json` + a shell loop is a working eval harness in 20 lines. — *Why:* prompt quality without evals is cargo-culting.

5. **Vibe-code, then harden.** Ship the 80% prototype end-to-end before designing the "proper" abstraction. Run the thing, read the transcript, see where it struggles, fix that. — *Why:* premature architecture kills more AI projects than sloppy code.

6. **Compose over build.** Before writing a new primitive, check `superpowers:*`, existing MCP servers, and bundled skills (`/simplify`, `/batch`, `/loop`, `/schedule`). 80% of the time one already exists. — *Why:* duplicating harness features is the most expensive form of NIH.

7. **Respect the harness contract.** Use the documented shapes: hook I/O JSON envelopes, skill frontmatter semantics (`allowed-tools`, `disable-model-invocation`, `context: fork`, `paths`, `model`, `effort`), permission rule precedence (`deny > ask > allow`), settings precedence (managed > CLI > project local > project > user). — *Why:* the spec is cheaper to learn once than to fight repeatedly.

For the decision framework (which primitive to pick), the full primitive cheat-sheet, key flags, and key commands, see `references/patterns.md`.

## Red flags

You are NOT in this mindset when —

| Thought | Reality |
|---|---|
| "I'll just write a shell wrapper around `claude`." | You're rebuilding a harness feature. Check flags / hooks / MCP first. |
| "I'll stuff this reference doc into the system prompt." | Use a skill with progressive disclosure or `@import`. |
| "Tell the model to always run prettier after edits." | That's a `PostToolUse` hook. |
| "Paste the whole file into context." | Use `@path`, a subagent with `context: fork`, or an MCP resource. |
| "Ship without an eval." | You're guessing. Write 5 test cases first. |
| "Design the framework before running the agent once." | Vibe-code end-to-end first, *then* abstract. |
| "Add another instruction to CLAUDE.md (12th time)." | CLAUDE.md is for invariants. Repeated patterns → skill. |
| "Spin up a new subagent for a one-shot task." | Subagents are for reuse. One-shot → inline, or `general-purpose`. |
| "Skip prompt caching on a repeat workflow." | You're paying 10× for nothing. |
| "Long natural-language rule when a matcher would do." | Hook matcher syntax (`"Bash(git *)"`) is precise, cheap, and deterministic. |
| "Don't read the tool-call transcript when debugging." | Flying blind. The transcript tells you exactly what the model saw. |

## Interactions with other skills

- **Owns:** harness-primitive selection (skill vs hook vs subagent vs MCP vs CLAUDE.md vs slash command vs Agent SDK), plugin / skill / hook / agent / MCP authoring guidance, Agent SDK usage patterns.
- **Hands off to:** `superpowers:brainstorming` for design exploration before authoring; `superpowers:writing-plans` for multi-step implementation; `simplify` for second-draft trim; the `plugin-dev:*` family (`plugin-structure`, `skill-development`, `hook-development`, `command-development`, `agent-development`, `mcp-integration`, `plugin-settings`, `create-plugin`) for primitive-specific deep-dives.
- **Does not duplicate:** consumer-side guard skills (`frontend-implementation-guard`, `nestjs-service-boundary-guard`, `prisma-data-access-guard`, `architecture-guard`, etc.) — those guard *app* code; this guards *tooling* code.

## Review checklist

When invoked to audit a Claude Code tooling artifact (skill, hook, plugin, subagent, MCP server, Agent SDK app), produce a markdown report with these four sections.

### Summary

One line: pass / concerns / blocking issues. Name the reviewed surface and the overall verdict in a single sentence so a reader can scan without reading further.

### Findings

One bullet per finding, in this shape:

- `<file>:<line>` — **severity** (blocker | concern | info) — *category* (one of: wrong-primitive | context-burn | missing-eval | premature-architecture | unused-composition | spec-violation | hardcoded-path | uneval'd-prompt | hook-missing) — what is wrong, recommended fix.

### Safer alternative

State the lowest-blast-radius path that still achieves the change's goal, prescriptively. For tooling work, this almost always means picking a different primitive (e.g., "use a `PreToolUse` hook instead of a prompt instruction") or composing an existing one (e.g., "wire `superpowers:simplify` instead of writing a new code-review skill").

### Checklist coverage

Mark each Core rule as PASS / CONCERN / NOT APPLICABLE with a one-line justification.

- Rule 1 — Think in primitives: PASS / CONCERN / NOT APPLICABLE.
- Rule 2 — Push determinism down: PASS / CONCERN / NOT APPLICABLE.
- Rule 3 — Treat context as scarce: PASS / CONCERN / NOT APPLICABLE.
- Rule 4 — Write evals before tuning: PASS / CONCERN / NOT APPLICABLE.
- Rule 5 — Vibe-code then harden: PASS / CONCERN / NOT APPLICABLE.
- Rule 6 — Compose over build: PASS / CONCERN / NOT APPLICABLE.
- Rule 7 — Respect the harness contract: PASS / CONCERN / NOT APPLICABLE.

## What "done" looks like

A good Claude Code tooling deliverable:

1. Uses the right primitive for each piece of work.
2. Fits in the context budget (lean skills, references for heavy content, subagents for research, caching on repeat prompts).
3. Has at least one concrete eval or end-to-end usage example.
4. Composes cleanly with existing primitives — `superpowers:*`, bundled skills, MCP servers, built-in commands.
5. Is dogfoodable: you'd use it yourself tomorrow.
6. Has been run end-to-end at least once before being called done.

If it doesn't hit all six, it's a draft. Keep iterating.

For the full primitive decision framework, primitive table, key flags, key commands, and common-mistake catalog, see `references/patterns.md`.
````

- [ ] **Step 2: Verify the file was written correctly**

Run:

```bash
head -3 plugin/skills/org-ai-tooling/SKILL.md && wc -w plugin/skills/org-ai-tooling/SKILL.md
```

Expected:
- Line 1: `---`
- Line 2: `name: org-ai-tooling`
- Line 3: starts with `description: Use when editing Claude Code tooling files`
- Word count: 800–1500 words (well under the 2,000-word cap from `templates/new-skill-template.md`).

If word count exceeds 2,000, content needs trimming before continuing — but with the reference-style content moved to `references/patterns.md` in Task 3, the count should land well under.

---

## Task 3: Create plugin/skills/org-ai-tooling/references/patterns.md

**Files:**
- Create: `plugin/skills/org-ai-tooling/references/patterns.md`

- [ ] **Step 1: Create the references/ directory**

Run:

```bash
mkdir -p plugin/skills/org-ai-tooling/references
```

Expected: no output (directory created or already exists).

- [ ] **Step 2: Write the patterns.md file**

Write this exact content to `plugin/skills/org-ai-tooling/references/patterns.md`:

````markdown
# Org AI Tooling — Patterns and References

Deep-dive content moved out of the lean SKILL.md so the trigger description stays focused. Loaded only when needed.

## Decision framework

Pick the primitive by what you're trying to do:

```
What are you trying to do?
├─ Give the model reusable knowledge / procedure       → Skill
├─ Run a specialized task in isolation                  → Subagent
├─ Enforce a deterministic rule on every tool call      → Hook
├─ Expose a stateful tool + resource surface            → MCP server
├─ Bundle the above for distribution                    → Plugin
├─ Encode project-wide invariants                       → CLAUDE.md
├─ Automate a recurring / scheduled task                → /loop (in-session) or /schedule (cloud)
├─ Run Claude in CI / headless                          → claude -p --bare --output-format json
└─ Add a user-invoked entrypoint                        → Slash command / skill with description
```

**Tiebreaker:** the primitive closest to where the information naturally lives wins. Permissions belong in settings. Formatters belong in hooks. Domain knowledge belongs in skills. Stateful integrations belong in MCP. Project conventions belong in CLAUDE.md.

## Primitive cheat-sheet

| Primitive | Lives in | Invoked by | Good for |
|-----------|----------|------------|----------|
| Skill | `.claude/skills/<name>/SKILL.md` | `/name` or auto via description | Procedures, patterns, reference |
| Subagent | `.claude/agents/<name>.md` | Auto-delegation or `Agent` tool | Isolated specialized tasks |
| Hook | `settings.json` → `hooks` | Tool lifecycle events | Deterministic enforcement |
| MCP server | `.mcp.json` | Auto-registered tools | Stateful tool surfaces |
| Plugin | `.claude-plugin/plugin.json` | `/plugin install` | Distributing bundles |
| CLAUDE.md | `./CLAUDE.md`, `~/.claude/CLAUDE.md` | Loaded every session | Persistent invariants |
| Slash command | `.claude/commands/<name>.md` or skill | `/name` | User-typed entrypoints |
| Headless SDK | `claude -p [--bare] [--output-format json]` | Shell / CI | Automation, evals, batch |

## Primitives — extended notes

### Skill

Reusable instructions / procedure / reference loaded on demand. Lives in `.claude/skills/<name>/SKILL.md` (or `~/.claude/skills/`). Use for: workflows, patterns, domain knowledge, reference material. Frontmatter controls discovery (`description`), scope (`allowed-tools`, `paths`), and isolation (`context: fork`, `agent: Explore`).

### Subagent

Isolated context window with a custom system prompt. Lives in `.claude/agents/<name>.md`. Use for: parallel work, research that would bloat main context, specialized personas. Dispatch via the `Agent` tool and return a summary, not a transcript.

### Hook

Deterministic shell / prompt / agent / HTTP handler on tool lifecycle events (`PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `Stop`, `SubagentStop`, `Notification`, `SessionStart`, `PreCompact`). Use for: autoformatting, validation, blocking unsafe commands, enforcing rules the model should not have to remember. Hook I/O is JSON on stdin/stdout with `pass` / `skipTool` / `modifyToolInput` / `modifyToolResult`. Matchers support `"Bash(npm *)"` / `"Write|Edit"` syntax.

### MCP server

Stateful tool + resource surface over stdio / SSE / HTTP. Registered via `.mcp.json`. Use for: integrations (GitHub, DB, custom APIs) that multiple agents or sessions will reuse.

### Plugin

Bundle of skills / agents / commands / hooks / MCP distributed via a marketplace (`.claude-plugin/plugin.json`). Use for: packaging a coherent capability for other humans.

### CLAUDE.md

Persistent instructions loaded every session. Project (`./CLAUDE.md`), user (`~/.claude/CLAUDE.md`), enterprise (managed). Use for: invariants, architecture notes, conventions — not one-off task state.

### Slash command

User-typed entrypoint; a skill with a good description or a command file in `.claude/commands/`.

### Agent SDK / headless CLI

`claude -p "query" [--bare] [--output-format json|stream-json]`. Use for: CI agents, scripts, evals, batch work. `--bare` skips auto-discovery for fast, hermetic runs.

## Frontmatter and contract details

- **Skill frontmatter** has real semantics: `allowed-tools`, `disable-model-invocation`, `user-invocable`, `context: fork`, `agent`, `paths`, `model`, `effort`, scoped `hooks`. Shell injection via backtick command substitution in template strings runs *before* the model sees the prompt.
- **Permission rules** are `deny > ask > allow`, first match wins, syntax `Tool(specifier)` with glob / domain / prefix support. Arrays merge across scopes.
- **Settings precedence**: managed > CLI args > `.claude/settings.local.json` > `.claude/settings.json` > `~/.claude/settings.json`. Know where a setting needs to live.
- **Subagent frontmatter**: `name`, `description` (drives auto-delegation), `tools`, `model`, `effort`, `permission-mode`, `skills` (preload), `persistent-memory`.

## Key flags

`-p` / `--print` · `--bare` · `-c` / `--continue` · `-r <id>` / `--resume` · `-w <name>` / `--worktree` · `--output-format json|stream-json` · `--permission-mode plan|acceptEdits|auto|bypassPermissions` · `--allowedTools` · `--max-turns` · `--max-budget-usd` · `--model` · `--effort` · `--append-system-prompt[-file]` · `--mcp-config` · `--settings` · `--plugin-dir` · `--from-pr` · `--include-partial-messages` · `--include-hook-events`

## Key commands

`/plan` · `/clear` · `/compact` · `/memory` · `/status` · `/permissions` · `/hooks` · `/mcp` · `/agents` · `/loop` · `/schedule` · `/simplify` · `/debug` · `/review` · `/batch` · `/find-skills` · `/superpowers:*`

## Common mistakes

- **Treating skills like docs.** Skills are instructions *to the model* about what to do. Trigger-focused, third-person, imperative — not a tutorial for a human.
- **Over-scoping the skill description.** If the description summarizes the workflow, the model follows the description and skips the body. Description = *when to trigger*. Body = *what to do*.
- **Forgetting `context: fork`.** A skill that does heavy research should fork so it does not burn main context.
- **Hardcoding paths in skills.** Use `${CLAUDE_PLUGIN_ROOT}`, `${BASH_SOURCE[0]}`-derived paths, or relative imports.
- **Building an MCP server when a Bash tool would do.** MCP has weight (process, transport, schema). A `Bash(mycli *)` permission rule is often enough.
- **Shipping without `/simplify`.** The second draft is usually half the size.
- **Not testing the hook.** Hooks run on real tool calls. A broken `PreToolUse` hook can brick a session. Test with a trivial trigger first.
- **Missing `persistent-memory` on long-lived agents.** If a subagent should remember across invocations, set it explicitly.
- **Forgetting that permissions merge across scopes.** A deny rule in `~/.claude/settings.json` still wins over an allow in the project.
````

- [ ] **Step 3: Verify file was written**

Run:

```bash
head -1 plugin/skills/org-ai-tooling/references/patterns.md && wc -w plugin/skills/org-ai-tooling/references/patterns.md
```

Expected:
- Line 1: `# Org AI Tooling — Patterns and References`
- Word count: 700–900 words.

---

## Task 4: Mirror to the .claude/skills/ copy

**Files:**
- Modify: `.claude/skills/org-ai-tooling/SKILL.md` (overwrite with plugin/ copy)
- Create: `.claude/skills/org-ai-tooling/references/patterns.md`

The two copies are intentional duplicates per repo `CLAUDE.md`'s no-dogfooding rule. Identity is enforced by copying.

- [ ] **Step 1: Overwrite the .claude/ SKILL.md with the plugin/ version**

Run:

```bash
cp plugin/skills/org-ai-tooling/SKILL.md .claude/skills/org-ai-tooling/SKILL.md
```

Expected: no output (success).

- [ ] **Step 2: Create references/ directory and copy patterns.md**

Run:

```bash
mkdir -p .claude/skills/org-ai-tooling/references && cp plugin/skills/org-ai-tooling/references/patterns.md .claude/skills/org-ai-tooling/references/patterns.md
```

Expected: no output (success).

- [ ] **Step 3: Verify identity (modulo line endings)**

Run:

```bash
diff plugin/skills/org-ai-tooling/SKILL.md .claude/skills/org-ai-tooling/SKILL.md && echo IDENTICAL || echo "differs — investigate"
```

Expected: `IDENTICAL` (or differences only in line endings on Windows — git's `core.autocrlf` may rewrite line endings on the next git operation, which is fine).

Run:

```bash
diff plugin/skills/org-ai-tooling/references/patterns.md .claude/skills/org-ai-tooling/references/patterns.md && echo IDENTICAL || echo "differs"
```

Expected: `IDENTICAL`.

---

## Task 5: Update plugin/README.md catalog row

**Files:**
- Modify: `plugin/README.md` (catalog row L143–147)

The row currently reads (per spec §6.2):

```html
<tr style="background-color: rgba(105, 88, 103, 0.29);">
<td>Maintainer / experimental</td>
<td><code>anthropic-tooling-dev</code></td>
<td>Guidance for Claude Code harness work: plugins, skills, hooks, agents, MCP, Agent SDK.</td>
</tr>
```

- [ ] **Step 1: Replace the catalog row**

Use the `Edit` tool on `plugin/README.md` to replace:

```html
<td><code>anthropic-tooling-dev</code></td>
<td>Guidance for Claude Code harness work: plugins, skills, hooks, agents, MCP, Agent SDK.</td>
```

with:

```html
<td><code>org-ai-tooling</code></td>
<td>Senior-engineer mindset for Claude Code tooling: harness-primitive selection, plugin / skill / hook / agent / MCP authoring, Agent SDK usage.</td>
```

The "Maintainer / experimental" cell stays as-is. The description text is updated to reflect the rename (and the "(placement under review post-0.4.0)" caveat is removed since this rename resolves followups item #5).

- [ ] **Step 2: Verify the edit**

Run:

```bash
grep -n "org-ai-tooling\|anthropic-tooling-dev" plugin/README.md
```

Expected: one hit only — the new `<code>org-ai-tooling</code>` line. No `anthropic-tooling-dev` hits.

---

## Task 6: Update root CLAUDE.md non-negotiable list

**Files:**
- Modify: `CLAUDE.md` (repo root) — "Skill-loading discipline" non-negotiable list

- [ ] **Step 1: Locate the reference**

Run:

```bash
grep -n "anthropic-tooling-dev" CLAUDE.md
```

Expected: one hit, in the non-negotiable skill set.

- [ ] **Step 2: Replace the reference**

Use the `Edit` tool on root `CLAUDE.md` to replace the single occurrence of `anthropic-tooling-dev` with `org-ai-tooling`. Surrounding text (including the bullet shape and any backticks) stays unchanged.

- [ ] **Step 3: Verify**

Run:

```bash
grep -n "anthropic-tooling-dev\|org-ai-tooling" CLAUDE.md
```

Expected: one hit only — `org-ai-tooling`. No `anthropic-tooling-dev` hits.

---

## Task 7: Update docs/followups.md item #5

**Files:**
- Modify: `docs/followups.md` — item #5 (status, title strikethrough, resolution note)

The current item #5 (per spec §5.5 and the file's existing item #3 precedent for resolved items):

```markdown
## 5. `anthropic-tooling-dev` placement decision

**Status:** OPEN. Parked during the 2026-04-28 plugin refactor (spec §4).

**Summary:** `plugin/skills/anthropic-tooling-dev/` is meta-content about Claude Code tooling itself. A consumer's React/NestJS app does not benefit from loading it, but the skill is genuinely useful when working on this repo. Three options under consideration:

- Move to `.claude/skills/anthropic-tooling-dev/` (project-local maintainer skill — same destination as `skill-verification`).
- Move to `templates/anthropic-tooling-dev.md` (treat as reference doc, not a triggering skill).
- Leave in `plugin/skills/` with a Maintainer/experimental caveat in the catalog (current state).

The verifier currently flags this skill as RED (it doesn't follow the four-section Review checklist shape that domain skills do — because it isn't a domain skill). The RED is expected and acknowledged in the 2026-04-28 spec.
```

- [ ] **Step 1: Apply strikethrough + status + resolution note**

Use the `Edit` tool on `docs/followups.md` to replace the block above with:

```markdown
## 5. ~~`anthropic-tooling-dev` placement decision~~

**Status:** RESOLVED in 2026-04-29 (rename + verifier-shape conformance). Implemented per [`docs/superpowers/specs/2026-04-29-org-ai-tooling-rename-design.md`](superpowers/specs/2026-04-29-org-ai-tooling-rename-design.md).

**Resolution:** Skill renamed `anthropic-tooling-dev` → `org-ai-tooling` in both copies (`plugin/skills/org-ai-tooling/`, `.claude/skills/org-ai-tooling/`). Description rewritten in verifier-compliant `Use when …` form with explicit TRIGGER and SKIP clauses so the skill triggers only on Claude Code tooling work, not on consumer app code. Body restructured into the four required domain-skill sections (`Core rules`, `Red flags`, `Review checklist`, `Interactions with other skills`); reference content (decision framework, primitive cheat-sheet, key flags, key commands, common mistakes) moved to `references/patterns.md`. Verifier verdict: RED → GREEN. Cross-references updated in `plugin/README.md` and root `CLAUDE.md`. The skill stays consumer-facing (option (c) from the original three) under the "Maintainer / experimental" subheading. Note: the `## Assumes baseline-standards. Adds:` line was deliberately NOT added to the new skill — see followups item #6 for the broader cross-boundary cleanup.
```

- [ ] **Step 2: Verify**

Run:

```bash
grep -n "anthropic-tooling-dev" docs/followups.md
```

Expected: hits limited to the struck-through title (`~~`anthropic-tooling-dev` placement decision~~`) and the historical "renamed `anthropic-tooling-dev` → …" text in the resolution note. The strikethrough preserves historical search per the item #3 precedent.

---

## Task 8: Verify everything

This is the hard gate before the commit.

- [ ] **Step 1: Run the verifier on the new skill**

Run:

```bash
pnpm verify plugin/skills/org-ai-tooling/SKILL.md
```

Expected:

```
Verification: org-ai-tooling
Mode: fast
Verdict: GREEN
```

with `frontmatter`, `sections`, `review-checklist`, `markers`, `size`, `discoverability` all PASS or with only minor CONCERN notes (no FAIL findings).

If RED:
- Re-read the verifier output's `Findings` block.
- Compare the SKILL.md against `templates/new-skill-template.md` for shape parity.
- Iterate on the SKILL.md content (Task 2) until the verifier returns GREEN. Mirror any change to `.claude/skills/org-ai-tooling/SKILL.md` (Task 4 Step 1).

- [ ] **Step 2: Run the full test suite**

Run:

```bash
pnpm test
```

Expected: all tests pass — same count as the current `logan` tip (46/46 at last check; do not regress).

If failures, investigate. The verifier test suite at `scripts/verify/` does not reference `anthropic-tooling-dev` by name (confirmed in spec §5.5 R1), so failures most likely indicate an unintended regression introduced by the rename.

- [ ] **Step 3: Cross-reference grep — no live references to the old name**

Run:

```bash
git grep "anthropic-tooling-dev"
```

Expected hits, and only these:
- Files under `docs/superpowers/audits/`, `docs/superpowers/specs/`, `docs/superpowers/plans/` (historical artifacts — preserved per the project's "stale specs poisoning agents" design concern).
- `docs/followups.md` — exactly two expected hits: the struck-through item #5 title and the historical mention in the resolution note.

Any hit in `plugin/`, `.claude/skills/`, root `CLAUDE.md`, root `README.md`, or `plugin/README.md` is a defect — go fix the missed reference and re-run.

- [ ] **Step 4: Cross-reference grep — new name lands where expected**

Run:

```bash
git grep "org-ai-tooling"
```

Expected hits, at minimum:
- `plugin/skills/org-ai-tooling/SKILL.md`
- `plugin/skills/org-ai-tooling/references/patterns.md`
- `.claude/skills/org-ai-tooling/SKILL.md`
- `.claude/skills/org-ai-tooling/references/patterns.md`
- `plugin/README.md` (catalog row)
- `CLAUDE.md` (root, non-negotiable list)
- `docs/followups.md` (resolution note)
- `docs/superpowers/specs/2026-04-29-org-ai-tooling-rename-design.md`
- `docs/superpowers/plans/2026-04-29-org-ai-tooling-rename.md`

If any of the first 7 are missing, a Task is incomplete — go back and finish it.

- [ ] **Step 5: Sanity check both copies are still identical**

Run:

```bash
diff plugin/skills/org-ai-tooling/SKILL.md .claude/skills/org-ai-tooling/SKILL.md && echo IDENTICAL || echo "DIVERGED — fix Task 4"
diff plugin/skills/org-ai-tooling/references/patterns.md .claude/skills/org-ai-tooling/references/patterns.md && echo IDENTICAL || echo "DIVERGED — fix Task 4"
```

Expected: `IDENTICAL` for both. (On Windows, line-ending normalization may cause spurious diffs — run `git diff --no-index --ignore-cr-at-eol` if `diff` reports differences but the content looks the same.)

---

## Task 9: Commit

**Files staged:** all changes from Tasks 1–7.

- [ ] **Step 1: Review the staged changes**

Run:

```bash
git status && git diff --stat HEAD
```

Expected `git status` output:
- `renamed: plugin/skills/anthropic-tooling-dev/SKILL.md -> plugin/skills/org-ai-tooling/SKILL.md`
- `renamed: .claude/skills/anthropic-tooling-dev/SKILL.md -> .claude/skills/org-ai-tooling/SKILL.md`
- `modified: plugin/skills/org-ai-tooling/SKILL.md` (post-rename rewrite from Task 2)
- `modified: .claude/skills/org-ai-tooling/SKILL.md` (post-rename rewrite from Task 4)
- `new file: plugin/skills/org-ai-tooling/references/patterns.md`
- `new file: .claude/skills/org-ai-tooling/references/patterns.md`
- `modified: plugin/README.md`
- `modified: CLAUDE.md` (repo root)
- `modified: docs/followups.md`

If any of the rewrite changes show as both rename + modify, that's normal — git records the rename then the content edit as separate hunks under the same diff entry.

- [ ] **Step 2: Stage everything**

Run:

```bash
git add plugin/skills/org-ai-tooling .claude/skills/org-ai-tooling plugin/README.md CLAUDE.md docs/followups.md
```

Expected: no output (success).

- [ ] **Step 3: Commit**

Run:

```bash
git commit -m "$(cat <<'EOF'
refactor(skills): rename anthropic-tooling-dev -> org-ai-tooling, tighten trigger, conform to verifier shape

Closes followups item #5. Single atomic refactor:

- Rename plugin/skills/anthropic-tooling-dev/ -> plugin/skills/org-ai-tooling/
- Rename .claude/skills/anthropic-tooling-dev/ -> .claude/skills/org-ai-tooling/
- Rewrite description in verifier-compliant "Use when ..." form with explicit
  TRIGGER and SKIP clauses so the skill triggers only on Claude Code tooling
  work (SKILL.md / hooks.json / agents / .mcp.json / .claude-plugin/plugin.json /
  CLAUDE.md edits, plus harness-keyword tasks); SKIP on consumer app code.
- Restructure body into the four required domain-skill sections (Core rules,
  Red flags, Review checklist, Interactions with other skills); move reference
  content (decision framework, primitive cheat-sheet, key flags, key commands,
  common mistakes) to references/patterns.md.
- Verifier verdict: RED -> GREEN.
- Update cross-references in plugin/README.md and root CLAUDE.md; mark
  followups item #5 RESOLVED with strikethrough title per item #3 precedent.
- Note: the ## Assumes baseline-standards. Adds: line was deliberately NOT
  added to the new skill — see followups item #6 for the broader
  cross-boundary cleanup.

Spec: docs/superpowers/specs/2026-04-29-org-ai-tooling-rename-design.md
Plan: docs/superpowers/plans/2026-04-29-org-ai-tooling-rename.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected:
- The husky pre-commit hook runs `pnpm verify` against staged `plugin/skills/*/SKILL.md`. It must pass on the new `org-ai-tooling` SKILL.md (already verified in Task 8 Step 1).
- A new commit is created. `git log --oneline -1` shows `<sha> refactor(skills): rename anthropic-tooling-dev -> org-ai-tooling, ...`.

If the pre-commit hook fails, do NOT use `--no-verify`. Re-read the verifier output, fix the SKILL.md, re-stage, and create a NEW commit (per repo convention — never amend across a hook failure).

- [ ] **Step 4: Confirm commit landed**

Run:

```bash
git log --oneline -1 && git status
```

Expected: latest commit is the one just created; working tree clean (or only unrelated unstaged files remain).

- [ ] **Step 5: Do NOT push**

Per the user's session-default workflow, commits stay local until the user explicitly pushes. Stop after Step 4 unless the user has asked for a push.

---

## Task 10: Smoke test (interactive — user-driven)

This task is interactive and runs in a fresh fixture directory outside the source repo per repo `CLAUDE.md`'s test-isolation rule. The agent **does not** run this — the user does, after the commit lands.

- [ ] **Step 1: Create a fresh fixture directory**

User runs (from any non-repo directory):

```bash
SMOKE=$(mktemp -d -t org-ai-tooling-smoke-XXXX)
cd "$SMOKE"
[ ! -e CLAUDE.md ] && [ ! -e .claude ] && echo OK_CLEAN
```

Expected: `OK_CLEAN` printed. If not, the fixture is contaminated; pick a different mktemp prefix or unset whatever ancestor has a `CLAUDE.md`.

- [ ] **Step 2: Start Claude with only this plugin loaded**

User runs:

```bash
claude --plugin-dir /absolute/path/to/global-plugin/plugin
```

(Substitute the actual absolute path — e.g., `C:/Users/logan/Desktop/projects/org/global-plugin/plugin` on Windows.)

- [ ] **Step 3: Verify the skill triggers correctly on tooling prompts**

In-session, send these four prompts and observe whether the `org-ai-tooling` skill triggers (visible in the system reminder when a skill loads, or by asking the model "did you load any skill for this prompt?"):

| # | Prompt | Expected behavior |
|---|---|---|
| 1 | `I'm editing my plugin's SKILL.md and need to add a trigger description` | `org-ai-tooling` **fires** (TRIGGER on path + keyword). |
| 2 | `Help me design an MCP server for our internal API` | `org-ai-tooling` **fires** (TRIGGER on keyword). |
| 3 | `Refactor this React component to use Suspense` | `org-ai-tooling` **does NOT fire** — `frontend-implementation-guard` fires instead (SKIP on app code). |
| 4 | `Add a Prisma migration for the orders table` | `org-ai-tooling` **does NOT fire** — `prisma-data-access-guard` fires instead (SKIP on app code). |

If 1 or 2 doesn't fire, the description's TRIGGER clause is too narrow — go back and broaden the keyword set or paths. If 3 or 4 fires, the SKIP clause isn't strong enough — go back and tighten.

- [ ] **Step 4: Report results**

User reports back which of the four prompts behaved as expected. The plan is complete only when all four pass.

If any prompt mismatches, the rename is mechanically complete but the description needs revision. That revision is a follow-up commit, not a redo of this plan.

---

## Acceptance criteria (from spec §10)

The plan is complete when **all** of the following hold (verified by Task 8 + Task 10):

1. `plugin/skills/org-ai-tooling/SKILL.md` exists with frontmatter `name: org-ai-tooling`. ✓ Task 2.
2. `.claude/skills/org-ai-tooling/SKILL.md` exists with content identical to the plugin/ copy. ✓ Tasks 4 + 8 Step 5.
3. `plugin/skills/anthropic-tooling-dev/` and `.claude/skills/anthropic-tooling-dev/` do not exist. ✓ Task 1.
4. `pnpm verify plugin/skills/org-ai-tooling/SKILL.md` returns `Verdict: GREEN`. ✓ Task 8 Step 1.
5. `pnpm test` passes (no regressions). ✓ Task 8 Step 2.
6. The skill's `description` starts with `Use when`, contains a trigger verb, and includes both a `Do NOT use for` and a `SKIP when` clause. ✓ Task 2 (frontmatter content).
7. SKILL.md contains all four required sections at the correct heading level: `## Core rules`, `## Red flags`, `## Review checklist`, `## Interactions with other skills`. ✓ Task 2 + Task 8 Step 1 (verifier check).
8. SKILL.md is ≤2,000 words; longer reference content lives in `references/patterns.md`. ✓ Task 2 Step 2 + Task 3.
9. Live docs reference `org-ai-tooling`, not `anthropic-tooling-dev`: `plugin/README.md` catalog row, root `CLAUDE.md` non-negotiable list, `docs/followups.md` item #5 status (with strikethrough title preserved per item #3 precedent). Historical artifacts under `docs/superpowers/{audits,specs,plans}/` are unchanged. ✓ Tasks 5 + 6 + 7 + 8 Step 3.
10. Smoke test (Task 10): the skill fires on tooling prompts and does not fire on app-code prompts. ✓ Task 10.

---

## Self-review notes

**Spec coverage:** Every non-goal in spec §4 is preserved (no verifier-code change, no body persona edits, no item #6 work, no copy-sync mechanism). Every locked decision in spec §5 maps to a task: §5.1 name → Tasks 1, 2, 4; §5.2 description → Task 2; §5.3 body restructure → Tasks 2 + 3; §5.4 two-copy treatment → Tasks 1 + 4 + 8 Step 5; §5.5 cross-references → Tasks 5 + 6 + 7. File-by-file map (§6) → Tasks 1 (renames), 2/4 (modifications inside renames), 3 (creates), 5/6/7 (cross-refs). Single-commit rule (§7) → Task 9.

**Placeholder scan:** No "TBD", "TODO", "implement later", "add appropriate error handling", or "similar to Task N" anywhere. Every step has the exact content / command / expected output the engineer needs.

**Type consistency:** N/A — no code types in this refactor. Heading-name consistency between the SKILL.md content (Task 2) and the verifier requirements (`Core rules`, `Red flags`, `Review checklist`, `Interactions with other skills`) is preserved exactly.

**Risk consistency with spec §8:** R1 (mindset stripped) — the SKILL.md content in Task 2 keeps the Karpathy persona in `## Purpose & scope` and the "you are NOT in this mindset when —" framing as a one-line intro to the Red flags table. R2 / R3 (over- and under-narrowing) — covered by Task 10 smoke test prompts 1–4. R4 (verifier still RED) — Task 8 Step 1 is a hard gate; if RED persists the task says "iterate on Task 2 content". R5 (one copy missed) — Task 8 Steps 3 + 5 grep and diff. R6 (persona awkward post-rename) — out of scope; not addressed here.

If you find a spec requirement with no task or a contradiction between tasks, fix it inline and re-read this section.
