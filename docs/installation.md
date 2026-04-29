# Installation and Usage

## What this plugin is

A single Claude Code plugin shipping ~24 guardrail skills for the company stack:

- React / Next.js
- Node.js / NestJS / TypeScript
- Prisma + PostgreSQL
- AWS
- optional React Native mobile apps

Plugin runtime lives under `plugin/` in this repo. Consumers install only that subtree via the plugin marketplace; everything else (`docs/`, `scripts/`, `templates/`, `.husky/`) is dev infrastructure for *building* the plugin.

## Recommended companion plugins

`global-plugin` is designed to work alongside these plugins. They are **not** auto-installed — install them yourself:

```bash
claude plugin install superpowers --marketplace claude-plugins-official
claude plugin install frontend-design --marketplace claude-plugins-official
claude plugin install prisma --marketplace claude-plugins-official
claude plugin install deploy-on-aws --marketplace claude-plugins-official
claude plugin install semgrep --marketplace claude-plugins-official
```

These are recommendations, not enforced dependencies. The plugin works without them, but several skills cross-reference them by name. If a companion is not installed, those cross-references will be unresolved.

## MCP servers

`global-plugin` does not ship any MCP servers in 0.4.0. Configure your own in your project's `.mcp.json`. Suggested server names that align with the plugin's guard skills:

- `github` — GitHub MCP server for repo introspection
- `ci-cd` — your CI/CD provider's MCP server
- `observability` — your observability stack
- `cloud` — your cloud provider (AWS)
- `database` — Postgres / Prisma MCP server

These are conventions, not requirements — the plugin's skills do not depend on any specific MCP server being present.

## Local testing

From a fresh test project (NOT this repo's working directory — see the test-isolation note in `CLAUDE.md`):

```bash
claude --plugin-dir /absolute/path/to/global-plugin/plugin
```

Then inside Claude Code:

- `/help` lists `global-plugin` skills.
- `/mcp` is empty (the plugin ships no MCP servers).
- `/global-plugin:architecture-guard` triggers a skill.
- `/global-plugin:frontend-implementation-guard` triggers another.

For React Native projects, also use:

- `/global-plugin:mobile-implementation-guard`

## Project setup

> **Note:** the previous one-command `bootstrap-new-project.sh` workflow is being reworked. The script and its templates still ship in `plugin/scripts/` and `plugin/templates/` but have known issues (broken `.mcp.json` placeholders, `.claude/CLAUDE.md` template at a path Claude Code doesn't read). Pending follow-up release.

Until the bootstrap rework lands, set up a new project manually:

1. Add a `.claude/settings.json` to your project with sensible deny rules (Read access to `.env`, `.env.*`, `secrets/**` should be denied at minimum). Reference: `plugin/templates/project/.claude/settings.json`.
2. Add a project-root `CLAUDE.md` describing your stack, architecture, and operational constraints (Claude Code reads `<repo-root>/CLAUDE.md`, *not* `<repo-root>/.claude/CLAUDE.md`).
3. If you use MCP servers, configure them in your project's `.mcp.json`.
4. Install the recommended companion plugins (see above) so cross-references resolve.
