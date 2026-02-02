# References

## Existing Patterns

### File-level deletion — `clearFileVertices()`

- **Location:** `src/graph/operations.ts:73-82`
- **Relevance:** Same two-step AGE deletion pattern (edges first, then vertices)
- **Key pattern:** AGE doesn't support `DETACH DELETE`, so edges must be deleted separately before vertices

### File-level embedding deletion — `deleteFileEmbeddings()`

- **Location:** `src/db/queries.ts:50-53`
- **Relevance:** Same table, same parameterized query pattern, just filtering by `project` instead of `file_path`

### CLI argument parsing — `parseArgs()`

- **Location:** `src/cli/index.ts:20-37`
- **Relevance:** Being replaced by commander.js; reference for understanding current arg structure
