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

One line: GREEN / YELLOW / RED. Name the reviewed surface and the overall verdict in a single sentence so a reader can scan without reading further.

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

If not all six, it's a draft.

For the full primitive decision framework, primitive table, key flags, key commands, and common-mistake catalog, see `references/patterns.md`.
