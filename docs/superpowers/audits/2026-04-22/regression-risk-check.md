# Compatibility audit — regression-risk-check

Date: 2026-04-22
Source: skills/regression-risk-check/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | PASS | "Use when" + "Do NOT use for" + concrete triggers present. Anti-triggers named (change-risk-evaluation, coverage-gap-detection). |
| C2 No HARD-GATE bypass           | PASS | Review-mode only. No imperative verbs pushing into implementation. Enforces evidence-first discipline. |
| C3 No duplication                | PASS | No restated superpowers primitives. Hand-offs to change-risk-evaluation and coverage-gap-detection are appropriate. |
| C4 Correct handoff markers       | CONCERN | Description and checklist reference "change-risk-evaluation" and "coverage-gap-detection" in prose, not using `**REQUIRED SUB-SKILL:**` or `**HANDS OFF TO:**` markers. |
| C5 No Iron Law contradiction     | PASS | Rules strengthen Iron Law 1 (test evidence required). No forced violations. |
| C6 Review-mode output compat     | CONCERN | Checklist template is empty. Missing four-section report shape: Summary, Findings (file:line format), Safer alternative, Checklist coverage. Provides custom "Blast-radius report format" instead. |
| C7 Workflow-insertion simulation | PASS | Skill correctly attaches to Workflow 06 (review-loop), alongside code-reviewer. No gate violations on static inspection. |

## Findings (CONCERN or FAIL)

- `SKILL.md` line 3 — C4: Description references other skills in prose ("use `change-risk-evaluation`", "use `coverage-gap-detection`") without `**REQUIRED SUB-SKILL:**` or `**HANDS OFF TO:**` markers. Recommend: change description clause to `Hands off to: change-risk-evaluation for overall risk, coverage-gap-detection for test coverage.`
- `SKILL.md` line 159–182 — C6: Review checklist is a template, not a complete report structure. Missing Summary section, Findings with file:line:severity:category:fix format, Safer alternative section. Current "Blast-radius report format" is a code block — not a structured four-section report. Recommend: rewrite to match `docs/superpowers/skill-authoring-guide.md` §Review checklist pattern.

## Workflows this skill attaches to

- 06 — review-loop: assess blast radius of PRs alongside code-reviewer and other domain-risk reviewers

Overall verdict: YELLOW
