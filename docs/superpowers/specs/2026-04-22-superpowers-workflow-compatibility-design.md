# Superpowers Workflow Reference, Categorization, and Compatibility Audit — Design

Date: 2026-04-22
Owner: Basuru
Scope: `docs/superpowers/workflows/`, `skills-categorization.txt` (gitignored), `docs/superpowers/testing-skills-against-workflows.md`, audit reports for all 27 `skills/*`

## 1. Goal

Produce the artifacts needed to:

1. Give `company-plugin` a **canonical, verified, and living reference** for how `superpowers` v5.0.7 workflows actually fire inside Claude Code.
2. Give Basuru a **fast-to-scan categorization** of the 27 company-plugin skills.
3. Give the team a **testing procedure** that verifies new or edited company-plugin skills don't break superpowers workflows (filling the gap in `superpowers:writing-skills`, which tests skills in isolation but not for workflow compatibility).
4. **Apply that procedure** once across all 26 existing skills (including `_baseline`) so we know where we stand today.

Non-goals for this design: fixing any issues the audit surfaces (that's a follow-up cycle), introducing a diagram-rendering plugin, or modifying `superpowers` itself.

## 2. Constraints

| Constraint | Source |
|---|---|
| **No commits during this session.** User commits all artifacts manually after review. | User directive |
| `superpowers.md` at repo root is reference only — stays uncommitted. | User directive |
| `skills-categorization.txt` stays uncommitted. | User directive |
| Parallelize audits aggressively (subagents, single message fan-out). | User directive |
| Autonomous execution — no pauses for confirmation between pieces. | Basuru directive (2026-04-22) |
| Keep diagram tooling simple — stick with existing mermaid-in-markdown convention. | User directive ("keep simple for now") |
| Respect existing company-plugin skill-authoring conventions (`docs/superpowers/skill-authoring-guide.md`). | repo convention |

## 3. Why this work is needed

The gap analysis of `superpowers:writing-skills` (read in full — both `SKILL.md` and `testing-skills-with-subagents.md`):

| Concern | writing-skills covers it? |
|---|---|
| Rationalization resistance | ✅ yes — pressure-scenario TDD |
| CSO / description discipline | ✅ yes |
| Skill naming and structure | ✅ yes |
| Token efficiency | ✅ yes |
| **Skill does not fire at wrong point inside a superpowers workflow** | ❌ no |
| **Skill does not push Claude past a HARD-GATE (e.g., brainstorming → implementation)** | ❌ no |
| **Skill does not duplicate a superpowers primitive (TDD, verification, debugging)** | ❌ no |
| **Skill correctly uses `REQUIRED SUB-SKILL:` / `REQUIRED BACKGROUND:` markers when standing on superpowers** | ❌ no |
| **Skill's rules do not contradict superpowers Iron Laws** | ❌ no |
| **Skill's review-mode output does not conflict with the `code-reviewer` agent output inside `requesting-code-review`** | ❌ no |
| **Skill does not short-circuit the 1% gate in `using-superpowers`** | ❌ no |

Piece #3 (the testing template) codifies the seven missing checks above. Piece #4 applies them.

## 4. Approach: preserve + extend (two-layer reference)

Rejected: **(A) Lift-and-shift** (mix company-plugin nodes into the 8 superpowers diagrams). Rejected because every future skill change would contaminate the "known good" baseline used for compatibility testing, and the audit in piece #4 would become a moving target.

Rejected: **(C) Prompt-shape rewrite**. Rejected because it drifts from the verified superpowers source and makes diagram-accuracy audits harder to reproduce.

Chosen: **(B) Preserve + extend.** Layer 1 is a strict, audited transcription of the 8 superpowers 5.0.7 diagrams, origin-coloured with `extPlugin`. Layer 2 ("extension" diagram per workflow) shows where company-plugin skills *attach* to each workflow, origin-coloured with `companyPlugin`. Some workflows won't have a layer-2 extension (e.g., the meta writing-skills workflow doesn't directly host any company-plugin skill), and that's fine — we omit layer 2 rather than force it.

## 5. Piece #1 — workflow reference (audited + adapted)

### 5.1 File structure

```
docs/superpowers/workflows/
├── README.md                        # cheat sheet, shape legend, origin legend, file index
├── 01-universal-entry.md            # Diagram 1 — what happens on any prompt
├── 02-creative-work.md              # Diagram 2 — build/add/create
├── 03-bug-path.md                   # Diagram 3 — systematic-debugging
├── 04-subagent-execution.md         # Diagram 4 — subagent-driven execution
├── 05-parallel-agents.md            # Diagram 5 — dispatching parallel agents
├── 06-review-loop.md                # Diagram 6 — requesting + receiving review
├── 07-writing-skills.md             # Diagram 7 — meta skill-writing
└── 08-whole-map.md                  # Diagram 8 — everything
```

