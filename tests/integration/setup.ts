import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { getPool, closePool } from '../../src/db/connection.js';
import { setup, ensureProjectGraph, dropProjectGraph } from '../../src/db/schema.js';

// Set test environment variables
process.env.PGPORT = '5434';
process.env.OLLAMA_URL = 'http://localhost:11435';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const fixtureDir = resolve(__dirname, '..', 'fixtures');

export async function setupTestDB(): Promise<void> {
  await setup();
}

export async function setupProjectGraph(project: string): Promise<void> {
  await ensureProjectGraph(project);
}

export async function cleanupProject(project: string): Promise<void> {
  const pool = getPool();

  // Clean embeddings
  await pool.query('DELETE FROM embeddings WHERE project = $1', [project]);

  // Drop the project-specific graph
  try {
    await dropProjectGraph(project);
  } catch {
    // Graph may not exist yet
  }
}

export { closePool };
