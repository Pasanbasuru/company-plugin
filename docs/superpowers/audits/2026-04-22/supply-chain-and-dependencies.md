# Compatibility audit — supply-chain-and-dependencies

Date: 2026-04-22
Source: skills/supply-chain-and-dependencies/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | PASS | Description has "Use when", "Do NOT use for", concrete scope tags (lockfile discipline, SCA, pinned versions, license policy, peer-dep drift, typosquat). |
| C2 No HARD-GATE bypass           | PASS | Skill is review-phase only; enforces auditing and evaluation before merge, preserves all superpowers gates (no imperative code directives outside post-gate phase). |
| C3 No duplication                | PASS | Owns supply-chain domain; does not duplicate TDD, debugging, verification, worktrees, or code-review primitives. Hands off to cicd-pipeline-safety, performance-budget-guard. |
| C4 Correct handoff markers       | PASS | Uses "Hands off to:" with backtick-quoted skill names; no loose prose or force-load @-references. |
| C5 No Iron Law contradiction     | PASS | All rules (lockfile, pinned versions, SCA, new-dep evaluation, license policy, peer-deps, postinstall review) support determinism and verification; no forced violations. |
| C6 Review-mode output compat     | PASS | Checklist has Summary, Findings (file:line, severity, category, fix), Checklist coverage with PASS/CONCERN/NOT APPLICABLE per core rule. Aligns with authoring-guide and code-reviewer consolidation. |
| C7 Workflow-insertion simulation | PASS | Attaches to 02 (finish-phase risk review of dependencies) and 06 (review-loop alongside code-reviewer). Both review-phase; produces standard output; does not trigger mid-workflow. |

## Findings (CONCERN or FAIL)

none

## Workflows this skill attaches to

- 02 — Finish-phase dependency review in creative-work workflow (dependencies added/updated)
- 06 — Code review phase alongside code-reviewer (quality and supply-chain posture)

Overall verdict: GREEN
