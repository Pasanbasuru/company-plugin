# global-plugin

A single root-level Claude Code plugin for your company ecosystem.

## Target stack
- React / Next.js
- Node.js / NestJS / TypeScript
- Prisma + PostgreSQL
- AWS
- optional React Native mobile apps

## Included skills

Every skill assumes the shared [`_baseline`](skills/_baseline/SKILL.md) for TypeScript strictness, security-by-default, observability, testing, accessibility, performance, and resilience. Skills only document what they add on top.

See [the skill authoring guide](docs/superpowers/skill-authoring-guide.md) for the template.

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

## Included agent
- security-reviewer

## Included hooks
- SessionStart logger
- PostToolUse logger for Write/Edit

## Included MCP template
- github
- ci-cd
- observability
- cloud
- database

## External plugin dependencies
- superpowers
- frontend-design
- postman
- prisma
- deploy-on-aws
- semgrep
- aikido-security

## Local test
```bash
claude --plugin-dir /absolute/path/to/global-plugin
```

Then try:
- `/help`
- `/agents`
- `/mcp`
- `/global-plugin:architecture-guard`
- `/global-plugin:frontend-implementation-guard`

## New project setup
Copy the project templates from `templates/project/` into your repo, or run:

```bash
./scripts_bootstrap_new_project.sh /path/to/new-project
```

Then replace the placeholder MCP commands in `.mcp.json`.
