# Shape: Cypher-first Architecture

## Data Model

### Graph Vertices (Apache AGE)

**CodeNode vertices** (labels: Function, Class, Type, File):
- `name` (string) — function/class/type name
- `file_path` (string) — relative file path
- `kind` (string) — node kind (function, class, type, interface, import)
- `signature` (string) — code signature
- `body` (string) — full source code body
- `start_line` (integer) — start line number
- `end_line` (integer) — end line number

**File vertices** (label: File):
- `path` (string) — relative file path
- `hash` (string) — content hash for change detection

### Graph Edges
- `CALLS` — function calls function
- `IMPORTS` — file imports from file
- `EXTENDS` — class extends class
- `USES` — function uses type
- `RETURNS` — function returns type
- `DEFINED_IN` — node defined in file

### SQL Table (pgvector only)

```sql
embeddings (
  id SERIAL PRIMARY KEY,
  node_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  embedding vector(768),
  UNIQUE(node_name, file_path)
)
```

## Data Flow

### Indexing
1. Check file hash via Cypher (`getFileHash`)
2. Clear old embeddings via SQL (`deleteFileEmbeddings`)
3. Clear old graph vertices via Cypher (`clearFileVertices`)
4. Create file vertex via Cypher (`upsertFileVertex`)
5. Populate code vertices + edges via Cypher (`populateGraph`)
6. Generate + store embeddings via SQL (`updateEmbedding`)

### Search
1. SQL vector similarity → `EmbeddingHit[]` (name, filePath, score)
2. Cypher enrichment → full `CodeNode` data per hit

### Lookups
All lookups go through Cypher: `findNodeByName`, `findNodesByFile`, `getCallers`, `getCallees`, etc.
