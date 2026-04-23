import yaml from "js-yaml";
import type { SkillFile } from "./types.js";

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

export function parseSkill(path: string, contents: string): SkillFile {
  const lineCount = contents.endsWith("\n")
    ? contents.split("\n").length - 1
    : contents.split("\n").length;
  const match = contents.match(FRONTMATTER_RE);
  if (!match) {
    return { path, contents, frontmatter: null, body: contents, lineCount };
  }
  const [, fmText, body] = match;
  const parsed = yaml.load(fmText);
  if (parsed !== null && typeof parsed !== "object") {
    throw new Error(`Frontmatter in ${path} is not an object`);
  }
  return {
    path,
    contents,
    frontmatter: (parsed as Record<string, unknown>) ?? {},
    body,
    lineCount,
  };
}
