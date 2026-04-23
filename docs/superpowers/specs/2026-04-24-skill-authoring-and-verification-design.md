# Skill Authoring & Verification — Design

- **Date:** 2026-04-24
- **Status:** Draft — awaiting user review
- **Author:** Basuru + Claude (brainstorming session)
- **Scope:** Two new skills in `company-plugin` + pre-commit hook wiring + follow-up discoverability audit of the existing 26 skills.

## 1. Background

The `company-plugin` ships 26 skills. They passed a 7-check workflow-compatibility audit on 2026-04-22/23 (all GREEN). However, two properties were *not* tested and are the motivating gaps for this spec:

1. **Discoverability in fresh sessions** — when a user starts a new project with `company-plugin` installed and types a prompt, does Claude reliably surface the right skill from 26 options? This is driven by the quality of the `description` frontmatter field (trigger signals, keyword coverage, stack naming), not by workflow-compatibility checks.
2. **Authoring consistency for future skills** — when someone adds a 27th skill, the current flow is ad-hoc. `superpowers:writing-skills` is the upstream authoring skill, but company-plugin has additional conventions (four-section Review checklist, sanctioned handoff markers, size target, stack-specific triggers) that aren't enforced anywhere.

This spec defines two new skills that close both gaps:

- **`skill-authoring`** — wraps `superpowers:writing-skills` with company conventions.
- **`skill-verification`** — verifies a skill meets company + superpowers standards, via manual command and auto pre-commit gate.

## 2. Problem statement

Today:

- Skills can be authored with weak descriptions that fail to surface them in fresh sessions. No automated check.
- Skills can drift from the four-section Review checklist shape, use prose handoffs instead of sanctioned markers, or exceed the size budget. Humans spotted these in the 2026-04-22 audit — we want a machine-runnable check.
- Nothing binds skill-authoring to the superpowers workflow graph: a new skill can be added without declaring how it interacts with upstream `superpowers:*` primitives or downstream company-plugin skills.
- Pre-commit has no skill-quality gate. Bad skills ship.

Goal: when a user installs `company-plugin` on a fresh project and starts a prompt, the right skills surface automatically through brainstorming and superpowers workflows, AND new skills added over time maintain that quality bar.

## 3. Approach — chosen

**B (preserve + extend).** The two new skills layer on top of `superpowers:writing-skills` without forking it. Agent Development (Anthropic) is kept as a secondary reference. Verification reuses the existing 7-check audit template at `docs/superpowers/testing-skills-against-workflows.md` rather than re-implementing it.

Rejected alternatives:
- **A (fork-and-customize)** — copy `writing-skills` into company-plugin and modify in place. Rejected: eternal upstream drift.
- **C (docs-only)** — a checklist in `docs/` with no skill. Rejected: not machine-runnable, misses pre-commit gate.

## 4. Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Verification trigger | Git pre-commit hook + manual slash command | Pre-commit catches every entry path (Claude, IDE, colleague PR). Manual covers mid-authoring. `PostToolUse` hook rejected: would fire on every incremental save. |
| Auto-hook scope | Static checks only | Fast (<5s), deterministic, no subagent costs |
| Manual-command scope | Static + full 7-check C1–C7 audit + optional dynamic pressure test | Full rigor on demand |
| Threshold | RED blocks commit, YELLOW passes with warning, GREEN silent | Matches the existing audit contract |
| Primary upstream | `superpowers:writing-skills` | Already integrated into plugin's skill graph |
| Secondary reference | `agent-development` (Anthropic) | Alternative patterns, complementary |
| Audit template reuse | `docs/superpowers/testing-skills-against-workflows.md` | Do not duplicate; verification skill invokes it |

## 5. Skill A — `skill-authoring`

### 5.1 Purpose

Wrap `superpowers:writing-skills` with company conventions. Invoked when creating a new skill, editing an existing skill, or scaffolding from an idea.

### 5.2 Frontmatter

```yaml
name: skill-authoring
description: Use when creating a new skill, editing an existing skill, or scaffolding a skill from an idea. Enforces company conventions on top of superpowers:writing-skills — four-section Review checklist, sanctioned handoff markers, size targets (200–400 lines), and discoverability requirements (strong description field with trigger signals, stack naming).
```

### 5.3 Interactions

