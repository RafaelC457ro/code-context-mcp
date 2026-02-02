# Multi-Codebase Support + CLI Progress

## Goal
Add project isolation so multiple codebases can be indexed independently, a `list_projects` MCP tool for discovery, and an animated CLI progress bar.

## Architecture
Property-based isolation: add `project` property to every graph vertex and `project` column in embeddings table.

- When `project` is provided: scope all queries to that project
- When `project` is omitted: operate across all projects (backwards compatible)
- Project name auto-derived from directory basename, overridable with `--project`

## Files Modified
1. `src/types.ts` — add ProgressStats, project to EmbeddingHit
2. `init.sql` — add project column
3. `src/db/schema.ts` — schema migration + new constraint
4. `src/db/queries.ts` — project param on all functions + listProjects
5. `src/graph/operations.ts` — project param on all functions + listGraphProjects
6. `src/cli/progress.ts` — new file
7. `src/cli/index.ts` — project derivation + progress bar
8. `src/mcp/server.ts` — list_projects tool + project param on all tools
9. `README.md` — new file
