# Compatibility audit — frontend-implementation-guard

Date: 2026-04-22
Source: skills/frontend-implementation-guard/SKILL.md

| Check | Verdict | Notes |
|---|---|---|
| C1 Trigger correctness           | PASS | Description: "Use when writing or reviewing React components, hooks, component-level state, or data-fetching at the component layer." Lists 3 anti-triggers (Next.js routing, accessibility, bundle/runtime perf). Concrete file type / feature triggers. |
| C2 No HARD-GATE bypass           | PASS | No imperative "write the code", "implement now", "scaffold", "skip" verbs found. Skill is read-only design review; rules only guide component structure without forcing implementation. |
| C3 No duplication                | PASS | Does not restate baseline TypeScript, testing, observability, or security rules. References TanStack Query (not owned by superpowers) and React rules (domain-specific). No duplication of superpowers primitives. |
| C4 Correct handoff markers       | PASS | Uses "**Hands off to:**" marker for: `nextjs-app-structure-guard`, `accessibility-guard`, `performance-budget-guard`, `state-integrity-check`, `typescript-rigor`. Proper backtick-wrapped names. No force-load `@` references. |
| C5 No Iron Law contradiction     | PASS | Rules 2, 4, 6 implicitly rely on testability and hook discipline (Iron Law 1: "NO CODE WITHOUT FAILING TEST"), but do not force violations. Rule 6 explicitly mandates `eslint-plugin-react-hooks` enforcement, which is a gate, not a bypass. No rule allows code without tests or claims without evidence. |
| C6 Review-mode output compat     | PASS | Review checklist exists with correct four-section structure: Summary, Findings (file:line, severity label: blocking/concern/info), Safer alternative, Checklist coverage. Grading uses sanctioned labels (PASS, CONCERN, NOT APPLICABLE). All 7 Core rules map to exactly 7 checklist entries. |
| C7 Workflow-insertion simulation | PASS | Skill attaches to Workflow 02 at design-review phase (brainstorming step). Description fields explicitly exclude Next.js/a11y/perf concerns to avoid cross-phase invocation. Attach point aligns with table in workflow docs (line 148: "Design review — frontend-implementation-guard — guide + review — Any UI change"). Read-only mode during brainstorming. |

## Findings (CONCERN or FAIL)
- none

## Workflows this skill attaches to
- 02 — Design review phase in brainstorming. Invoked on any UI change before plan writing.

Overall verdict: GREEN
