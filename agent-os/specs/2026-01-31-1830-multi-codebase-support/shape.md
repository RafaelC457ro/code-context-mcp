# Shape: Multi-Codebase Support

## Data Model Changes

### Embeddings Table
```sql
CREATE TABLE IF NOT EXISTS embeddings (
  id SERIAL PRIMARY KEY,
  node_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  project TEXT NOT NULL DEFAULT '',
  embedding vector(768),
  UNIQUE(project, node_name, file_path)
);
CREATE INDEX IF NOT EXISTS idx_embeddings_project ON embeddings (project);
```

### Graph Vertices
All vertices gain a `project` property (string, defaults to `''`).

## API Changes

### CLI
- `code-context-mcp index <dir>` auto-derives project from `basename(dir)`
- `--project <name>` overrides auto-derived name
- Animated progress bar during indexing

### MCP Tools
- All existing tools gain optional `project` parameter
- New `list_projects` tool returns project names and node counts

## Migration
- Detect old unique constraint `embeddings_node_name_file_path_key`
- Drop old constraint, add `project` column, add new composite constraint
