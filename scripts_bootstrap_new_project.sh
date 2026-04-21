#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-.}"
mkdir -p "$TARGET_DIR/.claude"
cp templates/project/.claude/CLAUDE.md "$TARGET_DIR/.claude/CLAUDE.md"
cp templates/project/.claude/settings.json "$TARGET_DIR/.claude/settings.json"
cp templates/project/.mcp.json "$TARGET_DIR/.mcp.json"

echo "Project Claude files copied to $TARGET_DIR"
echo "Next: replace MCP placeholder commands in $TARGET_DIR/.mcp.json"
