# References for Fix Duplicate Call Relationships

## Similar Implementations

### C Extractor — extractCallRelationships

- **Location:** `src/parser/extractors/c.ts:199-234`
- **Relevance:** The function that extracts CALLS relationships from C function bodies
- **Key patterns:** Uses `findDescendants` to find all `call_expression` nodes, deduplicates with a `seen` Set — this works correctly

### Graph Operations — addEdge

- **Location:** `src/graph/operations.ts:61-71`
- **Relevance:** Where edges are inserted into Apache AGE — the root cause of the bug
- **Key patterns:** Uses `CREATE` which allows duplicates; needs `MERGE`

### Graph Queries — getCallees

- **Location:** `src/graph/operations.ts:317-324`
- **Relevance:** The query that returns callees for a function — lacks DISTINCT
- **Key patterns:** Cypher MATCH query returning callee nodes

### Existing Test Suite

- **Location:** `tests/unit/parser/c-extractor.test.ts:60-69`
- **Relevance:** Existing CALLS test only checks two calls from `foo` — doesn't test the multi-call-with-arguments pattern that exposed the bug
- **Key patterns:** Vitest, inline source strings, filter by `relationshipKind === 'CALLS'`

### C Source Under Test

- **Location:** `../learning-c/key-value-memory-db/src/mendb.c:52-58`
- **Relevance:** The actual code that triggered the bug — `main` calling `init_structures()` then `init_server(PORT, BUFFER_SIZE, MAX_THREADS, SERVER_BACKLOG, client_handler)`
