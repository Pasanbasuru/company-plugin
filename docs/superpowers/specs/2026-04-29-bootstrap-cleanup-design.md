---
skills_invoked:
  - superpowers:brainstorming
  - org-ai-tooling
  - simplify
  - plugin-dev:plugin-structure
  - plugin-dev:skill-development
---

# Bootstrap Cleanup — Delete `plugin/scripts/` + `plugin/templates/`

- **Date:** 2026-04-29
- **Status:** Draft — awaiting user review
- **Author:** Logan + Claude
- **Scope:** Closes parked follow-up item #4. Deletes `plugin/scripts/bootstrap-new-project.sh` and the entire `plugin/templates/project/` tree. Preserves only the `.claude/settings.json` deny-rules content as a small README copy-paste block (the determinism layer the harness enforces). Updates `plugin/README.md` and 3 mermaid diagrams to match.

## 1. Background

The 2026-04-28 audit surfaced three issues bundled in the bootstrap workflow and tracked them as item #4 in `docs/followups.md`:

1. `plugin/templates/project/.claude/CLAUDE.md` lands at a path Claude Code does not read (`<repo-root>/.claude/CLAUDE.md` instead of the recognized `<repo-root>/CLAUDE.md` or `~/.claude/CLAUDE.md`). The shipped template is invisible to the model — broken by design.
2. `plugin/templates/project/.mcp.json` ships 5 `echo` placeholder MCP servers — the same broken pattern deleted from `plugin/.mcp.json` in 0.4.0.
3. `plugin/scripts/bootstrap-new-project.sh` uses unconditional `cp`. Re-running silently overwrites existing consumer state.

After landing items #5 (rename) and #6 (baseline cleanup), item #4 is the last remaining parked item.

## 2. Karpathy lens — "delete machinery, preserve only the determinism layer"

Three pieces were considered for preservation when the rest is deleted:

| Piece | Verdict | Reason |
|---|---|---|
| `.claude/CLAUDE.md` scaffold (40 lines of generic Project/Stack/Architecture filler) | **Drop** | Filler. Any consumer can vibe-code a CLAUDE.md in 30 seconds, or have Claude generate one. The scaffold isn't insight. |
| `.mcp.json` 5 `echo` placeholders | **Drop** | Broken. The conventions are already documented in `plugin/README.md`'s existing "MCP servers" section. |
| `.claude/settings.json` deny rules (`Read(./.env)`, `Read(./.env.*)`, `Read(./secrets/**)`) | **Preserve as a README copy-paste** | Determinism layer — the harness rejects the Read tool call before the model sees it. The `secrets-and-config-safety` skill is the *judgment* layer (when/why secrets matter); these rules are the *enforcement* layer. Skill and rules complement; neither replaces the other. |

This is the "A+ trimmed" choice from brainstorm — strictly more disciplined than the maximum-purity A-zero (which would lose the determinism content) and strictly less wasteful than preserving the filler scaffold.

## 3. Approach — chosen

Single atomic commit: deletions + README updates + followups bookkeeping.

**Rejected alternatives:**

- **A-zero (pure delete, preserve nothing).** Drops a determinism primitive that costs ~6 README lines to preserve. Net loss.
- **A++ (preserve the CLAUDE.md scaffold too).** Scaffold is filler; preservation argument doesn't hold.
- **Fix in place (rewrite the script with no-clobber, repath the CLAUDE.md template, replace `.mcp.json` with `{"mcpServers": {}}`).** More machinery for the same outcome a 6-line README block delivers. Doesn't match the deletion direction taken on items #5 and #6.

## 4. Non-goals

- **Plugin-level permission auto-injection.** Shipping the deny rules inside `plugin/.claude-plugin/plugin.json` so they auto-apply on install would be cleaner long-term, but requires verifying plugin permission-merge semantics. Out of scope; consumers copy-paste.
- **README mermaid-diagram trim beyond the 3 affected diagrams.** The README has 7 mermaid diagrams total; trimming the whole set is separate cosmetic work.
- **`plugin/.claude-plugin/plugin.json` version bump.** This work is breaking by any reasonable interpretation (consumers using the bootstrap script will lose it), but the version was already bumped to 0.4.0 in the prior refactor and there's no shipped 0.4.x marketplace release yet. Defer the next bump (0.5.0) to whenever the next consumer-visible release cuts.
- **Items #1–#3 from followups.md.** Done or out of scope.

## 5. Locked decisions

### 5.1 — Deletions

| Path | Action |
|---|---|
| `plugin/scripts/bootstrap-new-project.sh` | Delete |
| `plugin/templates/project/.mcp.json` | Delete |
| `plugin/templates/project/.claude/CLAUDE.md` | Delete |
| `plugin/templates/project/.claude/settings.json` | Delete |
| `plugin/templates/project/.claude/` | Auto-removed (empty) |
| `plugin/templates/project/` | Auto-removed (empty) |
| `plugin/scripts/` | Auto-removed (empty) |
| `plugin/templates/` | Auto-removed (empty) |

