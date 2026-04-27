#!/usr/bin/env bash
set -euo pipefail

# Resolve the plugin root from this script's location so the script
# works whether invoked from the source repo or the consumer's plugin cache.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TARGET_DIR="${1:-.}"
mkdir -p "$TARGET_DIR/.claude"
cp "$PLUGIN_ROOT/templates/project/.claude/CLAUDE.md" "$TARGET_DIR/.claude/CLAUDE.md"
cp "$PLUGIN_ROOT/templates/project/.claude/settings.json" "$TARGET_DIR/.claude/settings.json"
cp "$PLUGIN_ROOT/templates/project/.mcp.json" "$TARGET_DIR/.mcp.json"

echo "Project Claude files copied to $TARGET_DIR"
echo "Next: replace MCP placeholder commands in $TARGET_DIR/.mcp.json"
