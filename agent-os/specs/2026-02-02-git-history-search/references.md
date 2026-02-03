# References for Git History Search

## Similar Implementations

### search_code MCP tool

- **Location:** `src/mcp/server.ts` (lines 30-69)
- **Relevance:** Direct pattern to follow for the new `search_git_history` tool
- **Key patterns:** Generate embedding for query, search by cosine similarity, return enriched results as JSON

### Embedding queries (pgvector)

- **Location:** `src/db/queries.ts`
- **Relevance:** Same INSERT ON CONFLICT + cosine distance search pattern for the new `git_commits` table
- **Key patterns:** `searchByEmbedding` uses `1 - (embedding <=> $1::vector) AS score`, optional project filter, LIMIT parameter

### Embedding generation

- **Location:** `src/embeddings/ollama.ts`
- **Relevance:** Reuse `generateEmbedding()` directly; follow `buildEmbeddingText()` truncation pattern
- **Key patterns:** Truncate input to reasonable length, combine name + signature + body into single embedding text

### CLI index command

- **Location:** `src/cli/index.ts` (lines 29-140)
- **Relevance:** Pattern for the new `index-git` command structure
- **Key patterns:** Commander.js command definition, project name sanitization, incremental indexing via hash comparison, progress reporting, cleanup on delete
