# Org AI Tooling — Patterns and References

Deep-dive content moved out of the lean SKILL.md so the trigger description stays focused. Loaded only when needed.

## Decision framework

Pick the primitive by what you're trying to do:

```
What are you trying to do?
├─ Give the model reusable knowledge / procedure       → Skill
├─ Run a specialized task in isolation                  → Subagent
├─ Enforce a deterministic rule on every tool call      → Hook
├─ Expose a stateful tool + resource surface            → MCP server
├─ Bundle the above for distribution                    → Plugin
├─ Encode project-wide invariants                       → CLAUDE.md
├─ Automate a recurring / scheduled task                → /loop (in-session) or /schedule (cloud)
├─ Run Claude in CI / headless                          → claude -p --bare --output-format json
└─ Add a user-invoked entrypoint                        → Slash command / skill with description
```

**Tiebreaker:** the primitive closest to where the information naturally lives wins. Permissions belong in settings. Formatters belong in hooks. Domain knowledge belongs in skills. Stateful integrations belong in MCP. Project conventions belong in CLAUDE.md.

## Primitive cheat-sheet

| Primitive | Lives in | Invoked by | Good for |
|-----------|----------|------------|----------|
| Skill | `.claude/skills/<name>/SKILL.md` | `/name` or auto via description | Procedures, patterns, reference |
| Subagent | `.claude/agents/<name>.md` | Auto-delegation or `Agent` tool | Isolated specialized tasks |
| Hook | `settings.json` → `hooks` | Tool lifecycle events | Deterministic enforcement |
| MCP server | `.mcp.json` | Auto-registered tools | Stateful tool surfaces |
| Plugin | `.claude-plugin/plugin.json` | `/plugin install` | Distributing bundles |
| CLAUDE.md | `./CLAUDE.md`, `~/.claude/CLAUDE.md` | Loaded every session | Persistent invariants |
| Slash command | `.claude/commands/<name>.md` or skill | `/name` | User-typed entrypoints |
| Headless SDK | `claude -p [--bare] [--output-format json]` | Shell / CI | Automation, evals, batch |

## Primitives — extended notes

### Skill

Reusable instructions / procedure / reference loaded on demand. Lives in `.claude/skills/<name>/SKILL.md` (or `~/.claude/skills/`). Use for: workflows, patterns, domain knowledge, reference material. Frontmatter controls discovery (`description`), scope (`allowed-tools`, `paths`), and isolation (`context: fork`, `agent: Explore`).

### Subagent

Isolated context window with a custom system prompt. Lives in `.claude/agents/<name>.md`. Use for: parallel work, research that would bloat main context, specialized personas. Dispatch via the `Agent` tool and return a summary, not a transcript.

### Hook

Deterministic shell / prompt / agent / HTTP handler on tool lifecycle events (`PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `Stop`, `SubagentStop`, `Notification`, `SessionStart`, `PreCompact`). Use for: autoformatting, validation, blocking unsafe commands, enforcing rules the model should not have to remember. Hook I/O is JSON on stdin/stdout with `pass` / `skipTool` / `modifyToolInput` / `modifyToolResult`. Matchers support `"Bash(npm *)"` / `"Write|Edit"` syntax.

### MCP server

Stateful tool + resource surface over stdio / SSE / HTTP. Registered via `.mcp.json`. Use for: integrations (GitHub, DB, custom APIs) that multiple agents or sessions will reuse.

### Plugin

Bundle of skills / agents / commands / hooks / MCP distributed via a marketplace (`.claude-plugin/plugin.json`). Use for: packaging a coherent capability for other humans.

### CLAUDE.md

Persistent instructions loaded every session. Project (`./CLAUDE.md`), user (`~/.claude/CLAUDE.md`), enterprise (managed). Use for: invariants, architecture notes, conventions — not one-off task state.

### Slash command

User-typed entrypoint; a skill with a good description or a command file in `.claude/commands/`.

### Agent SDK / headless CLI

`claude -p "query" [--bare] [--output-format json|stream-json]`. Use for: CI agents, scripts, evals, batch work. `--bare` skips auto-discovery for fast, hermetic runs.

## Frontmatter and contract details

- **Skill frontmatter** has real semantics: `allowed-tools`, `disable-model-invocation`, `user-invocable`, `context: fork`, `agent`, `paths`, `model`, `effort`, scoped `hooks`. Shell injection via backtick command substitution in template strings runs *before* the model sees the prompt.
- **Permission rules** are `deny > ask > allow`, first match wins, syntax `Tool(specifier)` with glob / domain / prefix support. Arrays merge across scopes.
- **Settings precedence**: managed > CLI args > `.claude/settings.local.json` > `.claude/settings.json` > `~/.claude/settings.json`. Know where a setting needs to live.
- **Subagent frontmatter**: `name`, `description` (drives auto-delegation), `tools`, `model`, `effort`, `permission-mode`, `skills` (preload), `persistent-memory`.

## Key flags

`-p` / `--print` · `--bare` · `-c` / `--continue` · `-r <id>` / `--resume` · `-w <name>` / `--worktree` · `--output-format json|stream-json` · `--permission-mode plan|acceptEdits|auto|bypassPermissions` · `--allowedTools` · `--max-turns` · `--max-budget-usd` · `--model` · `--effort` · `--append-system-prompt[-file]` · `--mcp-config` · `--settings` · `--plugin-dir` · `--from-pr` · `--include-partial-messages` · `--include-hook-events`

## Key commands

`/plan` · `/clear` · `/compact` · `/memory` · `/status` · `/permissions` · `/hooks` · `/mcp` · `/agents` · `/loop` · `/schedule` · `/simplify` · `/debug` · `/review` · `/batch` · `/find-skills` · `/superpowers:*`

## Common mistakes

- **Treating skills like docs.** Skills are instructions *to the model* about what to do. Trigger-focused, third-person, imperative — not a tutorial for a human.
- **Over-scoping the skill description.** If the description summarizes the workflow, the model follows the description and skips the body. Description = *when to trigger*. Body = *what to do*.
- **Forgetting `context: fork`.** A skill that does heavy research should fork so it does not burn main context.
- **Hardcoding paths in skills.** Use `${CLAUDE_PLUGIN_ROOT}`, `${BASH_SOURCE[0]}`-derived paths, or relative imports.
- **Building an MCP server when a Bash tool would do.** MCP has weight (process, transport, schema). A `Bash(mycli *)` permission rule is often enough.
- **Shipping without `/simplify`.** The second draft is usually half the size.
- **Not testing the hook.** Hooks run on real tool calls. A broken `PreToolUse` hook can brick a session. Test with a trivial trigger first.
- **Missing `persistent-memory` on long-lived agents.** If a subagent should remember across invocations, set it explicitly.
- **Forgetting that permissions merge across scopes.** A deny rule in `~/.claude/settings.json` still wins over an allow in the project.