- `**REQUIRED SUB-SKILL:** superpowers:writing-skills` — primary authoring flow (scaffolding, metadata, format)
- `**REQUIRED BACKGROUND:** superpowers:brainstorming` — every skill starts from a brainstorm
- `**REQUIRED BACKGROUND:** agent-development` — alternative patterns when `writing-skills` feels constraining
- `**Hands off to:** company-plugin:skill-verification` — after the skill is written, run verification before commit

### 5.4 Core rules

1. **Description MUST have trigger signals.** "Use when X" clause required. Optional "TRIGGER when:" / "SKIP when:" for sharp discrimination. No vague verbs ("handles", "manages", "deals with").
2. **Interactions section is mandatory.** Every skill declares at least one `**REQUIRED BACKGROUND:**` or `**Hands off to:**` tying it into the superpowers or company-plugin graph. Standalone skills are rejected.
3. **Review checklist uses the four-section shape.** Sections: `Summary`, `Findings` (with `file:line, severity, category, fix`), `Safer alternative`, `Checklist coverage` (labels: `PASS / CONCERN / NOT APPLICABLE`).
4. **Size budget.** 200–400 lines preferred, 500 is the hard ceiling. Over → split into sub-skills.
5. **Stack-relevant triggers.** Stack-specific skills (Next.js, NestJS, Prisma, AWS, React Native) must name the stack in the description so Claude can match it to user prompts.
6. **No duplicated primitives.** If a superpowers skill covers the same ground, use `**REQUIRED SUB-SKILL:**` or `**Does not duplicate:**` — do not re-implement.

### 5.5 Red flags

- Description starts with "This skill…" (declarative, not trigger-based)
- No Interactions section
- Flat checkbox Review checklist instead of four-section shape
- Prose handoff references ("see X", "use X", "feeds from X")
- Vague description verbs
- Size > 500 lines

### 5.6 Review checklist

Uses the company four-section shape. Verifies the skill produced by this skill meets rules 1–6.

## 6. Skill B — `skill-verification`

### 6.1 Purpose

Verify a named skill meets company + superpowers standards. Invoked manually for on-demand check, or automatically via pre-commit hook for every staged `SKILL.md`.

### 6.2 Frontmatter

```yaml
name: skill-verification
description: Use when verifying a skill before commit, reviewing an existing skill's compliance, or auditing skill discoverability. Runs authoring-guide compliance, handoff-marker hygiene, description-quality scoring, Review-checklist shape check, and (on-demand) the 7-check C1–C7 workflow-compatibility audit. Returns GREEN/YELLOW/RED verdict with findings.
```

### 6.3 Two modes

| Mode | Trigger | Checks | Cost |
|---|---|---|---|
| **Fast** | Pre-commit hook, auto | Static only (1–6 below) | <5s, no subagents |
| **Full** | `/skill-verification <name>`, manual | Static + 7-check C1–C7 + optional dynamic pressure-test | Minutes, subagent dispatch |

### 6.4 Interactions

- `**REQUIRED BACKGROUND:** superpowers:writing-skills` — shared standards
- `**REQUIRED BACKGROUND:** docs/superpowers/testing-skills-against-workflows.md` — the 7-check template (reused, not duplicated)
- `**Does not duplicate:** superpowers:requesting-code-review` — that's for code PRs; this is for skill authoring

### 6.5 Static checks (fast mode)

1. **Frontmatter validity** — `name` and `description` present; description ≥100 chars and contains a "Use when" clause.
2. **Section presence** — Core rules (or Rules), Red flags, Review checklist, Interactions with other skills.
3. **Review checklist shape** — four sections (Summary / Findings / Safer alternative / Checklist coverage); sanctioned labels.
4. **Handoff markers** — cross-skill refs use only sanctioned forms (`REQUIRED SUB-SKILL`, `REQUIRED BACKGROUND`, `Hands off to`, `Does not duplicate`). No prose refs.
5. **Size budget** — WARN 400+, FAIL 500+.
6. **Discoverability score** — description has trigger verbs ("Use when", "TRIGGER when"), names the domain/stack where relevant, mentions the problem it solves. Heuristic scoring, not a strict binary.

### 6.6 Full-mode extra checks

- **7-check C1–C7 audit** — reuses `docs/superpowers/testing-skills-against-workflows.md` via subagent dispatch.
- **Optional dynamic pressure-test** — dispatch a subagent to simulate workflow-insertion scenarios (e.g., "in a debugging flow where systematic-debugging handoffs to this skill, does it block, duplicate, or contradict?").