Each workflow file is structured:

```markdown
# Workflow <n> — <name>

Trigger shape: <e.g. "User says: build/add/create X">

## Diagram (superpowers core)

<mermaid diagram — strict transcription of superpowers 5.0.7 source, origin class `extPlugin`>

## Key gates and Iron Laws

- <bullet list — extracted from the diagram>

## Extension: where company-plugin skills attach  *(omitted if none apply)*

<mermaid diagram — adds `companyPlugin` nodes to specific points in the core flow>

- <table: company-plugin skill | attaches at | mode (guide/review) | does not duplicate>

## Compatibility notes

- What a new skill on this workflow must not do (the seven checks from piece #3, specialized to this workflow).
```

### 5.2 CSS class strategy

Every diagram gets two new `classDef` lines added to the existing 6:

```mermaid
classDef extPlugin     fill:#785f28d9,stroke:#b49b4b,stroke-width:1.25px,color:#e9e5d5
classDef companyPlugin fill:#1f5a5bd9,stroke:#4fb0b2,stroke-width:1.25px,color:#dff3f4
```

Shape classes (`hook`, `rule`, `skill`, `agent`, `gate`, `artifact`) are preserved — shape carries node type, origin class carries provenance. Mermaid supports multiple class assignments per node:

```mermaid
class US skill
class US extPlugin
class CAG skill
class CAG companyPlugin
```

Any node with no origin class defaults to "narrative / state" (plain rect). This was already the convention.

### 5.3 Diagram audit procedure

Source of truth: `C:/Users/basuru/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.7/`.

For each of the 8 diagrams, verify against source:

1. **Nodes** — every `skill`, `agent`, `hook`, `artifact`, `gate` in the diagram exists in the named file/folder at 5.0.7.
2. **Edges** — every arrow claim is backed by a cross-reference in the source (`REQUIRED SUB-SKILL:`, explicit next-step language, file-produced language).
3. **Gate text** — every decision diamond's text matches a real branch in the source SKILL.md.
4. **Iron Laws** — every hexagon's text matches a direct quote or clear paraphrase from the source.
5. **Hook flow** (Diagram 1 only) — verify `hooks/hooks.json`, `hooks/run-hook.cmd`, `hooks/session-start` chain.
6. **Agent prompt templates** (Diagram 4) — verify `implementer-prompt.md`, `spec-reviewer-prompt.md`, `code-quality-reviewer-prompt.md` exist and are referenced where shown.

Parallelized: dispatch 4 subagents, each auditing 2 diagrams. Each returns a `PASS | CORRECTIONS NEEDED` verdict plus a list of concrete diffs to apply.

### 5.4 Company-plugin extension diagrams (layer 2)

For each workflow, a short table is produced that answers: which of the 27 company-plugin skills *can* or *must* attach, and at which point? This informs what the layer-2 diagram contains.

Preliminary mapping (refined during execution):

| Workflow | Company-plugin skills that attach |
|---|---|
| 02 creative work | `architecture-guard` (during `brainstorming` design review), `nextjs-app-structure-guard` / `nestjs-service-boundary-guard` / `frontend-implementation-guard` / `mobile-implementation-guard` / `prisma-data-access-guard` / `state-integrity-check` (during `writing-plans` structure + data-access layout), `typescript-rigor` (during implementation), `accessibility-guard` / `performance-budget-guard` (during frontend implementation), `integration-contract-safety` / `queue-and-retry-safety` / `resilience-and-error-handling` (during integration/async implementation), `auth-and-permissions-safety` / `secrets-and-config-safety` (during any security-touching implementation), `test-strategy-enforcement` / `coverage-gap-detection` (during test writing), `change-risk-evaluation` / `rollback-planning` / `regression-risk-check` (during `finishing-a-development-branch`), `observability-first-debugging` (N/A here — belongs on bug path), `infra-safe-change` / `aws-deploy-safety` / `cicd-pipeline-safety` / `supply-chain-and-dependencies` (during finishing when deploy-touching) |
| 03 bug path | `observability-first-debugging` (during `systematic-debugging` Phase 1), plus any relevant domain guard (prisma, frontend, etc.) during Phase 4 implementation |
| 04 subagent execution | all guards apply inside the `Implementer` or reviewer subagents — as rules the subagent must respect, not as separate steps. Extension shows this via a "guardrails" cluster. |
| 05 parallel agents | minimal — guardrails apply within each parallel agent's scope |
| 06 review loop | `regression-risk-check` + `change-risk-evaluation` may accompany the superpowers `code-reviewer`; distinction: superpowers agent reviews against the plan, ours review domain risk |
| 07 writing-skills | the piece #3 testing template **extends** this workflow — a new step added after superpowers' GREEN phase: "test against each relevant workflow diagram" |
| 01, 08 | no layer-2 — these are meta/structural |

