import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { getPool, closePool } from '../../src/db/connection.js';
import { setup } from '../../src/db/schema.js';

// Set test environment variables
process.env.PGPORT = '5434';
process.env.OLLAMA_URL = 'http://localhost:11435';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const fixtureDir = resolve(__dirname, '..', 'fixtures');

export async function setupTestDB(): Promise<void> {
  await setup();
}

export async function cleanupProject(project: string): Promise<void> {
  const pool = getPool();

  // Clean embeddings
  await pool.query('DELETE FROM embeddings WHERE project = $1', [project]);

  // Clean graph vertices and edges for this project
  try {
    await pool.query(`LOAD 'age';`);
    await pool.query(`SET search_path = ag_catalog, "$user", public;`);
    await pool.query(
      `SELECT * FROM cypher('code_graph', $$ MATCH (n {project: '${project}'})-[r]-() DELETE r $$) AS (result agtype);`
    );
    await pool.query(
      `SELECT * FROM cypher('code_graph', $$ MATCH (n {project: '${project}'}) DELETE n $$) AS (result agtype);`
    );
  } catch {
    // Graph may not exist yet
  }
}

export { closePool };
