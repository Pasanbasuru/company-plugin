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

### Shared foundation
- `_baseline` — cross-cutting standards referenced by every other skill

### Architecture & structure
- `architecture-guard`
- `nextjs-app-structure-guard`
- `nestjs-service-boundary-guard`
- `frontend-implementation-guard`
- `mobile-implementation-guard`

### Data
- `prisma-data-access-guard`
- `state-integrity-check`

### Integration & async
- `integration-contract-safety`
- `queue-and-retry-safety`
- `resilience-and-error-handling`

### Security & config
- `auth-and-permissions-safety`
- `secrets-and-config-safety`

### Quality
- `typescript-rigor`
- `test-strategy-enforcement`
- `coverage-gap-detection`
- `regression-risk-check`

### Frontend quality
- `accessibility-guard`
- `performance-budget-guard`

### Ops & risk
- `change-risk-evaluation`
- `rollback-planning`
- `infra-safe-change`
- `aws-deploy-safety`
- `cicd-pipeline-safety`
- `supply-chain-and-dependencies`
- `observability-first-debugging`

### Skill authoring & verification
- `skill-authoring`
- `skill-verification`

## Included hooks

- SessionStart logger
- PostToolUse logger for Write/Edit
- SessionStart + UserPromptSubmit skills-roster injector

## Included MCP template

`plugin/.mcp.json` registers placeholder MCP servers (github, ci-cd, observability, cloud, database). Replace the placeholder `echo` commands with your real MCP server commands before relying on them. (Tracked as a follow-up — see repo issues.)

## External plugin dependencies

- superpowers
- frontend-design
- prisma
- deploy-on-aws
- semgrep

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