After this, `plugin/` contains only `.claude-plugin/`, `skills/`, `hooks/`, and `README.md`. No scripts, no templates.

### 5.2 — `plugin/README.md` changes

(a) Drop the deferral note at line 5 (the blockquote starting `> Note: a one-command new-project setup script...`).

(b) Add a tight "Recommended setup" section near the top of the README (after the target-stack list, before "Included skills"). Exact content:

````markdown
## Recommended setup

Add these deny rules to your project's `.claude/settings.json` (create the file if it doesn't exist; merge with existing rules if it does):

```json
{
  "permissions": {
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./secrets/**)"
    ]
  }
}
```

The harness enforces these deterministically — the model never sees an attempted Read of those paths. The `secrets-and-config-safety` skill is the judgment layer (when and why secrets matter); these rules are the enforcement layer.
````

(c) Update 3 mermaid diagrams (other diagrams are unaffected):

- **"Plugin bundle layout" diagram** (around lines 161–185): drop the `TM["templates/project"]` and `BS["scripts/bootstrap-new-project.sh"]` nodes and their edges from `PJ`. Drop the corresponding `class TM templates` and `class BS scripts` lines. The `subgraph root` keeps `PJ`, `HK`, `SCR`, `SK` only.
- **"Bootstrap script and shipped project templates" diagram** (around lines 260–285): **delete the entire `<details>...</details>` block**, including the summary line. Whole subgraph is obsolete.
- **"0.4.0 surface vs removed / not shipped" diagram** (around lines 326–355): drop `C["templates/project"]` and `D["bootstrap script"]` from the `Shipped` subgraph (and their `class` lines). Do not add them to the `Not shipped` subgraph — they're being removed, not gated.

### 5.3 — `docs/followups.md` item #4

Strikethrough the title (`~~Bootstrap script + \`plugin/templates/project/\` rework~~`) per the item #3/#5/#6 precedent. Status OPEN → RESOLVED. Add resolution note pointing at this spec and the implementing commit.

## 6. Commit sequence

Single atomic commit:

```
refactor: delete plugin/scripts/ and plugin/templates/, preserve only .env deny rules in README
```

Atomic because the deletions and the README updates must travel together — leaving them split would briefly produce a state where the README documents files that no longer exist (or vice versa).

## 7. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | A consumer is using the bootstrap script in their workflow today | Very low | Low | Plugin is at 0.4.0 (pre-1.0). The README deferral note already steers consumers away. No public marketplace announcement of the bootstrap as a recommended workflow. |
| R2 | Mermaid diagram edits leave orphan `classDef` lines or syntax errors | Low | Low | Inspect the rendered README in a markdown viewer (or paste each updated diagram into a mermaid sandbox). Orphan `classDef`s are visual noise; broken syntax breaks rendering. |
| R3 | The "Recommended setup" JSON merge instructions are wrong for some consumer settings layout | Low | Low | The shape shown is the canonical Claude Code settings schema (matches `https://json.schemastore.org/claude-code-settings.json`). The "merge with existing rules if it does" wording covers the case where consumers already have a `permissions.deny` array. |
| R4 | Verifier or test-suite regression from a stray cross-reference | Low | Low | The verifier and vitest harness don't touch `plugin/scripts/` or `plugin/templates/` (confirmed by inspection of `scripts/verify/`). Run `pnpm test` post-edit; expect 46/46. |

## 8. Testing & verification

```bash
# 1. No file regressions in the test suite.
pnpm test

# 2. Self-containment check — bootstrap and templates references gone.
git grep "bootstrap-new-project" plugin/
git grep "templates/project" plugin/

# 3. Directories actually gone.
ls plugin/scripts/ plugin/templates/ 2>&1
```

Expected:
1. `pnpm test`: 46/46 pass.
2. Both `git grep` commands: zero hits.
3. `ls`: both directories return "No such file or directory".

## 9. Acceptance criteria

1. `plugin/scripts/bootstrap-new-project.sh` does not exist.
2. `plugin/templates/project/` does not exist (along with all its contents).
3. `plugin/scripts/` and `plugin/templates/` directories do not exist.
4. `plugin/README.md` no longer contains the deferral note at line 5 (the `> Note: a one-command new-project setup...` blockquote).
5. `plugin/README.md` has a "Recommended setup" section with the 4-line deny-rules JSON block per §5.2(b).
6. The 3 affected mermaid diagrams are updated per §5.2(c). The "Bootstrap script and shipped project templates" `<details>` block is deleted entirely.
7. `git grep "bootstrap-new-project" plugin/` returns zero hits.
8. `git grep "templates/project" plugin/` returns zero hits.
9. `pnpm test` returns 46/46.
10. `docs/followups.md` item #4 is marked RESOLVED with a strikethrough title and a resolution note pointing at this spec.

## 10. Handoff

After Logan reviews and approves this spec, invoke `superpowers:writing-plans` to produce the implementation plan at `docs/superpowers/plans/2026-04-29-bootstrap-cleanup.md`.
