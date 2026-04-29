---
name: accessibility-guard
description: Use when writing or reviewing any UI — web or mobile — that a user interacts with. Do NOT skip this for "internal tools"; internal users also use assistive tech. Covers WCAG 2.2 AA, keyboard navigation, focus management, ARIA correctness, colour contrast, reduced motion, form accessibility.
allowed-tools: Read, Grep, Glob, Bash
---

# Accessibility guard

## Purpose & scope

Ensure every interface is usable by people who navigate with keyboards, screen readers, magnifiers, or reduced motion — not a pass at the end, a pass at write time. This skill applies whenever you write or review React components, forms, modals, navigation, or any interactive UI. Accessibility is a correctness requirement, not a nice-to-have: many users depend on it, and retrofitting is far more expensive than building it in from the start.

## Assumes `baseline-standards`. Adds:

WCAG 2.2 AA compliance, keyboard reachability, focus management, ARIA correctness, colour contrast, reduced motion, and screen reader compatibility on top of baseline HTML/React discipline.

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

### Form field: labelled input with `aria-describedby` + `aria-live` error vs placeholder-as-label

Bad:
```tsx
// Placeholder disappears on focus — the user forgets what the field is for.
// There is no programmatic label for the screen reader.
// The error text is rendered but never announced.
function EmailField() {
  const [error, setError] = useState('');
  return (
    <div>
      <input
        type="email"
        placeholder="Email address"
        onChange={(e) => validate(e.target.value, setError)}
      />
      {error && <span style={{ color: 'red' }}>{error}</span>}
    </div>
  );
}
```

Good:
```tsx
// Label is always visible and programmatically linked.
// aria-describedby links the error; aria-live announces it on insertion.
// aria-invalid signals the error state to the screen reader.
function EmailField() {
  const id = useId();
  const errorId = `${id}-error`;
  const [error, setError] = useState('');

  return (
    <div>
      <label htmlFor={id}>Email address</label>
      <input
        id={id}
        type="email"
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? 'true' : undefined}
        onChange={(e) => validate(e.target.value, setError)}
      />
      <div
        id={errorId}
        role="alert"
        aria-live="polite"
        aria-atomic="true"
      >
        {error}
      </div>
    </div>
  );
}
```

### Modal: focus trap + restore vs modal that loses focus

Bad:
```tsx
// Focus is not moved to the modal on open.
// Tab key escapes the modal into the background page.
// When the modal closes, focus is dropped rather than returned to the trigger.
function BadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal">
        <button onClick={onClose}>Close</button>
        <p>Modal content</p>
      </div>
    </div>
  );
}
```

Good:
```tsx
import { useEffect, useRef } from 'react';
import { createFocusTrap } from 'focus-trap'; // or use a headless-UI dialog

function GoodModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Capture the element that opened the modal so we can restore focus on close.
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLButtonElement;
      dialogRef.current?.focus();
    } else {
      triggerRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      ref={dialogRef}
      tabIndex={-1}                     // makes the dialog itself focusable
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className="modal-overlay"
    >
      <div className="modal">
        <h2 id="modal-title">Confirm action</h2>
        <p>Are you sure you want to proceed?</p>
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="button" onClick={() => { confirm(); onClose(); }}>
          Confirm
        </button>
      </div>
    </div>
  );
}
// For production: use Radix UI Dialog or Headless UI Dialog which ship
// focus-trap and restore behaviour out of the box.
```

## Keyboard and focus

Every interactive element must be reachable by pressing Tab (or Shift+Tab to reverse) and activated by pressing Enter or Space as appropriate. The natural DOM order determines tab order; avoid `tabindex` values greater than `0` because they create a separate, confusing tab sequence that does not match the visual layout.

Use `tabindex="0"` only to make a non-interactive element intentionally focusable (e.g., a custom widget container). Use `tabindex="-1"` to make an element programmatically focusable without placing it in the natural tab sequence — this is the correct value for dialog containers and for elements that receive focus via script (e.g., an error summary heading).

Focus indicators must be visible. The browser default `outline` is acceptable as a baseline; if you override it for aesthetic reasons, the replacement must have at least 3:1 contrast against the adjacent background colour. The `:focus-visible` pseudo-class lets you show a focus ring only for keyboard navigation while hiding it for pointer interaction:

```tsx
/* Show ring only for keyboard focus — not on mouse click */
.interactive-element:focus-visible {
  outline: 2px solid #005fcc;
  outline-offset: 2px;
}
.interactive-element:focus:not(:focus-visible) {
  outline: none;
}
```

On single-page route transitions, move focus to the page heading or a skip-nav landmark immediately after navigation completes. A common pattern is a visually-hidden `<h1>` with `tabindex="-1"` that is focused by the router's navigation hook:

```tsx
// In your router's onNavigationComplete callback:
const pageHeadingRef = useRef<HTMLHeadingElement>(null);

useEffect(() => {
  pageHeadingRef.current?.focus();
}, [pathname]);

return <h1 ref={pageHeadingRef} tabIndex={-1} className="sr-only">{pageTitle}</h1>;
```

Skip navigation links allow keyboard users to jump past repeated navigation directly to the main content. Render one as the first element in `<body>`, visible only on focus:

```tsx
<a href="#main-content" className="skip-link">Skip to main content</a>
<nav>...</nav>
<main id="main-content" tabIndex={-1}>...</main>
```

## Forms and errors

Every `<input>`, `<select>`, and `<textarea>` must have a programmatically associated label — either a visible `<label htmlFor={id}>` or, where a visible label is not possible, `aria-label` or `aria-labelledby` referencing visible text. Placeholder text is not a label: it disappears on input and has lower contrast than label text by convention.

Use `useId()` (React 18+) to generate stable, collision-free IDs for the input–label pair. This avoids the common mistake of hard-coding IDs that break when the component is rendered more than once on the same page.

Validation errors must be associated with their input via `aria-describedby` pointing to the error message element. Set `aria-invalid="true"` on the input when an error is active. Inject errors into the DOM dynamically using `aria-live="polite"` (for inline, non-urgent errors) or `aria-live="assertive"` (for time-sensitive messages). `role="alert"` implies `aria-live="assertive"` and should be used sparingly — overusing it creates a stream of interruptions.

For multi-field forms with a submission error summary, programmatically focus the summary heading after a failed submission so screen reader users hear the summary immediately:

```tsx
const errorSummaryRef = useRef<HTMLDivElement>(null);

function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  const errors = validate(formValues);
  if (errors.length > 0) {
    setErrors(errors);
    // Allow the DOM to update, then move focus to the summary.
    requestAnimationFrame(() => errorSummaryRef.current?.focus());
    return;
  }
  submitForm(formValues);
}

// In JSX:
{errors.length > 0 && (
  <div ref={errorSummaryRef} tabIndex={-1} role="alert">
    <h2>There are {errors.length} errors in this form</h2>
    <ul>
      {errors.map((err) => (
        <li key={err.field}>
          <a href={`#${err.field}`}>{err.message}</a>
        </li>
      ))}
    </ul>
  </div>
)}
```

Required fields should be indicated visually and programmatically. Use the native `required` attribute on `<input>` elements — screen readers announce "required" automatically. Do not rely solely on a colour (e.g., a red asterisk) to convey required status; include a text explanation such as "Fields marked with * are required" near the top of the form.

## Colour and contrast

WCAG 2.2 AA mandates:
- **4.5:1** minimum contrast ratio for text smaller than 18 pt (or 14 pt bold).
- **3:1** minimum contrast ratio for large text (18 pt+ / 14 pt+ bold), UI components (input borders, checkbox borders, button outlines), and graphical elements essential to understanding content.
- There is no contrast requirement for decorative elements, disabled controls, or logotypes.

Never convey meaning through colour alone. Always pair colour with a secondary cue — an icon, a label, a pattern, or a text description. A status indicator that is green for success and red for failure must also carry a textual label ("Success" / "Error") or an icon with an `aria-label`.

Check contrast at design time and in code review using tools such as the WebAIM Contrast Checker, the browser DevTools accessibility panel, or the Figma plugin "Contrast". Automated tools like axe-core detect most contrast failures, but they cannot detect contrast issues on images, gradients, or elements with dynamically computed colours — those require manual inspection.

Dark mode and high-contrast mode require separate verification. An accessible light-mode palette is not automatically accessible in dark mode because the relative contrast of overlapping colours can flip. Use CSS custom properties and `prefers-color-scheme` to define both palettes explicitly, and test each independently.

## Motion, animation, and reduced-motion

The CSS media query `prefers-reduced-motion: reduce` is set by users who have requested reduced motion at the OS level. When this media query is active, any animation, transition, or parallax effect that covers significant distance or plays for more than a few hundred milliseconds must be disabled or replaced with a minimal variant (e.g., a simple opacity fade instead of a slide-in):

```css
/* Default: smooth slide-in */
.drawer {
  transition: transform 300ms ease-in-out;
}

/* Reduced-motion: instant or minimal */
@media (prefers-reduced-motion: reduce) {
  .drawer {
    transition: opacity 100ms linear;
    transform: none;
  }
}
```

In React, the `useReducedMotion` hook from Framer Motion or a hand-rolled hook wrapping `matchMedia` gives you a boolean you can use to gate animated variants:

```tsx
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