### 5.5 Out of scope for piece #1

- Rendering SVGs of the diagrams (user directive: "keep simple for now" — mermaid markdown only).
- Editing the original `superpowers.md` (user directive: reference only, do not commit). We'll gitignore it.

## 6. Piece #2 — skills categorization scratchpad

### 6.1 File

`./skills-categorization.txt` (repo root, gitignored).

### 6.2 Format

Plain text, scannable. Three axes:

1. **By what the skill protects** (already the structure in `docs/superpowers/specs/2026-04-22-skills-library-overhaul-design.md`).
2. **By when to invoke** (during planning, during implementation, during review/finishing, during debugging).
3. **By scope of impact** (app-wide, single file, single function).

Plus a fourth section: **"Where each skill attaches to superpowers workflows"** — one-line pointer into the Piece #1 workflows it shows up in. This is the bridge between Pieces 1, 2, 3, and 4.

### 6.3 Example entry

```
architecture-guard
  Category: Architecture & structure
  Invoke during: brainstorming (design review), writing-plans (structure layout)
  Scope: app-wide / cross-module
  Workflows: 02-creative-work (layer 2 extension)
  Mode: guide + review
```

## 7. Piece #3 — workflow-compatibility test template

### 7.1 Location

`docs/superpowers/testing-skills-against-workflows.md`

This is a **document**, not a new SKILL.md. Rationale: it's a testing procedure for authors, not an in-workflow skill Claude invokes. It's referenced from `docs/superpowers/skill-authoring-guide.md` as a required self-review step.

(Decision point during execution: if the procedure is mechanical enough to be a skill, we upgrade it to `skills/workflow-compatibility-testing/SKILL.md`. Default for now is doc.)

### 7.2 Seven checks

For each new or edited company-plugin skill, run these checks before committing:

