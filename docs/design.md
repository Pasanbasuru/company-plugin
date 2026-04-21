# Design Principles

## Responsibility split
- Superpowers: workflow engine
- This company plugin: company guardrails and engineering judgment
- External plugins: capabilities/tools
- MCP: real system access

## Why there is no conflict
This plugin does not try to replace external plugins.

Examples:
- `frontend-implementation-guard` protects structure and standards.
- `frontend-design` is for UI generation quality.
- `prisma-data-access-guard` protects access patterns and migration awareness.
- `prisma` provides Prisma-specific tooling.
- `aws-deploy-safety` enforces AWS deploy caution.
- `deploy-on-aws` provides AWS deployment capability.

## Common stack assumption
This plugin assumes your default company app is a full-stack web app.
That is why base + web skills are included together here.
React Native support is included as an extra skill rather than a separate plugin.
