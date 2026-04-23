# Compatibility audit — auth-and-permissions-safety

Date: 2026-04-22
Source: skills/auth-and-permissions-safety/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | PASS | Description uses "Use when touching authentication, sessions, JWT/tokens..." with clear anti-triggers: "Do NOT use for infra-level IAM". References concrete artifacts (JWTs, sessions, RBAC). No workflow summarization. |
| C2 No HARD-GATE bypass           | PASS | No imperative implementation verbs ("write code", "scaffold", "implement") outside their proper phase. All rules are design/review guidance; no direct code production directives. |
| C3 No duplication                | PASS | No restating of test-driven-development, systematic-debugging, verification-before-completion, or other superpowers primitives. Skill is domain-focused on application-level auth semantics. |
| C4 Correct handoff markers       | PASS | Two handoff references use correct markers: "Hands off to: `infra-safe-change` for IAM roles..." and "...`secrets-and-config-safety` for JWT secret...". No loose prose; no @ force-loads. |
| C5 No Iron Law contradiction     | PASS | No rule forces a violation of Iron Laws 1–4. Skill governs auth logic verification and review; does not override test-first, root-cause-driven debugging, or evidence-based claims. |
| C6 Review-mode output compat     | CONCERN | Review checklist section prescribes non-standard grading labels and structure. Uses "Summary", "Findings", "Endpoint inventory", "Checklist coverage" instead of guide format: Summary, Findings (with file:line/severity/category/fix), Checklist coverage (PASS/CONCERN/NOT APPLICABLE). Grades as "PASS / CONCERN / NOT APPLICABLE" in text but outputs must align with code-reviewer consolidation. |
| C7 Workflow-insertion simulation | PASS | Skill attaches correctly to Workflow 02, "plan structure" phase (Line 155 in workflow). Trigger: "Auth-touching code". Mode: guide + review. No gate bypass observed; skill fires at expected point between `writing-plans` (design finalized) and implementation. |

## Findings (CONCERN or FAIL)

- `SKILL.md:230–244` — Review checklist structure deviates from guide norm. Prescribes custom "Endpoint inventory" section instead of singular "Findings" block with file:line/severity/category/fix tuples. Suggests using "PASS / CONCERN / NOT APPLICABLE" in numbered rules (Rules 1–8) but template example shows different grouping. Consolidation with `code-reviewer` output (Workflow 6, Layer 2) assumes matching PASS/CONCERN/NOT APPLICABLE grading, but endpoint-level inventory may produce redundant or conflicting output when both skills review the same code. **Fix:** Align Review checklist to `docs/superpowers/skill-authoring-guide.md` template: one Summary line, one Findings block (file:line format), one Checklist coverage block mapping 8 core rules to PASS/CONCERN/NOT APPLICABLE.

## Workflows this skill attaches to

- 02 (creative-work) — Plan structure phase: "Auth-touching code" per Workflow 02 Layer 2 table, line 155. Fires inside `writing-plans`, post-HARD-GATE, as guide + review.

Overall verdict: YELLOW