### 6.7 Output format

```
Verification: <skill-name>
Mode: fast | full
Verdict: GREEN | YELLOW | RED

Summary
-------
<one-paragraph status>

Findings
--------
| file:line | severity | category | fix |
|-----------|----------|----------|-----|
| ...       | FAIL     | markers  | ... |

Safer alternative
-----------------
<if any finding is YELLOW/RED, what to do instead>

Checklist coverage
------------------
- Frontmatter validity: PASS
- Section presence: CONCERN
- ...
```

### 6.8 Red flags (in its own operation)

- Silently passing RED to avoid blocking commits
- Running full mode in pre-commit (too slow, times out)
- Re-implementing 7-check logic instead of delegating to the template

## 7. Pre-commit hook wiring

### 7.1 File: `.husky/pre-commit` (or `.git/hooks/pre-commit`)

```bash
#!/usr/bin/env bash
set -e
staged=$(git diff --cached --name-only --diff-filter=ACM | grep -E '^skills/[^/]+/SKILL\.md$' || true)
[ -z "$staged" ] && exit 0

echo "Running skill-verification (fast mode) on staged skills..."
for f in $staged; do
  claude skill run company-plugin:skill-verification --mode fast --file "$f" || {
    echo "skill-verification FAILED for $f — commit blocked."
    exit 1
  }
done
```

### 7.2 Invocation surface

Exact CLI may differ from `claude skill run`. We prototype and adjust during implementation. If Claude Code's CLI doesn't expose a direct skill-invoke flag, fallback: a Node/TS script at `scripts/verify-skill.ts` that parses SKILL.md and runs the static checks without invoking Claude at all. That keeps the hook fast, offline-capable, and CI-friendly.

### 7.3 Opt-out

`git commit --no-verify` bypasses. We document this as "emergency only". No silent bypass.

## 8. Components and file layout

```
skills/
  skill-authoring/
    SKILL.md
  skill-verification/
    SKILL.md
docs/superpowers/specs/
  2026-04-24-skill-authoring-and-verification-design.md   # this file
scripts/
  verify-skill.ts    # optional fallback if CLI invocation isn't feasible
.husky/
  pre-commit         # wiring
```

## 9. Acceptance criteria

The spec lands successfully when:

- [ ] `skill-authoring` exists in `skills/`, passes its own verification
- [ ] `skill-verification` exists in `skills/`, passes its own verification
- [ ] Pre-commit hook runs fast-mode verification on staged SKILL.md changes
- [ ] Running `skill-verification` against all 26 existing skills reports their discoverability scores (follow-up audit cycle)
- [ ] Creating a test skill with an intentionally weak description triggers a RED/YELLOW verdict
- [ ] Committing a SKILL.md with a RED verdict is blocked

## 10. Out of scope

- Revising the 26 existing skills to fix discoverability gaps — separate cycle after verification skill exists.
- Fixing the plugin-disable / version-mismatch state (user runs `claude plugin install .` + `enable`) — mechanical prerequisite, not part of this spec.
- PostToolUse hook — decided against; pre-commit + manual slash command covers both paths.
- A web UI or reporting dashboard for verification results — CLI output is enough.

## 11. Risks and open questions

1. **CLI invocation of a plugin skill from a shell hook may not be first-class.** If `claude skill run` doesn't exist (or requires an active session), we fall back to a pure-TS/Node static checker script. Implementation plan needs to prototype this early.
2. **Discoverability scoring is heuristic.** Reasonable signals (trigger verbs, stack mention, problem statement) but not a guarantee. We may iterate after running against all 26 existing skills.
3. **Superpowers version bumps may change `writing-skills` contract.** Our thin wrapper depends on upstream shape. Mitigation: spot-check on each superpowers bump.
4. **Full-mode dynamic pressure-test is expensive.** Budget unclear. Mitigation: gate behind explicit flag (`--dynamic`), don't default-on even in manual mode.

## 12. Follow-ups (next specs)

- Discoverability audit of the 26 existing skills, targeted fix cycle.
- Consider splitting `resilience-and-error-handling` (642 lines, over budget).
- Dynamic C7 pressure-scenario test runs (deferred from 2026-04-23 audit).
