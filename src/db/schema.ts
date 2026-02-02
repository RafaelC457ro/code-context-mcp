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

export async function setup(): Promise<void> {
  await setupSchema();
  await setupGraph();
}
