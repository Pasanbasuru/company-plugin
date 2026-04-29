# Accessibility PR review checklist — full form

Use this file when producing a complete accessibility review report. The lean `SKILL.md` lists only the section headings and shape; this file provides the full checklist coverage table and guidance on what to include in each section.

---

## Review report structure

### 1. Summary

One line: GREEN / YELLOW / RED. Name the reviewed surface (component, route, flow) and the overall verdict in a single sentence so a reader can scan the result without reading further.

### 2. Findings

One bullet per finding, in this shape:

- `path/to/file.tsx:42` — **severity** (blocking | concern | info) — *category* (keyboard | semantics | labels | contrast | focus-management | motion | alt-text | aria-pattern) — what is wrong, recommended fix.

Flag every `outline: none` without replacement, every input without a programmatic label, every `<div onClick>` masquerading as a button, every modal without focus trap/restore, and every missing `aria-live` region with its exact `file:line`.

**axe-core output belongs in this section.** Append the axe-core violation report (impact, description, affected elements) alongside the prose findings — either as a sub-list per axe rule, or as a fenced-block paste of the JSON/text report under a `**axe-core violations**` paragraph. If no automated scan was run, note this explicitly and explain why.

### 3. Safer alternative

Prefer semantic HTML over ARIA roles wherever possible — a native `<button>`, `<a>`, `<label>`, or `<dialog>` carries keyboard behaviour, role announcement, and focus handling for free, whereas `role="button"` on a `<div>` forces you to re-implement each of those manually and get every edge case right. Prefer a visible `:focus-visible` ring (with `outline-offset` or a `box-shadow` at 3:1 contrast) plus a skip-to-main-content link over removing focus outlines or constructing a keyboard trap that invisibly confines users. For custom widgets, prefer a vetted headless library (Radix UI, Headless UI, React Aria) that implements the WAI-ARIA APG pattern correctly over a hand-rolled combobox, dialog, or tabs that will miss arrow-key semantics, focus restoration, or `aria-activedescendant` bookkeeping.

### 4. Checklist coverage

Mark each Core rule as PASS / CONCERN / NOT APPLICABLE with a short justification.

---

## Checklist coverage table

| # | Rule | Status | Notes |
|---|------|--------|-------|
| 1 | All interactive elements are keyboard-reachable in logical tab order and have a visible focus indicator. | PASS / CONCERN / N/A | |
| 2 | Semantic HTML used before ARIA; no `<div>` acting as button/link. | PASS / CONCERN / N/A | |
| 3 | All inputs have an associated `<label>`; errors are linked via `aria-describedby` and announced via `aria-live`. | PASS / CONCERN / N/A | |
| 4 | Colour contrast meets 4.5:1 for body text and 3:1 for large text and UI components. | PASS / CONCERN / N/A | |
| 5 | Focus is managed on route change, modal open/close, and async content insertion. | PASS / CONCERN / N/A | |
| 6 | `prefers-reduced-motion` is respected for all animations or transitions larger than a small fade. | PASS / CONCERN / N/A | |
| 7 | Non-text content has `aria-label` / `alt` or is marked `aria-hidden="true"`. | PASS / CONCERN / N/A | |
| 8 | Custom widgets follow the WAI-ARIA Authoring Practices pattern; no invented ARIA. | PASS / CONCERN / N/A | |

---

## Required explicit scans

In addition to the rule-by-rule table, every review must explicitly scan for these common failure patterns:

- **`outline: none` / `outline: 0`** — flag every occurrence; verify a `:focus-visible` replacement is present and has 3:1 contrast.
- **`<div>` / `<span>` with `onClick`** — flag every occurrence; verify no `role="button"` workaround exists when a real `<button>` should be used.
- **`<input>` / `<select>` / `<textarea>` without a matching `<label htmlFor>`** — check that `aria-label` or `aria-labelledby` is present as the fallback, not just placeholder.
- **`aria-live` coverage** — for each dynamic content region (error messages, toast notifications, live search results, status updates), confirm an `aria-live` region is present and correctly scoped.
- **Modal / dialog open/close** — confirm `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus trap, Escape key, and focus restoration on close.
- **Route-change focus** — confirm focus is moved to a landmark or heading after SPA navigation.
- **Colour-only cues** — scan for status, error, and success indicators that rely on colour alone without a secondary text or icon cue.
- **Auto-playing media** — confirm any auto-playing video or GIF either stops after 5 s or provides a pause/stop control.

---

## Severity definitions

| Severity | Meaning |
|----------|---------|
| **blocking** | A WCAG 2.2 AA failure that makes a feature completely inaccessible to one or more user groups. Must be fixed before merge. |
| **concern** | A usability degradation for assistive technology users that is not a hard WCAG failure, or a pattern that is likely to become blocking as the component evolves. Should be fixed; flag if deferred. |
| **info** | Best-practice improvement with no current accessibility impact. Address opportunistically. |
