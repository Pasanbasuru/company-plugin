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
- postman
- prisma
- deploy-on-aws
- semgrep
- aikido-security

If your Claude Code environment can resolve those plugin sources, they will be installed automatically.
Otherwise, install them separately first.

## Local testing
From a fresh test project:

```bash
claude --plugin-dir /absolute/path/to/company-superpowers-plugin
```

Then inside Claude Code:
- `/help`
- `/agents`
- `/mcp`
- `/company-superpowers-plugin:architecture-guard`
- `/company-superpowers-plugin:frontend-implementation-guard`

For React Native projects, also use:
- `/company-superpowers-plugin:mobile-implementation-guard`

## Project setup
Copy these into a new project:
- `templates/project/.claude/CLAUDE.md`
- `templates/project/.claude/settings.json`
- `templates/project/.mcp.json`

Then replace all MCP placeholder commands with your real project MCP servers.
