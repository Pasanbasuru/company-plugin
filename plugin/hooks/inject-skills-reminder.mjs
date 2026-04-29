#!/usr/bin/env node

const body = `global-plugin reminder: invoke EVERY relevant skill, not just the first one that matches. When dispatching subagents, name the required skills in the prompt and require a \`skills_invoked:\` YAML frontmatter block on the artifact.`;

const payload = {
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: body,
  },
};

process.stdout.write(JSON.stringify(payload));
