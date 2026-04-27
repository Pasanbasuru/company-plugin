# Superpowers Workflows — as they run with global-plugin loaded

Source of truth: `superpowers` v5.0.7 at
`C:/Users/basuru/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.7/`.

Diagrams here are **audited** against that source on 2026-04-22 (see `docs/superpowers/specs/2026-04-22-superpowers-workflow-compatibility-design.md` and `docs/superpowers/plans/2026-04-22-superpowers-workflow-compatibility.md`). Corrections applied: see Workflow 05.

## How to read a workflow file

Each file has:

- **Layer 1 — superpowers core flow.** Strict transcription of the 5.0.7 source. Every node tagged with origin class `extPlugin`.
- **Layer 2 — where global-plugin skills attach.** A compact diagram plus a table showing which global-plugin skills attach at which phase and in which mode (guide / review). Nodes tagged `companyPlugin`. Absent when no global-plugin skill applies to this workflow.
- **Compatibility notes.** What a new or edited global-plugin skill attached to this workflow must not do. These feed the audit template at `docs/superpowers/testing-skills-against-workflows.md`.

## Shape legend

| Shape          | Type       | Mermaid syntax |
|----------------|------------|----------------|
| Stadium        | hook       | `([…])`        |
| Hexagon        | rule       | `{{…}}`        |
| Rectangle      | skill      | `[…]`          |
| Double rect    | agent      | `[[…]]`        |
| Diamond        | gate       | `{…}`          |
| Cylinder       | artifact   | `[(…)]`        |

Plain rectangles with no class are narrative / user-action / intermediate-state nodes.

## Origin legend

| Class          | Meaning                                                   | Colour          |
|----------------|-----------------------------------------------------------|-----------------|
| `extPlugin`    | Ships from `superpowers` or another external plugin       | amber `#785f28` |
| `companyPlugin`| Ships from this `global-plugin`                          | teal  `#1f5a5b` |
| (none)         | Narrative / state / user action                           | plain           |

Mermaid allows multiple class assignments per node. Every node gets one **shape** class (hook/rule/skill/agent/gate/artifact) AND one **origin** class (extPlugin/companyPlugin). For example:

```
class US skill
class US extPlugin
class CAG skill
class CAG companyPlugin
```

## File index

| # | Workflow                                   | File                            | Layer 2? |
|---|--------------------------------------------|---------------------------------|----------|
| 1 | Universal entry — any prompt arrives       | `01-universal-entry.md`         | no       |
| 2 | Creative work — build / add / create       | `02-creative-work.md`           | yes (rich) |
| 3 | Bug path — crash / failure / regression    | `03-bug-path.md`                | yes      |
| 4 | Subagent execution loop                    | `04-subagent-execution.md`      | yes (guardrail cluster) |
| 5 | Parallel agents                            | `05-parallel-agents.md`         | yes (minimal) |
| 6 | Review loop                                | `06-review-loop.md`             | yes      |
| 7 | Writing / testing a skill                  | `07-writing-skills.md`          | yes (compatibility test hook) |
| 8 | The whole map                              | `08-whole-map.md`               | yes      |

## Cheat sheet — "given a prompt, what fires?"

| Prompt shape | Superpowers chain | Company-plugin skills attached | Key gates |
|---|---|---|---|
| Any prompt | `SessionStart` hook → `using-superpowers` | (none at gate; downstream only) | 1% rule |
| "Build / add / create X" | `brainstorming` → `using-git-worktrees` → `writing-plans` → (`subagent-driven-development` \| `executing-plans`) → `finishing-a-development-branch` | `architecture-guard`, `*-app-structure-guard`, `*-implementation-guard`, data/security/integration guards, `typescript-rigor`, `a11y-guard`, `performance-budget-guard`, `test-strategy-enforcement`, `coverage-gap-detection`, finish-phase ops skills | HARD-GATE: design approved; worktree required |
| "Fix bug / test failure / crash" | `systematic-debugging` → `test-driven-development` → `verification-before-completion` | `observability-first-debugging` (Phase 1), domain guards (Phase 4) | No fix without root cause; 3+ failures → question architecture |
| "Execute plan" (recommended path) | `subagent-driven-development` → `finishing-a-development-branch` | guardrail cluster applies inside Implementer subagent | Two-stage review: spec first, then quality |
| "Execute plan" (parallel session) | `executing-plans` → `finishing-a-development-branch` | guardrail cluster | Stop if plan gaps |
| "Fix these N independent tests" | `dispatching-parallel-agents` → `verification-before-completion` | `regression-risk-check` (post-parallel cross-check) | Only fan out if truly independent |
| "Review my work / before merging" | `requesting-code-review` → `code-reviewer` agent → `receiving-code-review` | `change-risk-evaluation`, `regression-risk-check`, `rollback-planning`, plus domain guards | No performative agreement |
| "About to claim something works" | `verification-before-completion` | — | Run the command THIS message |
| "Write / edit a skill" | `writing-skills` (REQUIRED BACKGROUND: `test-driven-development`) | **+ `docs/superpowers/testing-skills-against-workflows.md` audit** | No skill without a failing test first; no skill commit without a GREEN workflow audit |

## Related documents

- **Test template:** `docs/superpowers/testing-skills-against-workflows.md` — the 7 compatibility checks every new or edited global-plugin skill must pass.
- **Per-skill audit reports:** `docs/superpowers/audits/2026-04-22/` — one report per skill + `SUMMARY.md`.
- **Skill authoring guide:** `docs/superpowers/skill-authoring-guide.md`.
- **Categorization scratchpad (gitignored, local only):** `skills-categorization.txt`.
