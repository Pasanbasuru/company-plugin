---
name: skill-authoring
description: "Use when creating a new skill, editing an existing skill, or scaffolding a skill from an idea. Enforces company conventions on top of superpowers:writing-skills — four-section Review checklist, sanctioned handoff markers, size targets (200–400 lines), and discoverability requirements (strong description field with trigger signals, stack naming)."
---

# skill-authoring

Wraps `superpowers:writing-skills` with company conventions for the `company-plugin`.

## When to use
- Creating a new skill in `skills/<name>/SKILL.md`
- Editing an existing skill's structure or metadata
- Scaffolding a skill from a brainstorm output

## Core rules

1. **Description MUST have trigger signals.** Start with `Use when ...`. Add `TRIGGER when:` / `SKIP when:` for sharp discrimination. No vague verbs ("handles", "manages", "deals with").
2. **Interactions section is mandatory.** Every skill declares at least one `**REQUIRED BACKGROUND:**`, `**REQUIRED SUB-SKILL:**`, `**Hands off to:**`, or `**Does not duplicate:**` tying it into the superpowers or company-plugin graph.
3. **Review checklist uses the four-section shape.** Sections: `Summary`, `Findings` (table: file:line, severity, category, fix), `Safer alternative`, `Checklist coverage` (labels: `PASS / CONCERN / NOT APPLICABLE`).
4. **Size budget.** 200–400 lines preferred, 500 hard ceiling. Over → split.
5. **Stack-relevant triggers.** Stack-specific skills (Next.js, NestJS, Prisma, AWS, React Native) name the stack in the description so Claude can match against user prompts.
6. **No duplicated primitives.** Use `**REQUIRED SUB-SKILL:**` or `**Does not duplicate:**` instead of re-implementing superpowers skills.

## Red flags

- Description starts with "This skill…" (declarative, not trigger-based)
- No Interactions section
- Flat checkbox Review checklist instead of four-section shape
- Prose handoff references ("see X", "use X", "feeds from X")
- Vague description verbs
- Size > 500 lines

## Authoring flow

1. Run `superpowers:brainstorming` to pin down the skill's purpose and attach point.
2. Follow `superpowers:writing-skills` for file layout and metadata.
3. Apply company conventions from the Core rules above.
4. Hand off to `company-plugin:skill-verification` before committing.

## Good vs bad

### description field

Bad: `description: Handles frontend architecture concerns.`

Good: `description: Use when reviewing or scaffolding a Next.js App Router structure for route organization, layout boundaries, and server/client component placement. TRIGGER when: user edits files under app/. SKIP when: Pages Router is in use.`

### Interactions

Bad:
```
#### Interactions with other skills
- @see superpowers:tdd for testing
```

Good:
```
#### Interactions with other skills
- **REQUIRED SUB-SKILL:** superpowers:test-driven-development
- **Hands off to:** company-plugin:skill-verification
```

## Review checklist

### Summary
One paragraph on whether the authored skill meets company conventions.

### Findings
| file:line | severity | category | fix |
| - | - | - | - |

### Safer alternative
If the skill re-implements a superpowers primitive, replace with a sub-skill marker.

### Checklist coverage
- Rule 1 (description trigger signals): PASS / CONCERN / NOT APPLICABLE
- Rule 2 (Interactions section): PASS / CONCERN / NOT APPLICABLE
- Rule 3 (Review checklist shape): PASS / CONCERN / NOT APPLICABLE
- Rule 4 (size budget): PASS / CONCERN / NOT APPLICABLE
- Rule 5 (stack-relevant triggers): PASS / CONCERN / NOT APPLICABLE
- Rule 6 (no duplicated primitives): PASS / CONCERN / NOT APPLICABLE

## Interactions with other skills
- **REQUIRED SUB-SKILL:** superpowers:writing-skills
- **REQUIRED BACKGROUND:** superpowers:brainstorming
- **REQUIRED BACKGROUND:** agent-development
- **Hands off to:** company-plugin:skill-verification
