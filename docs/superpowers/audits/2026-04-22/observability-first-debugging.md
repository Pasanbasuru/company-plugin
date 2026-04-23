# Compatibility audit — observability-first-debugging

Date: 2026-04-22
Source: skills/observability-first-debugging/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | PASS | Clear "Use when" and "Do NOT use for" with concrete anti-triggers |
| C2 No HARD-GATE bypass           | PASS | Preserves Iron Laws; explicitly directs "do not skip ahead to forming a fix" |
| C3 No duplication                | PASS | Owns observability patterns; hands off to error handling and deploy evaluation |
| C4 Correct handoff markers       | CONCERN | Missing explicit REQUIRED BACKGROUND marker for systematic-debugging Phase 1 attachment |
| C5 No Iron Law contradiction     | PASS | Rule 1 forbids console.log patches; playbook preserves phase gates |
| C6 Review-mode output compat     | CONCERN | Review checklist missing "Safer alternative" section required by authoring guide |
| C7 Workflow-insertion simulation | N/A | Static audit only; dynamic dispatch required |

## Findings (CONCERN or FAIL)

- **skills/observability-first-debugging/SKILL.md § Interactions with other skills** — Missing explicit attachment to systematic-debugging. The workflow (03-bug-path Layer 2) shows this skill attaches to Phase 1. Add: `**REQUIRED BACKGROUND:** superpowers:systematic-debugging (Phase 1 — Root Cause)` to signal the skill is invoked within, not before, the debugging workflow.
- **skills/observability-first-debugging/SKILL.md § Review checklist** — Section count mismatch. Authoring guide prescribes: Summary, Findings, Safer alternative, Checklist coverage. Skill has: Summary, Handler inventory, Findings, Alarm coverage, Checklist coverage. Add "Safer alternative" section with concrete non-observability mitigations (e.g., "If logs are unavailable, check recent deployments and metric dashboards first").

## Workflows this skill attaches to

- 03 — bug path, Phase 1 (root cause analysis; before implementation)

Overall verdict: YELLOW
