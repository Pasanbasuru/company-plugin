# global-plugin

Company-wide guardrails for full-stack React/Next.js + Node/NestJS + Prisma/Postgres + AWS projects.

> Note: a one-command new-project setup script is being reworked. The previous `plugin/scripts/bootstrap-new-project.sh` is still shipped but its templates have known issues (broken `.mcp.json` placeholders, CLAUDE.md template at a path Claude Code doesn't read). Pending follow-up release.

## Target stack

- React / Next.js
- Node.js / NestJS / TypeScript
- Prisma + PostgreSQL
- AWS
- optional React Native mobile apps

## Included skills

Skills reference the shared baseline (now in `templates/`) for TypeScript strictness, security-by-default, observability, testing, accessibility, performance, and resilience. Skills only document what they add on top.

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

### Frontend quality
- `accessibility-guard`
- `performance-budget-guard`

### Ops & risk
- `change-risk-evaluation` — evaluates risk posture, blast radius, and rollback options for a proposed change
- `infra-safe-change`
- `aws-deploy-safety`
- `cicd-pipeline-safety`
- `supply-chain-and-dependencies`
- `observability-first-debugging`

### Maintainer / experimental skills

- `anthropic-tooling-dev` — guidance for working on Claude Code tooling itself. Placement is being evaluated post-0.4.0; may relocate or be removed from the consumer surface in a future release.

## Included hooks

- **SessionStart** — injects a one-paragraph reminder of skill-loading discipline (use every relevant skill, name skills explicitly when dispatching subagents).
- **UserPromptSubmit** — re-emits the same reminder as a one-line reinforcement on every prompt.

The previous timestamp loggers (PostToolUse Write/Edit, SessionStart) and the per-prompt full-roster injection were removed in 0.4.0.

## Recommended companion plugins

`global-plugin` is designed to work alongside these plugins. Install them separately for full coverage:

```bash
claude plugin install superpowers --marketplace claude-plugins-official
claude plugin install frontend-design --marketplace claude-plugins-official
claude plugin install prisma --marketplace claude-plugins-official
claude plugin install deploy-on-aws --marketplace claude-plugins-official
claude plugin install semgrep --marketplace claude-plugins-official
```

These are recommendations, not enforced dependencies — the plugin works without them, but several skills cross-reference them by name. If a companion is not installed, those cross-references will be unresolved.

## MCP servers

`global-plugin` does not ship any MCP servers in 0.4.0. The previous `.mcp.json` shipped placeholder `echo` servers that broke `/mcp` for consumers and was removed.

If your project uses MCP servers, configure them in your project's own `.mcp.json`. Suggested server names that align with the plugin's guard skills:

- `github` — GitHub MCP server for repo introspection
- `ci-cd` — your CI/CD provider's MCP server (GitHub Actions, CircleCI, etc.)
- `observability` — your observability stack (Datadog, CloudWatch, etc.)
- `cloud` — your cloud provider (AWS)
- `database` — Postgres / Prisma MCP server

These are conventions, not requirements — the plugin's skills do not depend on any specific MCP server being present.

## Local test

```bash
claude --plugin-dir /absolute/path/to/global-plugin/plugin
```

Inside Claude Code:
- `/help`
- `/mcp`
- `/global-plugin:architecture-guard`
- `/global-plugin:frontend-implementation-guard`

For React Native projects, also use:
- `/global-plugin:mobile-implementation-guard`
