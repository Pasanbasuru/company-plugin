import yaml from "js-yaml";
import type { SkillFile } from "./types.js";

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

export function parseSkill(path: string, contents: string): SkillFile {
  // Normalize line endings and strip BOM so downstream regexes work on Windows files
  const normalized = contents.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const lineCount = normalized.endsWith("\n")
    ? normalized.split("\n").length - 1
    : normalized.split("\n").length;

  const match = normalized.match(FRONTMATTER_RE);
  if (!match) {
    return { path, contents: normalized, frontmatter: null, body: normalized, lineCount };
  }
  const [, fmText, body] = match;
  const parsed = yaml.load(fmText);

  // Empty frontmatter (---\n---\n) — treat as no frontmatter so downstream produces clean findings
  if (parsed === undefined) {
    return { path, contents: normalized, frontmatter: null, body, lineCount };
  }

  if (Array.isArray(parsed)) {
    throw new Error(
      `Frontmatter in ${path} is a YAML list, expected a mapping of key/value pairs.`,
    );
  }
  if (parsed !== null && typeof parsed !== "object") {
    throw new Error(
      `Frontmatter in ${path} is not a YAML mapping (got ${typeof parsed}). ` +
      `Expected 'name: ...' / 'description: ...' pairs between the --- fences.`,
    );
  }

  return {
    path,
    contents: normalized,
    frontmatter: (parsed as Record<string, unknown>) ?? {},
    body,
    lineCount,
  };
}
