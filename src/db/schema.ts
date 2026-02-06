import { getPool } from './connection.js';

export async function setupSchema(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.embeddings (
      id SERIAL PRIMARY KEY,
      node_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      project TEXT NOT NULL DEFAULT '',
      embedding vector(768),
      UNIQUE(project, node_name, file_path)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON public.embeddings
    USING hnsw (embedding vector_cosine_ops);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_embeddings_project ON public.embeddings (project);
  `);

  // Migration: detect old constraint and migrate to project-aware schema
  const oldConstraint = await pool.query(`
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'embeddings_node_name_file_path_key'
      AND table_name = 'embeddings'
      AND table_schema = 'public';
  `);

  if (oldConstraint.rows.length > 0) {
    // Add project column if missing
    const colExists = await pool.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'embeddings' AND column_name = 'project'
        AND table_schema = 'public';
    `);
    if (colExists.rows.length === 0) {
      await pool.query(`ALTER TABLE public.embeddings ADD COLUMN project TEXT NOT NULL DEFAULT '';`);
    }

    // Drop old constraint and add new one
    await pool.query(`ALTER TABLE public.embeddings DROP CONSTRAINT embeddings_node_name_file_path_key;`);
    await pool.query(`ALTER TABLE public.embeddings ADD CONSTRAINT embeddings_project_node_name_file_path_key UNIQUE (project, node_name, file_path);`);
  }
}

export async function setupGraph(): Promise<void> {
  const pool = getPool();

  // Load AGE extension and set search path
  await pool.query(`LOAD 'age';`);
  await pool.query(`SET search_path = ag_catalog, "$user", public;`);

  // Create graph if it doesn't exist
  const graphExists = await pool.query(`
    SELECT * FROM ag_catalog.ag_graph WHERE name = 'code_graph';
  `);

  if (graphExists.rows.length === 0) {
    await pool.query(`SELECT create_graph('code_graph');`);
  }

  // Create vertex labels
  const vertexLabels = ['Function', 'Class', 'Type', 'File', 'Struct', 'Enum', 'Trait', 'Impl', 'Module', 'Contract', 'Event', 'Modifier'];
  for (const label of vertexLabels) {
    const exists = await pool.query(`
      SELECT * FROM ag_catalog.ag_label
      WHERE name = $1 AND graph = (SELECT graphid FROM ag_catalog.ag_graph WHERE name = 'code_graph');
    `, [label]);
    if (exists.rows.length === 0) {
      await pool.query(`SELECT create_vlabel('code_graph', $1);`, [label]);
    }
  }

  // Create edge labels
  const edgeLabels = ['CALLS', 'IMPORTS', 'EXTENDS', 'USES', 'RETURNS', 'DEFINED_IN', 'IMPLEMENTS'];
  for (const label of edgeLabels) {
    const exists = await pool.query(`
      SELECT * FROM ag_catalog.ag_label
      WHERE name = $1 AND graph = (SELECT graphid FROM ag_catalog.ag_graph WHERE name = 'code_graph');
    `, [label]);
    if (exists.rows.length === 0) {
      await pool.query(`SELECT create_elabel('code_graph', $1);`, [label]);
    }
  }
}

export async function setupGitSchema(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.git_commits (
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
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_git_commits_vector ON public.git_commits
    USING hnsw (embedding vector_cosine_ops);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_git_commits_project ON public.git_commits (project);
  `);
}

export async function setupFileHashSchema(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.file_hashes (
      id SERIAL PRIMARY KEY,
      file_path TEXT NOT NULL,
      project TEXT NOT NULL,
      hash TEXT NOT NULL,
      last_indexed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(project, file_path)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_file_hashes_project ON public.file_hashes (project);
  `);
}

export async function setup(): Promise<void> {
  await setupSchema();
  await setupGitSchema();
  await setupFileHashSchema();
  await setupGraph();
}

// Project-specific graph functions

function getGraphNameForProject(projectName: string): string {
  return `code_graph_${projectName}`;
}

const VERTEX_LABELS = ['Function', 'Class', 'Type', 'File', 'Struct', 'Enum', 'Trait', 'Impl', 'Module', 'Contract', 'Event', 'Modifier'];
const EDGE_LABELS = ['CALLS', 'IMPORTS', 'EXTENDS', 'USES', 'RETURNS', 'DEFINED_IN', 'IMPLEMENTS'];

export async function ensureProjectGraph(projectName: string): Promise<void> {
  const pool = getPool();
  const graphName = getGraphNameForProject(projectName);

  // Load AGE extension and set search path
  await pool.query(`LOAD 'age';`);
  await pool.query(`SET search_path = ag_catalog, "$user", public;`);

  // Create graph if it doesn't exist
  const graphExists = await pool.query(`
    SELECT * FROM ag_catalog.ag_graph WHERE name = $1;
  `, [graphName]);

  if (graphExists.rows.length === 0) {
    await pool.query(`SELECT create_graph($1);`, [graphName]);
  }

  // Create vertex labels
  for (const label of VERTEX_LABELS) {
    const exists = await pool.query(`
      SELECT * FROM ag_catalog.ag_label
      WHERE name = $1 AND graph = (SELECT graphid FROM ag_catalog.ag_graph WHERE name = $2);
    `, [label, graphName]);
    if (exists.rows.length === 0) {
      await pool.query(`SELECT create_vlabel($1, $2);`, [graphName, label]);
    }
  }

  // Create edge labels
  for (const label of EDGE_LABELS) {
    const exists = await pool.query(`
      SELECT * FROM ag_catalog.ag_label
      WHERE name = $1 AND graph = (SELECT graphid FROM ag_catalog.ag_graph WHERE name = $2);
    `, [label, graphName]);
    if (exists.rows.length === 0) {
      await pool.query(`SELECT create_elabel($1, $2);`, [graphName, label]);
    }
  }
}

export async function dropProjectGraph(projectName: string): Promise<void> {
  const pool = getPool();
  const graphName = getGraphNameForProject(projectName);

  // Load AGE extension
  await pool.query(`LOAD 'age';`);
  await pool.query(`SET search_path = ag_catalog, "$user", public;`);

  // Check if graph exists
  const graphExists = await pool.query(`
    SELECT * FROM ag_catalog.ag_graph WHERE name = $1;
  `, [graphName]);

  if (graphExists.rows.length > 0) {
    // Drop graph with cascade (removes all vertices and edges)
    await pool.query(`SELECT drop_graph($1, true);`, [graphName]);
  }
}

export async function listProjectGraphs(): Promise<string[]> {
  const pool = getPool();

  // Load AGE extension
  await pool.query(`LOAD 'age';`);
  await pool.query(`SET search_path = ag_catalog, "$user", public;`);

  // Find all graphs matching our naming convention
  const result = await pool.query(`
    SELECT name FROM ag_catalog.ag_graph WHERE name LIKE 'code_graph_%';
  `);

  // Extract project names from graph names
  return result.rows.map((row: { name: string }) =>
    row.name.replace(/^code_graph_/, '')
  );
}

export async function dropAllTables(): Promise<void> {
  const pool = getPool();
  await pool.query(`DROP TABLE IF EXISTS public.embeddings;`);
  await pool.query(`DROP TABLE IF EXISTS public.git_commits;`);
  await pool.query(`DROP TABLE IF EXISTS public.file_hashes;`);
}
