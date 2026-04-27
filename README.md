# global-plugin

Source repo for the `company-plugin` Claude Code plugin.

## Status

Shipping. Plugin runtime lives in `plugin/`. Repo root is dev infra only.

## Repo layout

| Path | Purpose |
|---|---|
| `plugin/` | The plugin runtime — what consumers install. Self-contained. |
| `scripts/` | Skill-verifier (TypeScript). Dev-only. |
| `.husky/` | Pre-commit hook that runs `pnpm verify` on staged SKILL.md files. |
| `docs/` | Design notes, plans, specs, audits, workflows. |
| `package.json` | Dev deps only (vitest, husky, tsx). Not shipped. |

## Local test

From any project directory:

```bash
claude --plugin-dir /absolute/path/to/global-plugin/plugin
```

Inside Claude Code:

- `/help` lists `company-plugin` skills.
- `/mcp` lists the (placeholder) MCP servers.
- `/company-plugin:architecture-guard` triggers a skill.

## Maintainer workflow

```bash
pnpm install            # one-time
pnpm test               # vitest suite
pnpm verify plugin/skills/<name>/SKILL.md   # one skill
```

The husky pre-commit hook runs `pnpm verify` automatically on staged `plugin/skills/*/SKILL.md` files.

## Consumer-facing docs

See `plugin/README.md` for what the plugin does and how to install it.
