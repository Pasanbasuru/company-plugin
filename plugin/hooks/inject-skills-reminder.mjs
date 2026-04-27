#!/usr/bin/env node
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
if (!pluginRoot) {
  process.stdout.write("{}");
  process.exit(0);
}

const skillsDir = join(pluginRoot, "skills");
if (!existsSync(skillsDir)) {
  process.stdout.write("{}");
  process.exit(0);
}

const hookEvent = process.argv[2] || "SessionStart";

function parseFrontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out = {};
  let key = null;
  let buf = [];
  for (const rawLine of m[1].split(/\r?\n/)) {
    const kv = rawLine.match(/^([A-Za-z_-]+):\s?(.*)$/);
    if (kv) {
      if (key) out[key] = buf.join(" ").trim();
      key = kv[1];
      buf = [kv[2]];
    } else {
      buf.push(rawLine.trim());
    }
  }
  if (key) out[key] = buf.join(" ").trim();
  return out;
}

const skills = [];
for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  if (entry.name.startsWith("_")) continue;
  const file = join(skillsDir, entry.name, "SKILL.md");
  if (!existsSync(file)) continue;
  const fm = parseFrontmatter(readFileSync(file, "utf8"));
  if (!fm.name || !fm.description) continue;
  let desc = fm.description.trim();
  if (desc.startsWith('"') && desc.endsWith('"')) desc = desc.slice(1, -1);
  skills.push({ name: fm.name, description: desc });
}
skills.sort((a, b) => a.name.localeCompare(b.name));

const rosterLines = skills.map(
  (s) => `- **global-plugin:${s.name}** — ${s.description}`,
);

const header =
  hookEvent === "UserPromptSubmit"
    ? "Company-plugin skills reminder (reinforcement — full roster was injected at session start):"
    : "Company-plugin skills are installed and enabled in this session.";

const body = `<EXTREMELY_IMPORTANT>
${header}

## The rule

Before writing code, editing files, or dispatching a subagent in this project, check the roster below and invoke every global-plugin skill that could apply — even at 1% relevance. Use the \`Skill\` tool with the fully qualified name \`global-plugin:<skill-name>\`.

These skills extend (not replace) \`superpowers:*\`. Invoke BOTH where relevant — e.g. \`superpowers:test-driven-development\` PLUS \`global-plugin:test-strategy-enforcement\`.

## Subagent propagation (critical)

\`superpowers:using-superpowers\` contains a \`<SUBAGENT-STOP>\` guard that tells dispatched subagents to skip its skill-check rule. That guard does NOT apply to this reminder.

Whenever you dispatch a subagent via the \`Agent\` tool (including superpowers workflows: brainstorming → writing-plans → executing-plans → subagent-driven-development → requesting-code-review), you MUST embed this instruction into the subagent's prompt:

> "This project uses global-plugin. Before/while doing your task, invoke every relevant \`global-plugin:*\` skill from the roster. The roster is listed in a SessionStart system-reminder in your context."

Without that line in the dispatch prompt, the subagent will not invoke company skills.

## Roster

${rosterLines.join("\n")}

## Priority

User instructions (CLAUDE.md, direct requests) > global-plugin skills = superpowers skills > default behavior. When a superpowers skill and a global-plugin skill both apply, run both; they are complementary, not competing.
</EXTREMELY_IMPORTANT>`;

const payload = {
  hookSpecificOutput: {
    hookEventName: hookEvent,
    additionalContext: body,
  },
};

process.stdout.write(JSON.stringify(payload));
