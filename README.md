# company-superpowers-plugin

A single root-level Claude Code plugin for your company ecosystem.

## Target stack
- React / Next.js
- Node.js / NestJS / TypeScript
- Prisma + PostgreSQL
- AWS
- optional React Native mobile apps

## Included skills
### Common / full-stack
- architecture-guard
- change-risk-evaluation
- integration-contract-safety
- state-integrity-check
- infra-safe-change
- observability-first-debugging
- auth-and-permissions-safety
- secrets-and-config-safety
- rollback-planning
- queue-and-retry-safety
- test-strategy-enforcement
- regression-risk-check
- coverage-gap-detection

### Web/full-stack specific
- frontend-implementation-guard
- nextjs-app-structure-guard
- nestjs-service-boundary-guard
- prisma-data-access-guard
- aws-deploy-safety

### Mobile
- mobile-implementation-guard

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
claude --plugin-dir /absolute/path/to/company-superpowers-plugin
```

Then try:
- `/help`
- `/agents`
- `/mcp`
- `/company-superpowers-plugin:architecture-guard`
- `/company-superpowers-plugin:frontend-implementation-guard`

## New project setup
Copy the project templates from `templates/project/` into your repo, or run:

```bash
./scripts_bootstrap_new_project.sh /path/to/new-project
```

Then replace the placeholder MCP commands in `.mcp.json`.