| # | Check | Method |
|---|---|---|
| **C1** | Trigger correctness | Static: does `description` start with "Use when…" and include "Do NOT use for…"? Does it avoid workflow-summary language? Pressure: run the skill's `description` against 3 ambiguous prompts — does the agent invoke it only when appropriate? |
| **C2** | No HARD-GATE bypass | Static: do any of the skill's rules advise taking implementation action before spec approval, or committing without tests, or claiming success without verification? Workflow insertion: place the skill's invocation inside Workflow 02 between `brainstorming` and `writing-plans` — does the chain still honour the HARD-GATE? |
| **C3** | No duplication of a superpowers primitive | Static: grep the skill for rules that repeat `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `using-git-worktrees`, `finishing-a-development-branch`. If duplicated, convert the rule to a `**REQUIRED SUB-SKILL:** superpowers:<name>` marker. |
| **C4** | Correct handoff markers | Static: every reference to a superpowers skill uses `**REQUIRED SUB-SKILL:**` or `**REQUIRED BACKGROUND:**` — not `@` links, not raw paths. |
| **C5** | No Iron Law contradiction | Static + reasoning: for each company-plugin rule, does it contradict any of: "no code without failing test" / "no fix without root cause" / "no claim without fresh evidence" / "no skill without a failing test first" / 1%-rule invocation discipline? |
| **C6** | Review-mode output compatibility | Static: does the skill's `## Review checklist` produce output in a shape that can be consumed alongside the superpowers `code-reviewer` agent's report, without overlap or contradiction? Specifically, PASS/CONCERN/NOT APPLICABLE grading must match the contract. |
| **C7** | Workflow-insertion simulation | Pressure-scenario: for each workflow where the skill attaches (per Piece #2), a single-page scenario that forces the agent to navigate the workflow with the skill present. Agent must not skip superpowers gates, must not invoke the skill at the wrong moment, must not duplicate existing skill outputs. |

### 7.3 Report format

Each skill's audit produces:

```markdown
# Compatibility audit — <skill-name>

Date: YYYY-MM-DD
Source: skills/<skill-name>/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | PASS / CONCERN / FAIL / N/A | ... |
| C2 No HARD-GATE bypass           | ... |
| C3 No duplication                | ... |
| C4 Correct handoff markers       | ... |
| C5 No Iron Law contradiction     | ... |
| C6 Review-mode output compat     | ... |
| C7 Workflow-insertion simulation | ... |

## Findings (CONCERN or FAIL)

- <file:section — issue — fix>

## Workflows this skill attaches to

- 0X — <reason>
- ...

Overall verdict: GREEN | YELLOW | RED
```

### 7.4 Integration into authoring flow

`docs/superpowers/skill-authoring-guide.md` gets a new section: "Self-review before commit" expands with "Run the workflow-compatibility audit in `docs/superpowers/testing-skills-against-workflows.md` against your change. Paste the report into your PR description."

## 8. Piece #4 — parallel audit of 27 skills

### 8.1 Execution

Single message, 26 parallel `Agent` dispatches (one per skill in `skills/`, including `_baseline`). Each agent:

1. Receives: path to one `SKILL.md`, inlined copy of piece #3's 7 checks, inlined copy of all 8 workflow diagrams (or references to piece #1 files once written).
2. Produces: the report in piece #3 §7.3 format, returned as the agent's summary.

Grouping note: 26 agents is the "25× faster" ask. If token budget for parallel dispatch is a concern during execution, cluster into 6 groups of ~4-5 skills and run those in parallel instead. Default is per-skill.

### 8.2 Consolidation

Main context receives 27 summaries, writes:

- `docs/superpowers/audits/2026-04-22/<skill-name>.md` — one per skill, full report.
- `docs/superpowers/audits/2026-04-22/SUMMARY.md` — aggregate:
  - RED skills (list + top issue each) — need fixes
  - YELLOW skills — minor concerns, no immediate action
  - GREEN skills — fully compatible
  - Systemic patterns (e.g., "5 skills missing `REQUIRED SUB-SKILL:` markers for TDD")

### 8.3 No fixes in this cycle

Piece #5 (apply fixes) is out of scope for this session. The audit surfaces the work; the user decides which fixes to schedule.

## 9. Artifacts produced (execution checklist)

Pre-existing (untouched): `superpowers.md` (will be added to `.gitignore`).

New:

- [ ] `docs/superpowers/workflows/README.md`
- [ ] `docs/superpowers/workflows/01-universal-entry.md`
- [ ] `docs/superpowers/workflows/02-creative-work.md`
- [ ] `docs/superpowers/workflows/03-bug-path.md`
- [ ] `docs/superpowers/workflows/04-subagent-execution.md`
- [ ] `docs/superpowers/workflows/05-parallel-agents.md`
- [ ] `docs/superpowers/workflows/06-review-loop.md`
- [ ] `docs/superpowers/workflows/07-writing-skills.md`
- [ ] `docs/superpowers/workflows/08-whole-map.md`
- [ ] `skills-categorization.txt` (gitignored)
- [ ] `docs/superpowers/testing-skills-against-workflows.md`
- [ ] `docs/superpowers/audits/2026-04-22/<26 skill reports>.md`
- [ ] `docs/superpowers/audits/2026-04-22/SUMMARY.md`
- [ ] `.gitignore` with entries for `superpowers.md`, `skills-categorization.txt`, `bash.exe.stackdump`
  (the plan file in `docs/superpowers/plans/` is a committable artifact; user decides)

Not committed by Claude. User commits after review.

## 10. Execution sequencing

```
0. Write the plan (writing-plans skill) — docs/superpowers/plans/2026-04-22-superpowers-workflow-compatibility.md
1. Piece #1a — dispatch 4 diagram-audit agents IN PARALLEL         ┐
1. Piece #2  — write skills-categorization.txt                      ├ parallel
1. Piece #1b — write docs/superpowers/workflows/README.md           ┘
2. Piece #1c — write 8 per-workflow files (using audit results)
3. Piece #3  — write testing-skills-against-workflows.md
4. Piece #4  — dispatch 27 skill-audit agents IN PARALLEL
5. Piece #4  — write per-skill reports + SUMMARY.md
6. .gitignore — ensure all uncommitted artifacts stay uncommitted
7. Final summary to the user
```

## 11. Success criteria

- All files in §9 exist.
- Every diagram in `docs/superpowers/workflows/*.md` has a `PASS` audit verdict (or documented correction).
- `skills-categorization.txt` covers all 27 skills and is gitignored.
- `docs/superpowers/testing-skills-against-workflows.md` defines the 7 checks concretely enough that a new skill author can run them without further context.
- Every one of the 26 skills has a compatibility audit report, and `SUMMARY.md` lists RED/YELLOW/GREEN.
- `git status` shows the right things as untracked-and-ignored (`superpowers.md`, `skills-categorization.txt`, `bash.exe.stackdump`).
- No commits were made by Claude during this session.

## 12. Out of scope

- Applying fixes from the audit (piece #5 — follow-up).
- Diagram-rendering tooling / SVG generation.
- Modifications to `superpowers` itself.
- Modifications to existing company-plugin SKILLs (except as noted: **no** modifications in this session).
- Mobile-specific workflows beyond what already sits in `mobile-implementation-guard`.
