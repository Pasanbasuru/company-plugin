# Compatibility audit — infra-safe-change

Date: 2026-04-22
Source: skills/infra-safe-change/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | PASS | Description has "Use when", "Do NOT use for", and concrete file-type triggers (Terraform, CloudFormation, CDK). |
| C2 No HARD-GATE bypass           | PASS | Review-focused skill with no imperative verbs pushing into implementation before planning gates. |
| C3 No duplication                | PASS | Does not restate TDD, systematic-debugging, verification, git-worktrees, or review primitives. |
| C4 Correct handoff markers       | PASS | Uses "Hands off to:" markers for aws-deploy-safety, secrets-and-config-safety, rollback-planning. |
| C5 No Iron Law contradiction     | PASS | No rules force violations of Iron Laws 1–4. All rules strengthen safety posture. |
| C6 Review-mode output compat     | CONCERN | Checklist is plain checkbox list; should be four-section format (Summary, Findings, Safer alternative, Checklist coverage with PASS/CONCERN/NOT APPLICABLE labels). |
| C7 Workflow-insertion simulation | PASS | Attaches to Workflow 06 (review-loop) as domain-risk reviewer alongside code-reviewer; scope is IaC-only. |

## Findings (CONCERN or FAIL)

- skills/infra-safe-change/SKILL.md § Review checklist — Uses plain checkboxes instead of four-section format required by authoring guide. Replace with: Summary section, Findings section (file:line format with severity/category/fix), Safer alternative section, Checklist coverage section with PASS/CONCERN/NOT APPLICABLE labels per rule.

## Workflows this skill attaches to

- 06 — Domain-risk reviewer for IaC/infrastructure changes. Runs alongside code-reviewer in review mode.

Overall verdict: YELLOW
