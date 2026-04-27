# Installation and Usage

## What this plugin is
This is a single root-level Claude Code plugin intended to live at the root of your existing repository.

It is designed for your common company stack:
- React / Next.js
- Node.js / NestJS / TypeScript
- Prisma + PostgreSQL
- AWS
- optional React Native mobile apps

## External plugins used by this plugin
This plugin declares dependencies on:
- superpowers
- frontend-design
- prisma
- deploy-on-aws
- semgrep

If your Claude Code environment can resolve those plugin sources, they will be installed automatically.
Otherwise, install them separately first.

## Local testing
From a fresh test project:

```bash
claude --plugin-dir /absolute/path/to/global-plugin/plugin
```

Then inside Claude Code:
- `/help`
- `/agents`
- `/mcp`
- `/company-plugin:architecture-guard`
- `/company-plugin:frontend-implementation-guard`

For React Native projects, also use:
- `/company-plugin:mobile-implementation-guard`

## Project setup
Copy these into a new project:
- `plugin/templates/project/.claude/CLAUDE.md`
- `plugin/templates/project/.claude/settings.json`
- `plugin/templates/project/.mcp.json`

Then replace all MCP placeholder commands with your real project MCP servers.
