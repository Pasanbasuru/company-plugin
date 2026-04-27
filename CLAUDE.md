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
