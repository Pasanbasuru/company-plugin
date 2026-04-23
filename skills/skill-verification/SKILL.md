---
name: skill-verification
description: "Use when verifying a skill before commit, reviewing an existing skill's compliance, or auditing skill discoverability. Runs authoring-guide compliance, handoff-marker hygiene, description-quality scoring, Review-checklist shape check, and (on-demand) the 7-check C1–C7 workflow-compatibility audit. Returns GREEN/YELLOW/RED verdict with findings."
---

# skill-verification

Verifies a skill meets company + superpowers standards. Fast mode runs statically (pre-commit hook). Full mode adds the 7-check C1–C7 workflow-compatibility audit via subagent dispatch.

## Modes

| Mode | Trigger | Checks | Cost |
|---|---|---|---|
| Fast | Auto (pre-commit hook) or manual for one skill | Static (frontmatter, sections, checklist shape, markers, size, discoverability) | <5s |
| Full | Manual invocation only | Fast checks + 7-check C1–C7 audit, optional dynamic pressure test | Minutes, subagent dispatch |

## How to run

**Fast mode (CLI):**

```bash
pnpm verify skills/<name>/SKILL.md
```

Exit 0 = GREEN. Exit 1 = RED. stdout includes YELLOW findings.

**Full mode (Claude-driven):**

When invoked from a Claude session, dispatch a subagent using the audit template at `docs/superpowers/testing-skills-against-workflows.md`. Provide the skill's path; subagent returns a 7-check verdict table.

## Core rules

1. **Fast-mode check set is fixed.** frontmatter, sections, review-checklist, markers, size, discoverability. Changing the set is a versioning event.
2. **Verdict mapping is fixed.** Any FAIL → RED. Any CONCERN (no FAIL) → YELLOW. All PASS → GREEN.
3. **Never silently pass RED.** If the hook is misbehaving, fix the hook — do not bypass.
4. **Full mode is manual only.** Subagent dispatch is expensive; do not run it in a pre-commit hook.
5. **Do not duplicate the 7-check audit.** Delegate to `docs/superpowers/testing-skills-against-workflows.md`.

## Red flags

- Marking a check as PASS when findings exist
- Running full mode in pre-commit
- Re-implementing the 7-check audit inline
- Adding "skip if" escape hatches to the hook
- Changing thresholds without updating the spec

## Good vs bad

### Fast-mode output

Bad: `LGTM 👍`

Good (example output block):

```
Verification: my-skill
Mode: fast
Verdict: YELLOW

Checklist coverage
- frontmatter: PASS
- sections: PASS
- review-checklist: CONCERN
- markers: PASS
- size: PASS
- discoverability: PASS

Findings
- [CONCERN] review-checklist: non-sanctioned label 'CRITICAL'
    fix: Use only: PASS, CONCERN, NOT APPLICABLE
```

## Review checklist

### Summary
One paragraph on whether `skill-verification` itself operates to spec.

### Findings
| file:line | severity | category | fix |
| - | - | - | - |

### Safer alternative
If the full-mode audit is slow or flaky, run fast-mode only and schedule the 7-check audit separately.

### Checklist coverage
- Rule 1 (fixed check set): PASS / CONCERN / NOT APPLICABLE
- Rule 2 (verdict mapping): PASS / CONCERN / NOT APPLICABLE
- Rule 3 (no silent pass): PASS / CONCERN / NOT APPLICABLE
- Rule 4 (full mode manual): PASS / CONCERN / NOT APPLICABLE
- Rule 5 (no audit duplication): PASS / CONCERN / NOT APPLICABLE

## Interactions with other skills
- **REQUIRED BACKGROUND:** superpowers:writing-skills
- **Does not duplicate:** superpowers:requesting-code-review
- **Hands off to:** superpowers:writing-plans
