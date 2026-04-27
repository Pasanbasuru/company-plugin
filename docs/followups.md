# Follow-ups

Tracked work surfaced during the 2026-04-27 plugin runtime extraction. Each item is a known pre-existing problem that was deliberately deferred from that refactor — none of them are regressions introduced by it.

## 1. Add `.claude-plugin/marketplace.json` so company-plugin can be installed via marketplace

**Title:** Add marketplace.json so company-plugin can be installed via marketplace

**Summary:** `board-plugin` publishes via a `.claude-plugin/marketplace.json` at repo root with a `git-subdir` source pointing at `plugin/`. `global-plugin` doesn't have one yet. Adding it requires the GitHub owner/URL the plugin will be published from, plus an owner email. Mirror the structure used in `/c/Users/logan/Desktop/projects/org/board-plugin/.claude-plugin/marketplace.json`.

## 2. `.mcp.json` placeholders are non-functional

**Title:** company-plugin .mcp.json registers 5 MCP servers as 'echo' placeholders

**Summary:** `plugin/.mcp.json` lists five servers (github, ci-cd, observability, cloud, database) with `"command": "echo"`. Either replace with real commands, replace with empty `mcpServers: {}` and document setup in the consumer README, or document why placeholders are intentional.

## 3. `skill-verification` skill instructs consumers to run `pnpm verify`, which only exists in the source repo

**Title:** skill-verification fast-mode CLI is unavailable to plugin consumers

**Summary:** `plugin/skills/skill-verification/SKILL.md` documents `pnpm verify skills/<name>/SKILL.md` as the fast-mode invocation. After install via marketplace, consumers don't have `package.json`/`tsx`/the verify TS sources. Either ship the verifier inside the plugin and rewrite as a Bash-only entry point, or update the skill text to acknowledge fast-mode is a maintainer-only path with a manual checklist for consumers.
