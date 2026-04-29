---
name: accessibility-guard
description: Use when writing or reviewing any UI — web or mobile — that a user interacts with. Do NOT skip this for "internal tools"; internal users also use assistive tech. Covers WCAG 2.2 AA, keyboard navigation, focus management, ARIA correctness, colour contrast, reduced motion, form accessibility.
allowed-tools: Read, Grep, Glob, Bash
---

# Accessibility guard

## Purpose & scope

Ensure every interface is usable by people who navigate with keyboards, screen readers, magnifiers, or reduced motion — not a pass at the end, a pass at write time. This skill applies whenever you write or review React components, forms, modals, navigation, or any interactive UI. Accessibility is a correctness requirement, not a nice-to-have: many users depend on it, and retrofitting is far more expensive than building it in from the start.

## Core rules

1. **Every interactive element is keyboard-reachable in logical tab order and has a visible focus indicator.** — *Why:* users who cannot use a pointer device navigate exclusively via keyboard; an element that cannot be focused or activated by keyboard is completely inaccessible to them. Removing `outline` without a replacement focus style is a WCAG 2.4.7 failure.
2. **Use semantic HTML (`<button>`, `<a>`, `<label>`, `<nav>`, `<main>`, `<header>`, `<section>`) before adding ARIA. ARIA patches semantics; it does not replace them.** — *Why:* native elements carry built-in keyboard behaviour, role announcements, and event handling for free. A `<div>` requires you to recreate all of that manually — and you will miss edge cases that browser vendors have already solved.
3. **Form inputs have an associated `<label>` (via `htmlFor` / `for`). Error messages are linked via `aria-describedby` and announced via `aria-live`.** — *Why:* screen readers announce the label when the input receives focus. Without a label the user hears only "edit text" with no context. Without `aria-live`, error messages that appear after submission are silent to screen reader users who do not happen to move focus to the error element.
4. **Colour contrast meets WCAG 2.2 AA: 4.5:1 for body text, 3:1 for large text (18 pt / 14 pt bold) and UI components (borders, icons).** — *Why:* approximately 8 % of men have some form of colour vision deficiency; low-contrast interfaces are unreadable for them in many lighting conditions and unreadable for everyone under strong ambient light.
5. **Focus is managed on route change, modal open/close, and async content insertion — users must not lose their place.** — *Why:* single-page navigation does not trigger the browser's native scroll-to-top and focus-reset behaviour. Without explicit focus management, screen reader users land in the middle of stale content after navigation and have no way to know the page changed.
6. **Respect `prefers-reduced-motion`: any animation or transition larger than a small fade must have a reduced variant when the media query is active.** — *Why:* large motion can trigger vestibular disorders causing nausea or seizures for users with conditions such as POTS or photosensitive epilepsy. The OS-level setting is a direct user request; ignoring it is harmful.
7. **Non-text content (icon-only buttons, decorative images, loading spinners) has an `aria-label` / `alt` or is marked `aria-hidden="true"` as appropriate.** — *Why:* without a text alternative, a screen reader reads the raw file name or announces a generic "image" — providing no useful information and cluttering the reading experience.
8. **Custom widgets follow the WAI-ARIA Authoring Practices pattern (combobox, dialog, tabs, tree, etc.). Do not invent ARIA.** — *Why:* screen reader users learn the expected keyboard conventions for each widget type. A combobox that does not respond to arrow keys as specified breaks those learned expectations and makes the widget unusable for assistive technology users.

## Red flags

| Thought | Reality |
|---|---|
| "It's a `<div>` with an `onClick`" | That is a button. Use `<button>`. You are missing keyboard activation, role announcement, and default focus handling. |
| "The focus ring is ugly — `outline: none`" | Never remove focus styles without a replacement. Use `outline` with an offset, a box shadow, or a custom `:focus-visible` style that is clearly visible at 3:1 contrast against its background. |
| "I'll skip a11y — this is an admin-only tool" | Admins use screen readers too. "Internal-only" is not an accessibility exemption; it is an excuse that excludes your colleagues. |
| "I can fix the semantics with ARIA" | ARIA is a last resort. The first resort is the correct HTML element. `role="button"` on a `<div>` still leaves you to wire up `keydown`, `click`, `disabled`, and `aria-pressed` manually. |

## Good vs bad

### Interactive element: `<button>` with `aria-label` vs `<div onClick>`

Bad:
```tsx
// No keyboard activation, no role, no focus indicator from the browser.
function ClosePanel() {
  return (
    <div onClick={() => setOpen(false)} style={{ cursor: 'pointer' }}>
      <XIcon />
    </div>
  );
}
```

Good:
```tsx
// Native button: keyboard-activatable, announced as "Close panel, button",
// receives focus ring from the browser, supports disabled state.
function ClosePanel() {
  return (
    <button
      type="button"
      onClick={() => setOpen(false)}
      aria-label="Close panel"
      className="icon-btn"
    >
      <XIcon aria-hidden="true" />
    </button>
  );
}
```

## Interactions with other skills

- **Owns:** accessibility compliance (WCAG 2.2 AA, keyboard, focus, ARIA, contrast, reduced-motion).
- **Hands off to:** `frontend-implementation-guard` for component structure, `performance-budget-guard` for motion-vs-performance tradeoffs.

## Review checklist

### Summary

One line: pass / concerns / blocking issues. Name the reviewed surface (component, route, flow) and the overall verdict in a single sentence so a reader can scan the result without reading further.

### Findings

One bullet per finding: `path/to/file.tsx:42` — **severity** (blocking | concern | info) — *category* (keyboard | semantics | labels | contrast | focus-management | motion | alt-text | aria-pattern) — what is wrong, recommended fix. Append axe-core violation output (impact, description, affected elements) inside this same section.

### Safer alternative

Prefer semantic HTML over ARIA roles; prefer vetted headless libraries (Radix UI, Headless UI, React Aria) over hand-rolled custom widgets; prefer `:focus-visible` rings over removing focus outlines.

### Checklist coverage

Mark each Core rule PASS / CONCERN / NOT APPLICABLE with a one-line justification. See `references/review-checklist.md` for the full table, required explicit scans, and severity definitions.

---

*For detailed implementation patterns (keyboard focus, forms, modals, colour, motion, ARIA patterns, axe-core testing), see `references/patterns.md`. For the full PR review checklist with the coverage table and severity definitions, see `references/review-checklist.md`.*
