# Semantic Search over Git History — Shaping Notes

## Scope

Search commits by meaning — given a natural language query like "authentication changes", find commits whose messages and/or diffs are semantically related. Results return commit hash, message, date, author, files changed, and similarity score.

## Decisions

- **Separate CLI command**: `index-git` runs independently from the existing `index` command
- **Follow existing patterns**: Same embedding pipeline (Ollama nomic-embed-text), same DB (pgvector), same MCP tool structure
- **Embedding content**: Combine commit message + files changed list + truncated diff (max 2000 chars)
- **Incremental indexing**: Track indexed commit hashes, skip on re-run
- **Max commits**: Default cap of 500 commits per run (configurable via `--max-commits`)
- **No new dependencies**: Use Node.js `child_process.execFileSync` for git commands

## Context

- **Visuals:** None
- **References:** `search_code` MCP tool pattern, `src/db/queries.ts` embedding query pattern, `src/embeddings/ollama.ts` embedding generation
- **Product alignment:** Extends the semantic search mission to include git history alongside code structure

## Standards Applied

No standards defined in the project yet.
