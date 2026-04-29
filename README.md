# global-plugin

Source repository for the `global-plugin` Claude Code plugin — company-wide guardrails for full-stack React/Next.js + Node/NestJS + Prisma/Postgres + AWS projects, with optional React Native mobile.

The shipped plugin lives entirely under [`plugin/`](./plugin/); see [`plugin/README.md`](./plugin/README.md) for the consumer-facing description, full skill catalog, and install instructions. Everything else in this repo (`docs/`, `scripts/`, `.husky/`, this README, `CLAUDE.md`) is dev infrastructure for *building* the plugin and never reaches a consumer.

## What the plugin does

Ships ~24 skill-format guardrails ("guards") that activate when an agent works on a consumer project, organized by concern:

- **Architecture & structure** — monorepo dependency boundaries, Next.js app structure, NestJS service boundaries, frontend implementation, mobile implementation
- **Data** — Prisma access patterns, state integrity
- **Integration & async** — contract safety, queue/retry, resilience
- **Security & config** — auth/permissions, secrets, supply chain
- **Quality** — TypeScript rigor, test strategy, coverage gaps
- **Frontend quality** — accessibility, performance budget
- **Ops & risk** — change-risk evaluation (covers blast radius, rollback path, deploy strategy, monitoring, stakeholders), infra change, AWS deploy, CI/CD, observability-first debugging

Each skill is self-contained — domain skills hold their own rules. A pair of lightweight hooks (SessionStart + UserPromptSubmit) inject a brief skill-loading-discipline reminder; no MCP servers and no loggers ship with the plugin in 0.4.0.

The full mechanism inventory — exact skill list, hook config, recommended companion plugins — lives in [`plugin/README.md`](./plugin/README.md).

## Repository layout

| Path | Purpose | Shipped to consumers |
|---|---|---|
| `plugin/` | Plugin runtime — manifest, skills, hooks, onboarding scripts | Yes |
| `docs/` | Design notes, plans, specs, audits, workflows | No |
| `docs/superpowers/{plans,specs,workflows,audits}/` | Structured maintainer artifacts (dated `YYYY-MM-DD-<topic>.md`) | No |
| `scripts/` | Skill-verifier (TypeScript) + vitest harness | No |
| `.husky/` | Pre-commit hook — runs `pnpm verify` on staged `SKILL.md` | No |
| `package.json`, `pnpm-lock.yaml` | Dev deps only (vitest, husky, tsx) | No |
| `CLAUDE.md` | Maintainer-mode project instructions | No |

## Local test

From any project directory:

```bash
claude --plugin-dir /absolute/path/to/global-plugin/plugin
```

Inside Claude Code:

- `/help` lists `global-plugin` skills.
- `/mcp` is empty (the plugin ships no MCP servers; configure your own in your project's `.mcp.json`).
- `/global-plugin:architecture-guard` triggers a skill.

To exercise the plugin the way a consumer would (without this repo's `CLAUDE.md` polluting the session), run the command above from a clean directory — never from this repo root.

## Maintainer workflow

```bash
pnpm install                                  # one-time
pnpm test                                     # vitest suite (skill-verifier)
pnpm verify plugin/skills/<name>/SKILL.md     # one skill
```

The husky pre-commit hook runs `pnpm verify` automatically on staged `plugin/skills/*/SKILL.md` files. The verifier itself is plain TypeScript under `scripts/verify/` (parser, runner, checks) with a vitest test suite — no plugin primitives, no AI in the loop.

## Consumer-facing docs

See [`plugin/README.md`](./plugin/README.md) for the consumer-facing skill catalog, hook list, MCP setup, and install instructions. (A one-command new-project setup script is being reworked — see `plugin/README.md`'s deferral note.)
