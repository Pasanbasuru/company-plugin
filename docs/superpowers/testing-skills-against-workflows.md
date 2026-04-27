# Testing Company-Plugin Skills Against Superpowers Workflows

Companion to `superpowers:writing-skills` and `superpowers:writing-skills/testing-skills-with-subagents.md`.
Use this **after** superpowers pressure-testing passes and **before** committing a new or edited global-plugin skill.

## Why this exists

`superpowers:writing-skills` tests a skill in isolation — it verifies the skill's rules resist rationalization under pressure. It does NOT verify that the skill fits inside the superpowers workflows (`brainstorming`, `writing-plans`, `subagent-driven-development`, etc.). A skill can be internally bulletproof and still misfire at the wrong point in a workflow — for example, by triggering during `brainstorming` and pushing Claude past the HARD-GATE that separates design from code.

This document closes that gap with seven concrete checks and a workflow-insertion procedure.

## Assumes `_baseline`. Adds: superpowers workflow awareness.

## The seven checks

### C1 — Trigger correctness

**Risk:** the skill's `description` field fires at the wrong moment in a workflow, hijacking Claude's attention away from the primary superpowers process skill (e.g., from `brainstorming` to a guard before design is even done).

**Method (static):**

- Description starts with `Use when …`.
- Description includes `Do NOT use for …` listing at least one anti-trigger.
- Description does NOT summarise the skill's workflow (per `superpowers:writing-skills` CSO rule — descriptions that summarise let Claude skip reading the body).
- Description references concrete triggers (file types, change types, symptoms) — not vague concepts.

**Method (dynamic, for discipline-heavy skills):**

- Give 3 ambiguous prompts that are *near* the skill's trigger but should not invoke it. Example for `architecture-guard`: "explain what a closure is in JavaScript". Check the agent does not invoke the skill.
- Give 3 clearly-on-trigger prompts. Check the agent does invoke it.

**Pass criteria:** off-trigger prompts produce no invocation; on-trigger prompts produce invocation.

---

### C2 — No HARD-GATE bypass

**Risk:** the skill suggests or enables an action that would violate a superpowers HARD-GATE. The two critical ones:

- `brainstorming` → implementation: no code until the spec is approved.
- `writing-plans` → execution: no execution until the plan is written and self-reviewed.
- `using-git-worktrees` → code: no code until the worktree exists and baseline tests are green.

**Method (static):**

- Grep the skill's rules for imperative verbs that would push Claude into implementation: `"write the code"`, `"implement"`, `"scaffold"`, `"create the file now"`, `"skip"`, `"go straight to"`.
- Confirm any such verb is guarded by a phrase that preserves the gate, or is in the skill's implementation-phase section (not design-phase).

**Method (dynamic):**

- Insert the skill's invocation hypothetically into Workflow 02 between `brainstorming` and `writing-plans`. Does the skill's guidance produce text that would let the agent skip the HARD-GATE? If yes, the skill fails.

**Pass criteria:** no imperative verb that bypasses a gate appears outside the skill's designated post-gate phase.

---

### C3 — No duplication of a superpowers primitive

**Risk:** the skill re-implements a rule that `superpowers` already owns. Duplicating creates drift between the skill and the primitive and causes conflicting outputs when both fire.

**Primitives owned by superpowers:**

- `test-driven-development` — RED → GREEN → REFACTOR, "no code without a failing test".
- `systematic-debugging` — 4-phase debugging, "no fix without root cause".
- `verification-before-completion` — "no claim without fresh evidence".
- `using-git-worktrees` — isolation before code.
- `finishing-a-development-branch` — merge/PR/discard options.
- `requesting-code-review` → `code-reviewer` agent — plan alignment + code quality + architecture.

**Method (static):**

- For each primitive above, grep the skill for any rule that restates it. Example: a rule saying "write tests first, then code" duplicates TDD — replace with `**REQUIRED SUB-SKILL:** superpowers:test-driven-development`.
- For each primitive, the skill should either say nothing about it, or explicitly cite it via a required-sub-skill marker.

**Pass criteria:** no duplicated rule; all superpowers primitives referenced via markers, not rewrites.

---

### C4 — Correct handoff markers

**Risk:** the skill references superpowers primitives using loose prose (e.g., "see the TDD skill") instead of the explicit `REQUIRED SUB-SKILL:` / `REQUIRED BACKGROUND:` markers Claude is trained to recognise.

**Method (static):**

- Grep the skill for any mention of another skill name. Each mention must use one of:
  - `**REQUIRED SUB-SKILL:** superpowers:<name>` (must invoke as sub-skill)
  - `**REQUIRED BACKGROUND:** superpowers:<name>` (must understand first)
  - `**Hands off to:** superpowers:<name>` (passes responsibility)
- `@`-style force-load references are forbidden (burns context pre-emptively).

**Pass criteria:** every cross-skill reference uses one of the sanctioned marker forms.

---

### C5 — No Iron Law contradiction

**Risk:** the skill's rules say something that directly or indirectly lets Claude violate a superpowers Iron Law. The four current Iron Laws:

1. **NO CODE WITHOUT FAILING TEST** (`test-driven-development`)
2. **NO FIX WITHOUT ROOT CAUSE** (`systematic-debugging`)
3. **NO CLAIM WITHOUT FRESH EVIDENCE** (`verification-before-completion`)
4. **NO SKILL WITHOUT A FAILING TEST FIRST** (`writing-skills`)

**Method (static + reasoning):**

- For each of the skill's rules, ask: "Would following this rule force — or merely allow — a violation of Iron Law 1, 2, 3, or 4?"
- "Allow" is not enough to fail the check. "Force" is a fail.
- Example of a fail: a rule that says "for hotfixes, commit before tests" — this forces a violation of Iron Law 1.
- Example of a pass: a rule that says "minimise test overhead for hotfixes" — this encourages restraint but does not force a violation.

