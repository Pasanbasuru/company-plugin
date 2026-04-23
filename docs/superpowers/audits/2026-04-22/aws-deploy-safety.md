# Compatibility audit — aws-deploy-safety

Date: 2026-04-22
Source: skills/aws-deploy-safety/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | PASS | Clear "Use when" + "Do NOT use for" with concrete triggers; no workflow summary |
| C2 No HARD-GATE bypass           | PASS | No imperative verbs that force implementation; all guidance is deploy-mechanics only |
| C3 No duplication                | PASS | Hands off to `infra-safe-change`, `secrets-and-config-safety`, `rollback-planning` correctly; owns deploy layer only |
| C4 Correct handoff markers       | CONCERN | Uses bare backtick names in "Hands off to" prose; should use `**Hands off to:** superpowers:<name>` format markers for consistency (though semantics are clear) |
| C5 No Iron Law contradiction     | PASS | No rules force code without tests, fix without root cause, or claim without evidence violations |
| C6 Review-mode output compat     | FAIL | Review checklist missing "Safer alternative" section required by skill-authoring-guide.md §Review checklist; only has Summary, Findings, Checklist — needs 4-section format |
| C7 Workflow-insertion simulation | N/A | Review-mode skill; attaches to Workflow 06 (review loop) alongside code-reviewer; no HARD-GATE interaction |

## Findings (CONCERN or FAIL)

- skills/aws-deploy-safety/SKILL.md §Review checklist — FAIL — Missing "Safer alternative" section. Authoring guide specifies four sections (Summary, Findings, Safer alternative, Checklist coverage); this has three. Add a "3. **Safer alternative** — if applicable, name an alternative approach and why it's riskier" section between Findings and Checklist coverage.

## Workflows this skill attaches to

- 06 — Review mode for AWS deploy/task definition/Lambda config changes; runs alongside `code-reviewer` during review-loop phase

Overall verdict: YELLOW
