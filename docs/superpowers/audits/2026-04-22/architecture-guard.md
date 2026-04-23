# Compatibility audit — architecture-guard

Date: 2026-04-22
Source: skills/architecture-guard/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | PASS | Description uses "Use when" (cross-package/service boundaries) + "Do NOT use for" (intra-app structure). Concrete triggers: diff introduces new cross-package edge, removes boundary, new top-level package. No vague concepts. |
| C2 No HARD-GATE bypass           | PASS | No imperative verbs forcing implementation pre-spec. Skill is design-phase review of boundaries; does not suggest "write code now" or skip writing-plans. Static check shows only governance rules, no premature action directives. |
| C3 No duplication                | PASS | No restatement of test-driven-development, systematic-debugging, or other superpowers primitives. Skill correctly hands off contract semantics to integration-contract-safety and intra-module work to nextjs/nestjs guards. No duplicate primitives detected. |
| C4 Correct handoff markers       | FAIL | "Hands off to" uses prose (backticks) instead of marker. Line 106: `` `nextjs-app-structure-guard`...`` should be `**Hands off to:** superpowers:nextjs-app-structure-guard` (or company-plugin variant). Incorrect syntax breaks Claude's marker recognition. |
| C5 No Iron Law contradiction     | PASS | Rules enforce architecture governance (no cycles, no reverse deps, owned packages). No rule forces code before testing, fix before root-cause, or claim before evidence. Governance rules complement Iron Laws; do not contradict. |
| C6 Review-mode output compat     | PASS | Review checklist (lines 109–122) follows prescribed shape: Summary, Findings (file:line, severity, category, fix), Safer alternative, Checklist coverage. Grading uses PASS / CONCERN / NOT APPLICABLE. All 6 Core rules mapped to checklist lines. |
| C7 Workflow-insertion simulation | PASS | Skill attaches to workflow 02 (creative work), phase: design review — after brainstorming spec, before writing-plans. No subagent simulation needed for static audit; categorization confirms architecture-guard as design-phase gate. Does not bypass spec→plan→code flow. |

## Findings (CONCERN or FAIL)

- skills/architecture-guard/SKILL.md:106 — Handoff reference uses backtick prose instead of marker — Change `` `nextjs-app-structure-guard` `` to `**Hands off to:** superpowers:nextjs-app-structure-guard` (or qualify as company-plugin:nextjs-app-structure-guard if internal; verify marker style from other skills in repo).

## Workflows this skill attaches to

- 02 — Creative work. Invoked during brainstorming/design review, after spec draft and before writing-plans. Reviews cross-service/cross-package boundaries against 4-layer dependency direction rules.

Overall verdict: YELLOW