**Pass criteria:** no rule forces an Iron Law violation.

---

### C6 — Review-mode output compatibility

**Risk:** the skill's `## Review checklist` section produces output that conflicts with the superpowers `code-reviewer` agent's output (structure, grading scheme, file:line format), making the consolidated review unparseable.

**Method (static):**

- Review checklist exists and follows the shape in `docs/superpowers/skill-authoring-guide.md`: four sections — Summary, Findings (file:line, severity, category, fix), Safer alternative, Checklist coverage (PASS / CONCERN / NOT APPLICABLE).
- Grading uses the three sanctioned labels: `PASS`, `CONCERN`, `NOT APPLICABLE`. Not `GREEN/YELLOW/RED`, not `OK/WARN/ERROR`.
- Every rule in the skill's `## Core rules` maps to exactly one line in the review checklist.

**Pass criteria:** review checklist shape matches the guide; grading labels match; every Core rule has a checklist entry.

---

### C7 — Workflow-insertion simulation

**Risk:** the skill works in isolation but breaks when placed into a live workflow. Only surfaced by simulation.

**Method (dynamic):**

1. Identify the workflows this skill attaches to (see `skills-categorization.txt` Section D, or re-derive from the skill's `## Interactions with other skills` section).
2. For each workflow:
   a. Open the corresponding `docs/superpowers/workflows/0X-*.md` file.
   b. Pick the exact phase where the skill attaches (e.g., inside `brainstorming`'s design-review step).
   c. Write a 1-paragraph user-prompt scenario whose natural flow passes through that phase. Example: "The user asks for a new feature X. Claude enters brainstorming. At the design-review step, the skill under test is invoked."
   d. Dispatch a subagent to play this out. Provide: the scenario, the workflow diagram, the skill under test.
   e. Verify the subagent:
      - Does NOT skip any superpowers gate in the workflow.
      - Does NOT invoke the skill at a different workflow point.
      - Does NOT produce output that conflicts with a parallel global-plugin skill also firing at the same point.
      - DOES invoke the skill at the expected point and produce the expected shape of output.
3. For discipline-style skills (those with hard "never …" rules), add pressure per `superpowers:testing-skills-with-subagents.md`:
   - Multiple pressures (time + sunk cost + exhaustion).
   - Force an explicit A/B/C choice.
   - Agent must still follow the skill's rule inside the workflow.

**Pass criteria:** subagent completes every target workflow without bypassing a superpowers gate, invokes the skill only at its attach point, and produces the expected output shape.

---

## How to run the full audit for one skill

1. **Static (10 min):** Do C1 (description inspection), C3 (duplication grep), C4 (marker grep), C5 (Iron Law reasoning), C6 (review checklist shape). These are pure SKILL.md reads.
2. **Workflow-insertion write-up (10 min):** For each workflow your skill attaches to, write the 1-paragraph scenario from C7 step 2c.
3. **Subagent dispatch (5 min):** Run one subagent per scenario in parallel. Collect reports.
4. **Consolidate:** Fill in the report template below.

## Report format

```markdown
# Compatibility audit — <skill-name>

Date: YYYY-MM-DD
Source: skills/<skill-name>/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | PASS / CONCERN / FAIL / N/A | <one line> |
| C2 No HARD-GATE bypass           | ... | ... |
| C3 No duplication                | ... | ... |
| C4 Correct handoff markers       | ... | ... |
| C5 No Iron Law contradiction     | ... | ... |
| C6 Review-mode output compat     | ... | ... |
| C7 Workflow-insertion simulation | ... | ... |

## Findings (CONCERN or FAIL)

- <file:section — issue — concrete fix>

## Workflows this skill attaches to

- 0X — <reason>

Overall verdict: GREEN | YELLOW | RED
```

**Verdict guide:**

- **GREEN** — every check PASS or N/A.
- **YELLOW** — any CONCERN, no FAIL. Skill is usable; fix at next convenience.
- **RED** — any FAIL. Skill must be fixed before next use or merge.

## Integration into the authoring flow

`docs/superpowers/skill-authoring-guide.md` §*Self-review before commit* gains a new step:

> **5. Workflow-compatibility audit.** Run the seven checks in `docs/superpowers/testing-skills-against-workflows.md` against your change. Paste the resulting report into your PR description. Skill cannot merge with a RED verdict.

## When individual checks do not apply

- `_baseline`: C1 (description trigger) and C6 (review-mode output) do NOT apply — `_baseline` is never invoked directly.
- Pure-reference skills (none exist today): C2 (HARD-GATE bypass) and C7 (workflow-insertion) may be N/A.
- Skills with no `## Review checklist` by design: C6 is N/A if the skill is guide-only. Document the reason.

## Relationship to `superpowers:writing-skills`

This document is **additive**. It runs AFTER superpowers' RED-GREEN-REFACTOR cycle passes. A skill with a bulletproof pressure-test record can still fail this audit — and vice-versa. Run both.

| Concern                                    | Covered by                                                          |
|--------------------------------------------|---------------------------------------------------------------------|
| Rationalization resistance                 | `superpowers:writing-skills` + `testing-skills-with-subagents.md`   |
| Description field discipline               | Both (here as C1, in superpowers as CSO)                            |
| Workflow placement / gate preservation     | **This document** (C2, C7)                                          |
| Primitive duplication                      | **This document** (C3)                                              |
| Handoff marker hygiene                     | **This document** (C4)                                              |
| Iron Law coherence                         | **This document** (C5)                                              |
| Review-mode output interop                 | **This document** (C6)                                              |
| Token efficiency / naming                  | `superpowers:writing-skills` (CSO)                                  |
