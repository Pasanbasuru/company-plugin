# Skill authoring guide

How to write a `SKILL.md` for the `company-plugin` library. Read this before creating or rewriting a skill.

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
4. `` ## Assumes `_baseline`. Adds: `` — one line naming the additional domain.
5. `## Core rules` — numbered list. Each rule is one sentence + a `*Why:*` line.
6. `## Red flags` — table of `Thought | Reality` pairs.
7. `## Good vs bad` — 2–3 subsections, each with a `Bad:` and `Good:` code block.
8. Domain-specific `##` sections (deep dives).
9. `## Interactions with other skills` — explicit owns / hands-off / does-not-duplicate bullets.
10. `## Review checklist` — prescribed report format for review-mode invocations.

## Writing the `description`

The frontmatter `description` is how Claude decides whether to apply the skill. It must contain:

- **Use when** — the trigger.
- **Do NOT use for** — the anti-trigger (at least one).
- **Covers** — comma-separated scope tags.

Example:

```yaml
description: Use when touching Prisma queries, schema, or migrations. Do NOT use for schema design decisions without a concrete query (use architecture-guard instead). Covers query shape, N+1, transactions, migration safety, index usage.
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

## Good vs bad snippets

Keep each snippet under 20 lines. Only snippets that illustrate a rule from `Core rules` — no generic examples.

## Interactions

State ownership explicitly. If two skills could apply, say who owns what:

```
- **Owns:** query shape, transactions, migrations.
- **Hands off to:** state-integrity-check for cache invalidation after writes.
- **Does not duplicate:** architecture-guard's schema ownership concerns.
```

## Review checklist

Prescribe a markdown report with four sections: Summary, Findings (file:line, severity, category, fix), Safer alternative, Checklist coverage (PASS / CONCERN / NOT APPLICABLE per rule).

## What every skill assumes

- `_baseline` is in effect. Do not restate TypeScript strict, observability floor, testing floor, etc.
- The stack pinned in `_baseline` (Next.js 15, NestJS 11, Prisma 6, Postgres 16, Node 22).

## Size target

200–400 lines per `SKILL.md`. If you hit 500+, the skill is doing too much — propose a split.

## Self-review before commit

1. **Placeholder scan:** no `TBD`, `TODO`, `handle appropriately`, `add error handling` without specifics.
2. **Baseline leak:** rules that restate `_baseline` get removed.
3. **Overlap check:** if another skill owns a concern, hand off rather than re-encode.
4. **Testability:** every rule is checkable as PASS / CONCERN / NOT APPLICABLE.