function AnimatedBanner() {
  const reduced = useReducedMotion();
  return (
    <div
      style={{
        animation: reduced ? 'none' : 'slideIn 400ms ease-out',
        opacity: reduced ? 1 : undefined,
      }}
    >
      Welcome back
    </div>
  );
}
```

Auto-playing video and GIFs must either loop for no more than five seconds or provide a mechanism to pause, stop, or hide them. This is a WCAG 2.2 AA requirement (Success Criterion 2.2.2) and also applies in reduced-motion contexts.

Do not use animations to convey critical information. A spinner, a progress bar, and a confetti burst are decorative; the underlying state change (loading, complete, error) must also be communicated via text or an `aria-live` region.

## ARIA patterns reference

The WAI-ARIA Authoring Practices Guide (APG) at https://www.w3.org/WAI/ARIA/apg/ is the authoritative reference for ARIA widget patterns. Before building a custom combobox, dialog, tabs, tree, menubar, or carousel, read the corresponding APG pattern — it specifies the required roles, states, properties, and keyboard interactions in full.

Key patterns and their most commonly missed requirements:

**Dialog (modal):** `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to the dialog title, focus trap confining Tab/Shift+Tab to the dialog's focusable descendants, Escape key closes the dialog, focus returns to the trigger element on close.

**Combobox:** The text input has `role="combobox"`, `aria-expanded`, `aria-controls` pointing to the listbox, and `aria-activedescendant` tracking the highlighted option. Arrow keys move through options; Enter selects; Escape closes.

**Tabs:** The tab list has `role="tablist"`; each tab has `role="tab"`, `aria-selected`, and `aria-controls` pointing to its panel. Arrow keys (left/right or up/down) move between tabs; Tab moves focus into the active panel.

**Disclosure (accordion):** The trigger is a `<button>` with `aria-expanded` and `aria-controls` pointing to the panel. The panel itself needs no ARIA role — it is just a container that is shown or hidden.

**Tooltip:** The tooltip container has `role="tooltip"` and an ID; the trigger element has `aria-describedby` referencing that ID. Tooltip appears on focus and hover; does not contain interactive content.

Common ARIA mistakes to avoid:
- Applying `aria-label` to a `<div>` that contains multiple interactive elements — label the individual controls, not the container.
- Using `role="presentation"` or `role="none"` on an element that has focusable descendants — this removes the element from the accessibility tree but not its children, producing orphaned interactive elements.
- Setting `aria-hidden="true"` on an element while it or a descendant still has focus — focus inside a hidden subtree is a screen reader trap.
- Using `aria-live="assertive"` for non-urgent messages — it interrupts whatever the screen reader is currently reading.

## Testing a11y

Accessibility testing requires both automated scanning and manual verification. Automated tools catch approximately 30–50 % of WCAG issues; the rest require human judgement.

**Automated scanning with axe-core**

