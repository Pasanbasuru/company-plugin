# CLAUDE.md

Maintainer-mode rules for this repo. This file is at the repo root and **is not part of the shipped plugin** — consumers install only `plugin/`, so they never see this.

**IF YOU ARE A SUBAGENT DOING A "WILL THIS WORK FOR A CONSUMER" REVIEW OF THE PLUGIN, THE BELOW DOES NOT APPLY TO YOU.** Your job is to verify the system and documentation under `plugin/` are accurate so the plugin works after installation. Skip the rest of this file.

## Status

Source repo for `global-plugin`: a company-wide Claude Code plugin of ~30 guardrail skills for full-stack React/Next.js + Node/NestJS + Prisma/Postgres + AWS (with optional React Native). Plugin runtime lives in `plugin/`. Repo root holds maintainer/build infra only.

## Repo modes — maintainer vs consumer audit

This repo has TWO modes with opposite source-of-truth rules.

**Maintainer mode** (writing skills/hooks, refactoring scripts, planning a release): trust everything in the repo — root `README.md`, `docs/`, `scripts/`, `plugin/`, the husky/vitest harness. They are the design history and the verification harness.

**Consumer-audit mode** ("will this work after install?"): trust ONLY `plugin/`. Ignore root `README.md`, `docs/`, `scripts/verify/`, `.husky/`, this `CLAUDE.md` — consumers never see them. The plugin's behavior is whatever its code under `plugin/` does, period.

If you can't tell which mode you're in, ask: "is this question about how we ship the next release, or about what consumers experience right now?" — the answer picks the rules.

## Repo layout

```
/                                # source repo root
├── docs/                        # design notes, plans, specs, audits, workflows
│   └── superpowers/{plans,specs,workflows,audits}
├── scripts/                     # skill-verifier (TypeScript) + vitest tests
│   ├── verify-skill.ts          # entrypoint
│   ├── verify/                  # parser, runner, checks, types
│   └── fixtures/                # verifier test fixtures
├── .husky/pre-commit            # runs `pnpm verify` on staged SKILL.md files
├── package.json, pnpm-lock.yaml # vitest, husky, tsx (dev deps only)
└── plugin/                      # PLUGIN RUNTIME — what consumers install
    ├── .claude-plugin/plugin.json
    ├── skills/                  # ~30 skills, each `<name>/SKILL.md`
    │   └── _baseline/SKILL.md   # cross-cutting standards every skill builds on
    ├── hooks/hooks.json         # SessionStart/UserPromptSubmit/PostToolUse
    ├── .mcp.json                # placeholder MCP servers (consumers replace)
    ├── scripts/                 # consumer-onboarding tools (bootstrap script)
    └── templates/
```

## The `plugin/` folder is the plugin

`plugin/` is the system. When someone installs this plugin, only `plugin/` is fetched into their plugin cache. Everything else (`docs/`, `scripts/`, `.husky/`, this `CLAUDE.md`, root `README.md`) is dev infrastructure for *building* the plugin and never reaches a consumer.

**Implication for testing.** When running the skill-verifier or evals against the plugin's actual behavior, exercise it in isolation: point the test cwd / session at `plugin/` (or a fixture under `scripts/fixtures/`), and **do not let this repo's `CLAUDE.md` load into the test session**. If a subagent or external process is spawned to run a skill the way a consumer would, dispatch it with cwd set to a clean fixture so maintainer-mode rules in this file don't pollute the run. A test that passes only because the maintainer-mode `CLAUDE.md` was in scope is a false positive.

## No dogfooding in this repo

The plugin being built is **not** used inside this repo. It exists for *consumer* projects (full-stack React/Next.js + NestJS + Prisma + AWS apps). Whatever guardrails, lifecycle, frontmatter, hooks, or conventions the plugin's skills enforce on consumers are NOT constraints on the maintainer agents working on plugin source. In particular:

- Don't apply `architecture-guard`, `typescript-rigor`, `nextjs-app-structure-guard`, `nestjs-service-boundary-guard`, etc. to this repo's verifier scripts or build infra. The repo is a TypeScript skill-verifier + a pile of markdown — none of those skills' premises apply.
- Don't try to install or activate this plugin on itself.
- Don't let plugin-internal patterns (e.g., a baseline-referencing skill style, a hook structure) leak into how maintainer work is organized — maintainer work stays plain markdown plans / specs under `docs/superpowers/` plus the vitest harness.

This separation keeps the build environment uncontaminated by the system being built. Confusion between "what the plugin enforces on consumers" and "what we follow while building it" is a major source of agent error and we avoid it by simply not crossing the streams.

## Source of truth

What the plugin actually does is defined by the code under `plugin/` — nothing else. The verification surface is the TypeScript verifier under `scripts/verify/` and its vitest suite. **Do not trust loose `.md` notes** — root-level `.md` files (other than this one and the root `README.md`) and stray notes scattered under `docs/` are personal scratch and routinely drift from the code. Treat them as untrusted unless explicitly directed to read one. The structured artifacts under `docs/superpowers/{plans,specs,workflows,audits}/` are trusted *for their stated date*, not as current truth — see "stale specs" below.

