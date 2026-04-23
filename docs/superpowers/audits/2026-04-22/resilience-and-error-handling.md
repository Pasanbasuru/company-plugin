# Compatibility audit — resilience-and-error-handling

Date: 2026-04-22
Source: skills/resilience-and-error-handling/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | PASS | "Use when" + "Do NOT use for" + concrete triggers; no workflow summarization |
| C2 No HARD-GATE bypass           | PASS | No implementation imperatives before spec approval; guidance-only scope |
| C3 No duplication                | PASS | No restatement of TDD, debugging, verification, or code-review primitives |
| C4 Correct handoff markers       | PASS | Uses canonical `**Hands off to:**` format with skill references |
| C5 No Iron Law contradiction     | PASS | No rule forces violation of NO CODE WITHOUT TEST, NO FIX WITHOUT ROOT CAUSE, etc. |
| C6 Review-mode output compat     | CONCERN | Review checklist missing "Safer alternative" section per skill-authoring-guide |
| C7 Workflow-insertion simulation | N/A | Static audit only; dynamic insertion testing deferred to subagent phase |

## Findings (CONCERN or FAIL)

- `SKILL.md:625–640` — Review checklist missing "Safer alternative" section — add section between Findings and Checklist coverage per `docs/superpowers/skill-authoring-guide.md` §*Review checklist*

Note: Skill is 640 lines, exceeds the 500-line ceiling in the authoring guide (200–400 target). Consider a split in a future cycle.

## Workflows this skill attaches to

- 02 (creative-work) — invoked during implementation phase when code touches network calls, timeouts, retries
- 03 (bug-path) — invoked during debugging of resilience/error-handling failures

Overall verdict: YELLOW
