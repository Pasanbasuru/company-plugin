# Compatibility audit — queue-and-retry-safety

Date: 2026-04-22
Source: skills/queue-and-retry-safety/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | PASS | Description: "Use when publishing to or consuming from SQS, EventBridge, or message queue; also for background jobs with retry semantics." Anti-trigger: "Do NOT use for in-process retries (use resilience-and-error-handling)." Concrete triggers (SQS, EventBridge, DLQ). Does not summarize workflow. |
| C2 No HARD-GATE bypass           | PASS | No imperative verbs forcing implementation (write, implement, scaffold, create, skip). Redrive strategy mentions human review before re-executing. Code examples only. |
| C3 No duplication                | PASS | No re-encoding of test-driven-development, systematic-debugging, verification-before-completion, using-git-worktrees, or finishing-a-development-branch primitives. References root-cause requirement but defers to observability-first-debugging. |
| C4 Correct handoff markers       | PASS | References use sanctioned markers: **Hands off to:** for integration-contract-safety, resilience-and-error-handling, observability-first-debugging. **Does not duplicate:** for prisma-data-access-guard. No loose prose references or @ force-loads. |
| C5 No Iron Law contradiction     | PASS | Rules enforce rather than bypass Iron Laws. Redrive requires human investigation (supports "no fix without root cause"). No rule forces code without tests or bypasses verification gates. |
| C6 Review-mode output compat     | CONCERN | Review checklist prescribes custom sections (Consumer inventory, custom Findings format) rather than standard guide. Missing "Safer alternative" section. Grading uses PASS/CONCERN/NOT APPLICABLE (correct). Seven core rules map 1:1 to checklist items. |
| C7 Workflow-insertion simulation | PASS | Skill attaches at plan-structure phase (Workflow 02) and review-phase (Workflow 06). Attachment points: "Plan structure — Queue consumer/producer" and "Alongside code-reviewer — Domain-specific risk." No gate bypass risk in both phases (guide + review mode). |

## Findings (CONCERN or FAIL)

- skills/queue-and-retry-safety/SKILL.md, lines 294–308 — Review checklist section deviates from authoring guide standard. Guide specifies: Summary, Findings (file:line, severity, category, fix), Safer alternative, Checklist coverage. Skill specifies: Summary, Consumer inventory, custom-format Findings, Checklist coverage. Missing "Safer alternative" section. Fix: Replace custom sections with: Summary → Consumer inventory (as examples within Findings), Findings (file:line format), Safer alternative (domain-specific guidance), Checklist coverage.

## Workflows this skill attaches to

- 02-creative-work — Plan structure phase, triggered on "Queue consumer/producer" code
- 06-review-loop — Alongside code-reviewer, domain-specific risk review

Overall verdict: YELLOW