axe-core (https://github.com/dequelabs/axe-core) is the industry-standard automated accessibility rule engine. Integrate it at two levels:

1. **Unit / component tests** using `jest-axe`:
   ```tsx
   import { render } from '@testing-library/react';
   import { axe, toHaveNoViolations } from 'jest-axe';
   expect.extend(toHaveNoViolations);

   it('has no axe violations', async () => {
     const { container } = render(<EmailField />);
     const results = await axe(container);
     expect(results).toHaveNoViolations();
   });
   ```

2. **End-to-end tests** using `@axe-core/playwright`:
   ```ts
   import { checkA11y } from 'axe-playwright';

   test('checkout page has no axe violations', async ({ page }) => {
     await page.goto('/checkout');
     await checkA11y(page, undefined, {
       detailedReport: true,
       detailedReportOptions: { html: true },
     });
   });
   ```

Run axe scans on every page/route, not just the home page. Violations on low-traffic pages are still legal and user-experience liabilities.

**Manual keyboard testing**

Automated tools cannot verify focus order, keyboard trap absence, or the logical reading sequence of dynamic content. For every critical user flow (sign-in, checkout, form submission, modal interaction), manually test using only the keyboard:

1. Press Tab from the top of the page and verify each interactive element receives focus in a logical order.
2. Activate buttons and links with Enter; activate buttons also with Space.
3. Open and close modals; confirm focus moves in and returns correctly.
4. Trigger form validation errors; confirm error messages are announced.
5. Navigate away and back using the browser's Back button; confirm focus is restored sensibly.

**Manual screen reader spot-checks**

Test with at least one screen reader on the primary target platform. The most commonly used combinations are:

- **VoiceOver + Safari** on macOS / iOS (enable in System Preferences > Accessibility; navigate with VO+arrow keys).
- **NVDA + Firefox or Chrome** on Windows (free download at nvaccess.org; navigate with arrow keys and NVDA modifier).
- **TalkBack** on Android (enable in Settings > Accessibility; navigate by swiping).

Spot-check focus, form labelling, error announcement, modal behaviour, and dynamic content updates (especially `aria-live` regions). Screen reader behaviour differences between browsers and AT versions are real — if budget allows, test in at least two combinations.

**Review checklist output**

Produce a markdown report with these sections:

1. **Summary** — one line: pass / concerns / blocking issues.
2. **Findings** — per issue: *File:line, severity (blocking | concern | info), category, what is wrong, recommended fix*. Flag every `outline: none` without replacement, every input without a label, every `<div onClick>` masquerading as a button, and every missing `aria-live` region with its exact file:line.
3. **axe findings** — paste the axe-core violation report (impact, description, affected elements).
4. **Checklist coverage** — for each of the 8 core rules, mark PASS / CONCERN / NOT APPLICABLE:
   - Rule 1: All interactive elements are keyboard-reachable with visible focus indicator.
   - Rule 2: Semantic HTML used before ARIA; no `<div>` acting as button/link.
   - Rule 3: All inputs have associated labels; errors use `aria-describedby` and `aria-live`.
   - Rule 4: Colour contrast meets 4.5:1 (text) and 3:1 (large text and UI components).
   - Rule 5: Focus is managed on route change, modal open/close, async content insertion.
   - Rule 6: `prefers-reduced-motion` is respected for all significant animations.
   - Rule 7: Non-text content has `aria-label` / `alt` or is `aria-hidden`.
   - Rule 8: Custom widgets follow WAI-ARIA APG patterns; no invented ARIA.

## Interactions with other skills

- **Owns:** accessibility compliance (WCAG 2.2 AA, keyboard, focus, ARIA, contrast, reduced-motion).
- **Hands off to:** `frontend-implementation-guard` for component structure, `performance-budget-guard` for motion-vs-performance tradeoffs.
- **Does not duplicate:** `templates/baseline-standards.md`'s accessibility floor; this skill enforces it in concrete review.

## Review checklist

### Summary

One line: pass / concerns / blocking issues. Name the reviewed surface (component, route, flow) and the overall verdict in a single sentence so a reader can scan the result without reading further.

### Findings

One bullet per finding, in this shape:

- `path/to/file.tsx:42` — **severity** (blocking | concern | info) — *category* (keyboard | semantics | labels | contrast | focus-management | motion | alt-text | aria-pattern) — what is wrong, recommended fix.

Flag every `outline: none` without replacement, every input without a programmatic label, every `<div onClick>` masquerading as a button, every modal without focus trap/restore, and every missing `aria-live` region with its exact `file:line`.

### Safer alternative

Prefer semantic HTML over ARIA roles wherever possible — a native `<button>`, `<a>`, `<label>`, or `<dialog>` carries keyboard behaviour, role announcement, and focus handling for free, whereas `role="button"` on a `<div>` forces you to re-implement each of those manually and get every edge case right. Prefer a visible `:focus-visible` ring (with `outline-offset` or a `box-shadow` at 3:1 contrast) plus a skip-to-main-content link over removing focus outlines or constructing a keyboard trap that invisibly confines users. For custom widgets, prefer a vetted headless library (Radix UI, Headless UI, React Aria) that implements the WAI-ARIA APG pattern correctly over a hand-rolled combobox, dialog, or tabs that will miss arrow-key semantics, focus restoration, or `aria-activedescendant` bookkeeping.

### Checklist coverage

Mark each Core rule as PASS / CONCERN / NOT APPLICABLE with a short justification.

- Rule 1 — Keyboard-reachable in logical tab order with visible focus indicator: PASS / CONCERN / NOT APPLICABLE.
- Rule 2 — Semantic HTML before ARIA; no `<div>` acting as button/link: PASS / CONCERN / NOT APPLICABLE.
- Rule 3 — Inputs have associated `<label>`; errors linked via `aria-describedby` and announced via `aria-live`: PASS / CONCERN / NOT APPLICABLE.
- Rule 4 — Colour contrast meets 4.5:1 (body text) and 3:1 (large text and UI components): PASS / CONCERN / NOT APPLICABLE.
- Rule 5 — Focus is managed on route change, modal open/close, and async content insertion: PASS / CONCERN / NOT APPLICABLE.
- Rule 6 — `prefers-reduced-motion` is respected for every animation or transition larger than a small fade: PASS / CONCERN / NOT APPLICABLE.
- Rule 7 — Non-text content has `aria-label` / `alt` or is marked `aria-hidden="true"`: PASS / CONCERN / NOT APPLICABLE.
- Rule 8 — Custom widgets follow the WAI-ARIA Authoring Practices pattern; no invented ARIA: PASS / CONCERN / NOT APPLICABLE.
