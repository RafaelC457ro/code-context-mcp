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

-- Git commits table (for semantic search over git history)
CREATE TABLE IF NOT EXISTS git_commits (
  id SERIAL PRIMARY KEY,
  commit_hash TEXT NOT NULL,
  project TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  message TEXT NOT NULL,
  files_changed TEXT NOT NULL DEFAULT '[]',
  diff_summary TEXT NOT NULL DEFAULT '',
  embedding vector(768),
  UNIQUE(project, commit_hash)
);

CREATE INDEX IF NOT EXISTS idx_git_commits_vector ON git_commits USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_git_commits_project ON git_commits (project);
