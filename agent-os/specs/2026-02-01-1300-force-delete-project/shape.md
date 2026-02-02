# Force Delete Project — Shaping Notes

## Scope

Add a `delete` CLI command that force-deletes all stored data (embeddings + graph) for a single named project. Migrate the CLI from manual argument parsing to commander.js.

## Decisions

- **Two separate operations** (delete + re-index) rather than a single `recreate` command — simpler, more composable
- **Single project delete only** — no `--all` flag; keeps the blast radius small
- **commander.js** chosen over keeping manual parsing — project is accumulating commands
- **CLI only, not MCP** — destructive operations should require explicit user intent at the terminal

## Context

- **Visuals:** None
- **References:** Existing `clearFileVertices()` in `src/graph/operations.ts` for the edges-first-then-vertices AGE deletion pattern
- **Product alignment:** Aligns with CLI indexer in Phase 1 roadmap; project management is a natural extension

## Standards Applied

No standards defined yet (agent-os/standards/index.yml is empty).
