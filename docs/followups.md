# Follow-ups

Tracked work surfaced during the 2026-04-27 plugin runtime extraction, with status updates from the 2026-04-28/29 plugin refactor (`global-plugin@0.4.0`).

## 1. Add `.claude-plugin/marketplace.json` so company-plugin can be installed via marketplace

**Status:** OPEN.

**Title:** Add marketplace.json so company-plugin can be installed via marketplace

**Summary:** `board-plugin` publishes via a `.claude-plugin/marketplace.json` at repo root with a `git-subdir` source pointing at `plugin/`. `global-plugin` doesn't have one yet. Adding it requires the GitHub owner/URL the plugin will be published from, plus an owner email. Mirror the structure used in `/c/Users/logan/Desktop/projects/org/board-plugin/.claude-plugin/marketplace.json`.

## 2. `plugin/templates/project/.mcp.json` still ships broken `echo` placeholders

**Status:** PARTIAL — front-door file `plugin/.mcp.json` was deleted in 0.4.0 (commit `aab386c`), but the consumer-onboarding template at `plugin/templates/project/.mcp.json` still ships the same five `echo` placeholder servers. The `bootstrap-new-project.sh` script copies that template into a consumer's project, reproducing the broken state.

**Summary:** Decide on the template's fate as part of the bootstrap rework (item below): replace with `{"mcpServers": {}}`, document setup in the consumer README, or delete the bootstrap path entirely. Until then, `plugin/README.md` carries a deferral note steering consumers away from the bootstrap workflow.

## 3. ~~`skill-verification` skill instructs consumers to run `pnpm verify`, which only exists in the source repo~~

**Status:** RESOLVED in 0.4.0 (commit `aba8250`). `skill-verification` was relocated from `plugin/skills/skill-verification/` to `.claude/skills/skill-verification/` (project-local maintainer skill). It auto-discovers when working in this repo and is no longer shipped to consumers via the plugin marketplace, so the `pnpm verify` invocation is no longer presented to anyone who doesn't have the source repo.

## 4. Bootstrap script + `plugin/templates/project/` rework

**Status:** OPEN. Surfaced during the 2026-04-28 plugin refactor and parked there explicitly (spec §4).

**Summary:** Three issues bundled together:

- `plugin/templates/project/.claude/CLAUDE.md` lives at a path Claude Code does not read (the recognized memory paths are `<repo-root>/CLAUDE.md` and `~/.claude/CLAUDE.md`, NOT `<repo-root>/.claude/CLAUDE.md`). The shipped template is invisible to the model.
- `plugin/scripts/bootstrap-new-project.sh` uses unconditional `cp`, which silently overwrites any existing `.claude/CLAUDE.md`, `.claude/settings.json`, or `.mcp.json` in the target. Re-running the script destroys consumer state.
- `plugin/templates/project/.mcp.json` still ships the broken `echo` placeholders (see item 2).

**Recommendation:** rework as one unit. Either (a) delete the script and templates, replacing with documentation in `plugin/README.md`; or (b) rewrite the script to JSON-merge `settings.json`, drop the unread `.claude/CLAUDE.md` template, and ship `.mcp.json` as `{"mcpServers": {}}`.

## 5. ~~`anthropic-tooling-dev` placement decision~~

**Status:** RESOLVED in 2026-04-29 (rename + verifier-shape conformance). Implemented per [`docs/superpowers/specs/2026-04-29-org-ai-tooling-rename-design.md`](superpowers/specs/2026-04-29-org-ai-tooling-rename-design.md).

**Resolution:** Skill renamed `anthropic-tooling-dev` → `org-ai-tooling` in both copies (`plugin/skills/org-ai-tooling/`, `.claude/skills/org-ai-tooling/`). Description rewritten in verifier-compliant `Use when …` form with explicit TRIGGER and SKIP clauses so the skill triggers only on Claude Code tooling work, not on consumer app code. Body restructured into the four required domain-skill sections (`Core rules`, `Red flags`, `Review checklist`, `Interactions with other skills`); reference content (decision framework, primitive cheat-sheet, key flags, key commands, common mistakes) moved to `references/patterns.md`. Verifier verdict: RED → GREEN. Cross-references updated in `plugin/README.md` and root `CLAUDE.md`. The skill stays consumer-facing (option (c) from the original three) under the "Maintainer / experimental" subheading. Note: the `## Assumes baseline-standards. Adds:` line was deliberately NOT added to the new skill — see followups item #6 for the broader cross-boundary cleanup.

## 6. ~~`templates/baseline-standards.md` runtime inheritance gap~~

**Status:** RESOLVED in 2026-04-29 (delete-not-fix). Implemented per [`docs/superpowers/specs/2026-04-29-baseline-standards-cleanup-design.md`](superpowers/specs/2026-04-29-baseline-standards-cleanup-design.md).

**Resolution:** `templates/baseline-standards.md` deleted outright rather than fixing the inheritance gap. The 8 baseline sections (TypeScript strict, security-by-default, observability floor, testing floor, accessibility floor, performance floor, resilience floor, stack-assumed) are in the model's training as canonical defaults; loading them at runtime adds tokens for marginal benefit. All 23 `## Assumes baseline-standards. Adds:` headings removed from domain skills, plus 6 explicit body-text references in 4 skills. `templates/new-skill-template.md` also deleted (canonical scaffold guidance lives in `docs/superpowers/skill-authoring-guide.md`); the `templates/` directory is gone. Cross-references in `plugin/README.md`, root `CLAUDE.md`, root `README.md`, and `docs/superpowers/skill-authoring-guide.md` updated to match. After this work, `plugin/` references nothing at the repo root — fully self-contained.
