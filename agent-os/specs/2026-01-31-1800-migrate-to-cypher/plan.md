# Migrate to Maximum Cypher (Apache AGE)

## Goal

Move all data operations to Cypher via Apache AGE. Only keep SQL for pgvector embedding storage (no Cypher equivalent for vector similarity search).

## What Changes

### Before: Hybrid SQL + Cypher
- `files` SQL table + `code_nodes` SQL table (with pgvector embeddings)
- Graph vertices store minimal properties (name, file_path, kind, lines)
- SQL handles: CRUD, lookups, vector search
- Cypher handles: relationship traversal only

### After: Cypher-first
- **Drop** `files` and `code_nodes` SQL tables
- **Add** minimal `embeddings` SQL table (node_name, file_path, embedding vector)
- Graph vertices store **all** properties (name, file_path, kind, signature, body, start_line, end_line)
- File tracking moves to `File` graph vertices (with hash property)
- Cypher handles: all CRUD, lookups, traversal
- SQL handles: only vector similarity search

### Cross-reference strategy
Link graph vertices to embeddings table via composite natural key `(name, file_path)`. Search flow: SQL returns `(name, file_path, score)` → Cypher enriches with full node data.

## Files Modified

1. `init.sql` — Replace schema with embeddings-only table
2. `src/types.ts` — Add `EmbeddingHit` interface
3. `src/db/schema.ts` — Replace SQL tables with embeddings table, add DEFINED_IN edge label
4. `src/graph/operations.ts` — Primary data access layer with full CRUD
5. `src/db/queries.ts` — Reduced to embeddings-only operations
6. `src/mcp/server.ts` — Switch imports to graph operations
7. `src/cli/index.ts` — New Cypher-first indexing loop

## Key Risk: Body escaping

Source code stored as graph vertex properties contains quotes, backslashes, template literals, regex, etc. The `escapeAGE` function handles: `'`, `\`, `\n`, `\t`, `\r`. If escaping proves fragile, fall back to base64-encoding the body property.