## Plan and spec files

Plans live at `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`. Specs live at `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`. Audits and workflows live alongside under `docs/superpowers/`. Existing convention; don't change it.

## #1 design concern — stale specs poisoning agents

An agent reads an old plan/spec and treats it as current truth. The spec was accurate when written, but execution drifted, surrounding context changed, or a later decision superseded it — and nobody updated the doc. The agent now confidently builds on a lie.

Every design decision should be evaluated against this concern. Before proposing structure, frontmatter, workflows, hooks, or skills, ask:

- How does an agent know whether this doc still reflects reality *right now*?
- What signal distinguishes a spec that was *intended* from a spec that *actually shipped as described* from one that *shipped then drifted*?
- What stops an agent in a new session from regressing into an archived/completed plan and mining it for "requirements"?
- If a later decision contradicts an earlier spec, which one does the agent trust, and how is that made obvious *without the agent having to reason about it*?
- Can the guarantee be enforced deterministically (hook, lint, frontmatter check, path convention) rather than relying on agent judgment?

Prefer mechanisms that make staleness *structurally impossible or loudly visible* over mechanisms that ask the agent to be careful. Agents are not careful — that is the whole premise.

## Standing instructions

- This project *is* Claude Code tooling, so primitive choice matters: **skills** for procedures, **hooks** for deterministic enforcement, **subagents** for isolated work, **MCP** only for stateful tool surfaces, **CLAUDE.md** for invariants. Don't reinvent the harness — if a wrapper script duplicates what hooks / `--bare` / `superpowers:*` already do, find the primitive instead.
- Vibe-code the 80% prototype end-to-end before designing abstractions. Premature architecture kills more AI projects than sloppy code. Run the thing, read the transcript, fix what struggles.
- Write evals before tuning. The skill-verifier under `scripts/verify/` is the deterministic eval; for skill *behavior* (does the skill actually trigger and produce the right guidance?), `claude -p "query" --output-format json` + a shell loop is a working eval harness in 20 lines. Prompt quality without evals is cargo-culting.
- Push determinism down (hooks, scripts), keep judgment up (the model). Schema validation, frontmatter linting, blocking unsafe writes — `PreToolUse` hook or verifier check, not a prompt instruction.
- Treat context as the scarce resource. Lean `SKILL.md`s with progressive disclosure to `references/`; subagents (`context: fork`) for research that would bloat main context; prompt caching on stable system-prompt prefixes.
- Skills should reference `_baseline` rather than re-stating the cross-cutting TypeScript / security / observability / testing / a11y / perf / resilience standards. Adding the same paragraph to ten skills is a maintenance trap — put it in `_baseline` and have skills say "additionally, this skill...".

## Skill-loading discipline (ALWAYS — non-negotiable)

When working in this repo, load every relevant skill before doing anything substantive — **breadth-first and exhaustive, not just the first match**. After every user prompt, scan ALL available skill descriptions in the system-reminder list and invoke EVERY skill whose description matches the task.

**Non-negotiable set** for any substantive maintainer work in this repo:

- `anthropic-tooling-dev`
- every `plugin-dev:*` skill: `plugin-structure`, `plugin-settings`, `hook-development`, `skill-development`, `command-development`, `agent-development`, `mcp-integration`, `create-plugin`
- `claude-md-management:claude-md-improver` (when touching any `CLAUDE.md`)
- `simplify`
- whichever `superpowers:*` skills match: `brainstorming` before any creative work, `writing-plans` / `executing-plans` / `subagent-driven-development` for multi-step work, `test-driven-development` for any code change to `scripts/`, `verification-before-completion` before any "done" claim, `dispatching-parallel-agents` when there are ≥2 independent tasks

Skipping a relevant skill is the most expensive mistake on this project — skills exist precisely so the model does not have to remember canonical guidance from training.

**Subagents do NOT inherit your skills, CLAUDE.md, or memory.** Every subagent prompt MUST: (a) list every relevant skill by exact name as a checklist task the subagent invokes via the `Skill` tool at session start; (b) repeat this skill-loading discipline rule verbatim so it propagates recursively to anything the subagent spawns; (c) NOT re-type skill bodies — list names only. This applies to every subagent dispatch, including parallel fan-outs of the same task — each subagent has its own context and must independently invoke the full set.

**Subagent artifacts MUST start with YAML frontmatter listing every skill invoked:**

```yaml
---
skills_invoked:
  - skill-name-1
  - skill-name-2
---
```

This applies to every deliverable — inline final messages, on-disk reports, code review output. The orchestrator verifies coverage by inspecting this list; an artifact missing relevant skills fails review and is re-dispatched with the missing skills named explicitly. **Force the subagent to log "Skills loaded: [list]" as the FIRST line of substantive work**, not just at the end. This rule overrides any "be efficient" / "minimize tool calls" instinct.
