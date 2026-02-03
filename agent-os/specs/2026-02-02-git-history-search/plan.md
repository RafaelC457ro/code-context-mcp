# Semantic Search over Git History — Plan

## Summary

Add a `code-context-mcp index-git <directory>` CLI command that extracts commit data (messages + diffs) from a git repository, embeds them using the existing Ollama pipeline, stores them in a new `git_commits` pgvector table, and exposes a `search_git_history` MCP tool for semantic search.

## Tasks

1. Add `GitCommit` and `GitCommitHit` types to `src/types.ts`
2. Add `git_commits` table schema to `src/db/schema.ts` and `init.sql`
3. Create `src/db/git-queries.ts` — upsert, search, incremental tracking, delete
4. Create `src/git/extractor.ts` — git log/show parsing, embedding text construction
5. Add `index-git` CLI command to `src/cli/index.ts`, update `delete` command
6. Add `search_git_history` MCP tool to `src/mcp/server.ts`
7. Add unit tests

## Files Modified

- `src/types.ts`
- `src/db/schema.ts`
- `init.sql`
- `src/cli/index.ts`
- `src/mcp/server.ts`

## Files Created

- `src/db/git-queries.ts`
- `src/git/extractor.ts`

## Verification

- `npm run build` compiles without errors
- `npm test` passes
- Manual: `code-context-mcp index-git .` then `search_git_history` via MCP
- Incremental: second run skips already-indexed commits
- Delete: `delete <project> --force` cleans git commits too
