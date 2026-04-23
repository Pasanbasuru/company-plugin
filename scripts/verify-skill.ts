#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSkill } from "./verify/parse.js";
import { runChecks, formatReport } from "./verify/run.js";

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("usage: verify-skill <path-to-SKILL.md> [more paths...]");
    process.exit(2);
  }

  let anyRed = false;
  for (const arg of args) {
    const path = resolve(arg);
    const contents = readFileSync(path, "utf8");
    const skill = parseSkill(path, contents);
    const result = runChecks(skill);
    const name =
      typeof skill.frontmatter?.name === "string"
        ? (skill.frontmatter.name as string)
        : path;
    console.log(formatReport(name, result));
    console.log("");
    if (result.verdict === "RED") anyRed = true;
  }
  process.exit(anyRed ? 1 : 0);
}

main();
