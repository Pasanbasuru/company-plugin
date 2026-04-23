# Compatibility audit — secrets-and-config-safety

Date: 2026-04-22
Source: skills/secrets-and-config-safety/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | PASS | Description starts with "Use when", includes "Do NOT use for" anti-triggers, references concrete triggers (env vars, secrets, config), does not summarize workflow. |
| C2 No HARD-GATE bypass           | PASS | No imperative implementation verbs ("write", "implement", "scaffold") found outside appropriate context. Skill is review-phase, not implementation-driving. |
| C3 No duplication                | PASS | No restating of TDD, systematic-debugging, verification, or worktree primitives. No unwanted primitive overlap. |
| C4 Correct handoff markers       | PASS | Cross-skill references use proper markers: "Hands off to" and "Does not duplicate" formats correct. Anti-triggers in description use backticks (acceptable). |
| C5 No Iron Law contradiction     | PASS | No rule forces violation of "NO CODE WITHOUT TEST", "NO FIX WITHOUT ROOT CAUSE", "NO CLAIM WITHOUT EVIDENCE", or "NO SKILL WITHOUT TEST FIRST". Rules are discipline-enforcing, not bypass-enabling. |
| C6 Review-mode output compat     | FAIL | Review checklist prescribes 5 sections (Summary, Findings, Env var inventory, NEXT_PUBLIC_* inventory, Checklist coverage) but authoring guide requires 4 (Summary, Findings, Safer alternative, Checklist coverage). Missing "Safer alternative" section; adds domain-specific inventories not in standard. |
| C7 Workflow-insertion simulation | N/A | Static checks show no gate-breaking. Skill attaches at code-review phase (06) post-implementation, where simulation deferred pending C6 resolution. |

## Findings (CONCERN or FAIL)

- skills/secrets-and-config-safety/SKILL.md § Review checklist — C6 shape mismatch — FAIL — Guide requires: Summary, Findings, Safer alternative, Checklist coverage. Skill prescribes: Summary, Findings, Env var inventory, NEXT_PUBLIC_* inventory, Checklist coverage. Replace inventories with "Safer alternative" section per authoring guide §Review checklist. This ensures consolidation with code-reviewer agent output remains parseable.

## Workflows this skill attaches to

- 06 — Code-review phase: skill triggers for PR review of application secrets, env config, and client-boundary handling.

Overall verdict: RED
