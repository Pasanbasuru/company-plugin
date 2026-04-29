---
name: <skill-name>
description: Use when [specific trigger]. Do NOT use for [anti-trigger — point at the right skill]. Covers [comma-separated scope tags]. TRIGGER when: <sharp signal>. SKIP when: <anti-trigger>.
allowed-tools: Read, Grep, Glob
---

# <Skill Title>

## Purpose & scope

[2-3 sentences. What does this skill enforce? When does it activate? What is its scope boundary against other skills?]

## Assumes `baseline-standards`. Adds:

[One line naming the additional domain this skill enforces on top of the cross-cutting baseline. Example: "Monorepo structure and cross-package boundary rules." Do not restate baseline rules — they live in `templates/baseline-standards.md`.]

## Core rules

[Numbered list. 5-10 rules. Each rule is one imperative sentence in bold ending with a period, followed by a `*Why:*` line giving the concrete failure mode. Each rule must be testable as PASS / CONCERN / NOT APPLICABLE.]

1. **[Placeholder] State the concrete rule as a short imperative sentence ending with a period.** — *Why:* explain the concrete failure mode this rule prevents in one sentence.
2. **[Placeholder] A second rule, if the domain needs it; otherwise delete this line.** — *Why:* keep rules to the smallest set a reviewer can actually hold in their head — usually 4 to 10.

## Red flags

[Table of `Thought | Reality` pairs. Anti-patterns this skill catches.]

| Thought | Reality |
|---|---|
| "[Placeholder] An excuse the author is tempted to make" | "[Placeholder] The consequence that excuse hides — one concrete sentence." |

## Good vs bad

[Optional. 2-3 subsections each with a `Bad:` and `Good:` code block. Snippets ≤20 lines. Only snippets that illustrate a Core rule.]

## [Domain-specific deep-dive sections]

[Optional. Replace this header with topic-specific sections. Examples: "Indexing strategy", "Migration safety", "Spooky-action warning list". Move long sections to `references/patterns.md` if SKILL.md exceeds ~2,000 words.]

## Interactions with other skills

- **Owns:** [the concerns this skill is the canonical source for].
- **Hands off to:** [other skill] for [their concern].
- **Does not duplicate:** [other skill's overlapping concern].

## Review checklist

Produce a markdown report with these four sections.

### Summary

One line: pass / concerns / blocking issues. Name the reviewed surface and the overall verdict in a single sentence so a reader can scan without reading further.

### Findings

One bullet per finding, in this shape:

- `<file>:<line>` — **severity** (blocker | concern | info) — *category* (one of <list>) — what is wrong, recommended fix.

### Safer alternative

[State the lowest-blast-radius path that still achieves the change's goal, prescriptively.]

### Checklist coverage

Mark each Core rule as PASS / CONCERN / NOT APPLICABLE with a one-line justification.

- Rule 1 — [restate the rule]: PASS / CONCERN / NOT APPLICABLE.
- Rule 2 — [restate the rule]: PASS / CONCERN / NOT APPLICABLE.
