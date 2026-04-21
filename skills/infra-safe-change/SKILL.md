---
description: Evaluate infrastructure, deployment, and environment changes safely before applying them.
---

Use this skill when changing Docker, CI/CD, Terraform, AWS config, secrets usage, networking, or scaling.

Rules:
1. Prefer minimal infra changes.
2. Call out environment-specific assumptions.
3. Highlight secrets exposure risk, permission changes, downtime risk, and rollback difficulty.
4. Never assume deploy safety without verification.
5. Prefer reversible changes.

Output:
- infra change summary
- risk areas
- rollback notes
- verification checklist
