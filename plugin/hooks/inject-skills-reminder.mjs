#!/usr/bin/env node

const hookEvent = process.argv[2] || "SessionStart";

const sessionStartBody = `global-plugin is active. Invoke EVERY relevant skill (not just the first match) before writing code, editing files, or dispatching subagents. When dispatching subagents, name the required \`global-plugin:*\` skills in the subagent prompt and require a \`skills_invoked:\` YAML frontmatter block on the artifact.`;

const userPromptSubmitBody = `global-plugin reminder: invoke EVERY relevant skill, not just the first one that matches. When dispatching subagents, name the required skills in the prompt and require a \`skills_invoked:\` YAML frontmatter block on the artifact.`;

const body = hookEvent === "UserPromptSubmit" ? userPromptSubmitBody : sessionStartBody;

const payload = {
  hookSpecificOutput: {
    hookEventName: hookEvent,
    additionalContext: body,
  },
};

process.stdout.write(JSON.stringify(payload));
