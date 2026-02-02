-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS age;

-- Load AGE and configure search path
LOAD 'age';
SET search_path = ag_catalog, "$user", public;

-- Create the code graph
SELECT create_graph('code_graph');

-- Embeddings table (SQL-only for pgvector similarity search)
-- Linked to graph vertices via composite natural key (project, node_name, file_path)
CREATE TABLE IF NOT EXISTS embeddings (
  id SERIAL PRIMARY KEY,
  node_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  project TEXT NOT NULL DEFAULT '',
  embedding vector(768),
  UNIQUE(project, node_name, file_path)
);

CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_embeddings_project ON embeddings (project);
