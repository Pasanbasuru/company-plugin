# Compatibility audit — mobile-implementation-guard

Date: 2026-04-22
Source: skills/mobile-implementation-guard/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | PASS | "Use when" and "Do NOT use for" present; concrete triggers (screens, navigation, native modules, OTA, offline UX); no workflow summary |
| C2 No HARD-GATE bypass           | PASS | No imperative verbs forcing code before spec/plan approval; all rules are architectural constraints |
| C3 No duplication                | PASS | Does not re-encode TDD, debugging, verification, git-worktrees, or finishing primitives |
| C4 Correct handoff markers       | PASS | Hands-off references use correct format (lines 278–281); cites state-integrity-check, integration-contract-safety, accessibility-guard |
| C5 No Iron Law contradiction     | PASS | No rule forces code without tests, fix without root cause, or claim without evidence |
| C6 Review-mode output compat     | CONCERN | Review Checklist lacks structured "Findings (file:line...)" section; uses checkbox list only; should include Summary, Findings with severity/category/fix, Safer alternative per authoring-guide §Review checklist |
| C7 Workflow-insertion simulation | PASS | Skill correctly attaches to brainstorming phase (per whole-map CPARCH cluster); no gate bypass risk |

## Findings (CONCERN or FAIL)
- skills/mobile-implementation-guard/SKILL.md::Review Checklist — Review checklist format incomplete — missing Summary, Findings (file:line format), and Safer alternative sections per authoring-guide §Review checklist. Keep checkbox list but wrap with structured report format for integration with code-reviewer agent output.

## Workflows this skill attaches to
- 02 (brainstorming) — architectural guardrails on Expo managed vs bare workflow, navigation structure, native module boundaries, platform-specific patterns, offline UX, EAS safety

Overall verdict: YELLOW
