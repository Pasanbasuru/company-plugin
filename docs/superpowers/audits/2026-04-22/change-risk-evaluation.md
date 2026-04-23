# Compatibility audit — change-risk-evaluation

Date: 2026-04-22
Source: skills/change-risk-evaluation/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | PASS | Description opens with "Use at PR time"; anti-triggers ("Do NOT use for code-level review") stated; concrete trigger (PR, risk rating context) |
| C2 No HARD-GATE bypass           | PASS | No imperative verbs that bypass implementation gates; purely evaluative/reporting skill, no code-generation pathway |
| C3 No duplication                | PASS | Does not re-implement test-driven-development, systematic-debugging, or verification-before-completion; deferring correctly via interactions section |
| C4 Correct handoff markers       | CONCERN | Cross-skill references use loose prose ("feeds from", "defers to") instead of sanctioned markers; should use `**REQUIRED BACKGROUND:** superpowers:...` format |
| C5 No Iron Law contradiction     | PASS | No rule forces violation of "no code without test", "no fix without root cause", "no claim without evidence"; purely risk-assessment discipline |
| C6 Review-mode output compat     | FAIL | Review checklist uses non-standard labels ("COMPLETE, INCOMPLETE, NOT APPLICABLE") instead of prescribed ("PASS, CONCERN, NOT APPLICABLE"); shape does not match authoring-guide format (missing Summary, Findings file:line, Safer alternative sections) |
| C7 Workflow-insertion simulation | PASS | Skill correctly attaches to Workflow 6 (review-loop) alongside code-reviewer; runs in review mode only; no gate violations expected in simulation |

## Findings (CONCERN or FAIL)

- SKILL.md:199–203 — Interactions section uses prose references ("feeds from", "hands off to", "defers to") instead of the `**REQUIRED BACKGROUND:**` and `**Hands off to:**` markers specified in testing-skills-against-workflows.md C4. Fix: convert "feeds from: regression-risk-check" to `**REQUIRED BACKGROUND:** superpowers:regression-risk-check` (or appropriate marker form).
- SKILL.md:183–197 — Review checklist violates C6 standard by using "COMPLETE / INCOMPLETE / NOT APPLICABLE" labels and flat-table format. Must match `docs/superpowers/skill-authoring-guide.md` four-section shape: Summary, Findings (file:line, severity, category, fix), Safer alternative, Checklist coverage (PASS / CONCERN / NOT APPLICABLE per rule). Current checklist is field-status-only; no findings section exists to capture file locations and recommended fixes per rule.

## Workflows this skill attaches to

- 06 — Review-loop, alongside code-reviewer, to assess top-level risk posture (overall risk rating, deploy strategy, monitoring plan, stakeholder notification) before PR approval.

Overall verdict: YELLOW
