# Compatibility audit — accessibility-guard

Date: 2026-04-22
Source: skills/accessibility-guard/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | PASS | Description starts with "Use when", includes anti-trigger ("Do NOT skip this for"), references concrete triggers (WCAG 2.2 AA, keyboard, focus, aria, contrast, reduced motion, form accessibility). |
| C2 No HARD-GATE bypass           | PASS | No imperative verbs forcing code generation before spec approval. All 8 core rules are inspection/review-phase guidance; no "write code", "implement", or gate-bypass directives. |
| C3 No duplication                | PASS | No rules restating superpowers primitives (TDD, debugging, verification, git-worktrees, finishing, code-review). Skill owns accessibility compliance; primitives own their own domains. |
| C4 Correct handoff markers       | PASS | No cross-skill references; no loose prose mentions. Trivial pass. |
| C5 No Iron Law contradiction     | PASS | All 8 core rules are design-review phase (static auditing). No rule forces code before test (IL1), fix before root cause (IL2), claim before evidence (IL3), or skill-writing without test (IL4). |
| C6 Review-mode output compat     | FAIL | Missing required `## Review checklist` section. Skill ends at `## Testing a11y` (line 434). Per authoring-guide section 10, every domain skill must have a Review checklist section with prescribed structure: Summary, Findings (file:line, severity, category, fix), Safer alternative, Checklist coverage (PASS / CONCERN / NOT APPLICABLE per rule). Inline guidance at lines 421–434 describes output shape but does not supply the `## Review checklist` markdown section required for code-reviewer agent integration. |
| C7 Workflow-insertion simulation | CONCERN | Skill lacks `## Interactions with other skills` section (required per authoring-guide section 9). Without this section, attachment points are not explicitly documented. Inferred from whole-map.md that accessibility-guard attaches to implementation guardrails (Workflow 04 SDD/Implementer, Workflow 06 RCR/code-reviewer), but cannot verify workflow-insertion behavior without explicit "Owns / Hands off to / Does not duplicate" bullets. Dynamic simulation incomplete. |

## Findings (CONCERN or FAIL)

- skills/accessibility-guard/SKILL.md — Missing section — No `## Review checklist` section per authoring-guide §10. Add markdown section with prescribed structure: Summary (one-line pass/concerns/blocking), Findings (file:line, severity, category, fix), Safer alternative, Checklist coverage (8 rules each marked PASS / CONCERN / NOT APPLICABLE).
- skills/accessibility-guard/SKILL.md — Missing section — No `## Interactions with other skills` section per authoring-guide §9. Add bullets: Owns (accessibility compliance), Hands off to (code-reviewer agent for review-mode invocation), Does not duplicate (baseline accessibility floor).

## Workflows this skill attaches to

- 04 (Implementer subagent) — audits React UI components for WCAG 2.2 AA during implementation per SDD flow
- 06 (code-reviewer) — informs review-mode checklist output for accessibility findings

Overall verdict: RED
