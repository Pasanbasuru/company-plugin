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

## 5. `anthropic-tooling-dev` placement decision

**Status:** OPEN. Parked during the 2026-04-28 plugin refactor (spec §4).

**Summary:** `plugin/skills/anthropic-tooling-dev/` is meta-content about Claude Code tooling itself. A consumer's React/NestJS app does not benefit from loading it, but the skill is genuinely useful when working on this repo. Three options under consideration:

- Move to `.claude/skills/anthropic-tooling-dev/` (project-local maintainer skill — same destination as `skill-verification`).
- Move to `templates/anthropic-tooling-dev.md` (treat as reference doc, not a triggering skill).
- Leave in `plugin/skills/` with a Maintainer/experimental caveat in the catalog (current state).

The verifier currently flags this skill as RED (it doesn't follow the four-section Review checklist shape that domain skills do — because it isn't a domain skill). The RED is expected and acknowledged in the 2026-04-28 spec.

## 6. `templates/baseline-standards.md` runtime inheritance gap

**Status:** OPEN, deliberately deferred (2026-04-28 spec §4).

**Summary:** Every domain skill opens with `## Assumes \`baseline-standards\`. Adds:` referencing the cross-cutting standards doc at `templates/baseline-standards.md`. The reference is textual only — the doc does not auto-load in a consumer session alongside the domain skill. The model has these conventions in training data, so the practical loss is mild, but it is suboptimal compared to the documented intent. Future work could either (a) move the standards into a real consumer-facing skill that the model invokes alongside any domain skill, or (b) make the inheritance explicit via a hook that injects baseline standards at SessionStart.
