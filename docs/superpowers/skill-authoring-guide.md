# Skill authoring guide

How to write a `SKILL.md` for the `global-plugin` library. Read this before creating or rewriting a skill.

## Authoring flow

1. Run `superpowers:brainstorming` to pin down the skill's purpose and attach point.
2. Follow `superpowers:writing-skills` for file layout and metadata.
3. Apply the company conventions in this guide.
4. Run `pnpm verify plugin/skills/<name>/SKILL.md` before committing. (See `.claude/skills/skill-verification/` for the procedural skill.)

## Templates and standards reference

Do not hand-roll a new SKILL.md from scratch — start from the `superpowers:writing-skills` skill scaffold.

## File layout

One folder per skill, one file per folder:

```
skills/<skill-name>/SKILL.md
```

No `references/`, no scripts, no assets.

## Section order

Every domain skill's `SKILL.md` follows this exact order:

1. **YAML frontmatter** with `name`, `description`, `allowed-tools`.
2. `# <Skill Title>`
3. `## Purpose & scope` — 2–3 sentences.
4. `## Core rules` — numbered list. Each rule is one sentence + a `*Why:*` line.
5. `## Red flags` — table of `Thought | Reality` pairs.
6. `## Good vs bad` — 2–3 subsections, each with a `Bad:` and `Good:` code block.
7. Domain-specific `##` sections (deep dives).
8. `## Interactions with other skills` — explicit owns / hands-off / does-not-duplicate bullets.
9. `## Review checklist` — prescribed report format for review-mode invocations.

## Writing the `description`

**Description MUST have trigger signals.** The frontmatter `description` is how Claude decides whether to apply the skill. A declarative description ("This skill handles…") is a discard signal — Claude skips it. Start with `Use when …` and add `TRIGGER when:` / `SKIP when:` clauses for sharp discrimination. Avoid vague verbs ("handles", "manages", "deals with").

*Why:* A vague description means the skill never auto-loads; a declarative one means Claude reads the description as a summary and skips the body entirely.

The description must contain:

- **Use when** — the trigger.
- **TRIGGER when:** — optional sharp-match clause for file-level or token-level signals.
- **SKIP when:** — the anti-trigger (at least one).
- **Covers** — comma-separated scope tags.

**Stack-relevant skills** (Next.js, NestJS, Prisma, AWS, React Native) must name the stack explicitly in the description so Claude can match against user prompts.

Example:

```yaml
description: Use when touching Prisma queries, schema, or migrations. TRIGGER when: user edits files under prisma/ or imports @prisma/client. SKIP when: schema design decisions without a concrete query (use architecture-guard instead). Covers query shape, N+1, transactions, migration safety, index usage.
```

## Rule writing

- Each rule is imperative ("Do X", "Never Y"), not aspirational ("Try to X").
- Each rule ends with a `*Why:*` line giving the consequence of breaking it.
- A rule must be testable — a reviewer must be able to say PASS, CONCERN, or NOT APPLICABLE.

## Red flags

A thought Claude might have that signals the skill is being ignored, paired with why it's wrong.

| Thought | Reality |
|---|---|
| "This query is simple, no transaction needed" | Two writes without a transaction is a partial-failure bug. |
| Description starts with "This skill…" | Declarative, not trigger-based — Claude will skip the skill body. |
| No Interactions section in the skill | Every skill must declare its graph position. |
| Flat checkbox Review checklist | Must use the four-section shape: Summary / Findings / Safer alternative / Checklist coverage. |
| Prose handoff references ("see X", "use X") | Use structured markers: `**Hands off to:**`, `**REQUIRED SUB-SKILL:**`. |
| Skill is over 500 lines | Hard ceiling — propose a split before committing. |

## Good vs bad

### description field

Bad: `description: Handles frontend architecture concerns.`

Good:
```yaml
description: Use when reviewing or scaffolding a Next.js App Router structure for route organization, layout boundaries, and server/client component placement. TRIGGER when: user edits files under app/. SKIP when: Pages Router is in use.
```

### Interactions section

Bad:
```
#### Interactions with other skills
- @see superpowers:tdd for testing
```

Good:
```
#### Interactions with other skills
- **REQUIRED SUB-SKILL:** superpowers:test-driven-development
- **Hands off to:** skill-verification (project-local maintainer skill at `.claude/skills/skill-verification/`; not shipped to consumers).
- **Does not duplicate:** architecture-guard's schema ownership concerns.
```

### Core rules snippet

Bad:
```
- Keep queries simple.
- Use transactions when appropriate.
```

Good:
```
1. **Never issue two writes outside a transaction.** *Why:* Partial failure leaves data inconsistent in ways that are hard to detect.
2. **Always select only the columns you need.** *Why:* Over-fetching causes N+1 amplification at scale.
```

## Interactions

State ownership explicitly. If two skills could apply, say who owns what. The Interactions section is mandatory — every skill declares at least one `**Owns:**`, `**Hands off to:**`, `**REQUIRED SUB-SKILL:**`, `**REQUIRED BACKGROUND:**`, or `**Does not duplicate:**` marker. Use these structured markers instead of prose references ("see X", "use X", "feeds from X") so the skill graph is machine-readable.

*Why:* Skills without an Interactions section cannot be audited for overlap, and Claude has no signal for when to hand off.

Example:
```
- **Owns:** query shape, transactions, migrations.
- **Hands off to:** state-integrity-check for cache invalidation after writes.
- **Does not duplicate:** architecture-guard's schema ownership concerns.
- **REQUIRED SUB-SKILL:** superpowers:writing-skills
```

**No duplicated primitives.** Use `**REQUIRED SUB-SKILL:**` or `**Does not duplicate:**` instead of re-implementing superpowers skills inline.

*Why:* Duplication creates two diverging sources of truth and bloats every skill's line count past the size budget.

## Review checklist

Prescribe a markdown report with exactly four sections:

### Summary
One paragraph on whether the authored skill meets company conventions.

### Findings
| file:line | severity | category | fix |
| - | - | - | - |

### Safer alternative
If the skill re-implements a superpowers primitive, replace with a sub-skill marker.

### Checklist coverage
Report PASS / CONCERN / NOT APPLICABLE per rule:
- Rule 1 (description trigger signals): PASS / CONCERN / NOT APPLICABLE
- Rule 2 (Interactions section): PASS / CONCERN / NOT APPLICABLE
- Rule 3 (Review checklist shape): PASS / CONCERN / NOT APPLICABLE
- Rule 4 (size budget): PASS / CONCERN / NOT APPLICABLE
- Rule 5 (stack-relevant triggers): PASS / CONCERN / NOT APPLICABLE
- Rule 6 (no duplicated primitives): PASS / CONCERN / NOT APPLICABLE

## Size target

200–400 lines per `SKILL.md`. Hard ceiling at 500 lines — if you hit it, the skill is doing too much. Propose a split.

## Self-review before commit

1. **Placeholder scan:** no `TBD`, `TODO`, `handle appropriately`, `add error handling` without specifics.
2. **Overlap check:** if another skill owns a concern, hand off rather than re-encode.
3. **Testability:** every rule is checkable as PASS / CONCERN / NOT APPLICABLE.
