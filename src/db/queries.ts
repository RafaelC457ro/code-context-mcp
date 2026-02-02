import { getPool } from './connection.js';
import type { EmbeddingHit } from '../types.js';

export async function updateEmbedding(nodeName: string, filePath: string, embedding: number[], project: string = ''): Promise<void> {
  const pool = getPool();
  const vectorStr = `[${embedding.join(',')}]`;
  await pool.query(
    `INSERT INTO public.embeddings (node_name, file_path, project, embedding)
     VALUES ($1, $2, $3, $4::vector)
     ON CONFLICT (project, node_name, file_path) DO UPDATE SET embedding = $4::vector`,
    [nodeName, filePath, project, vectorStr]
  );
}

export async function searchByEmbedding(queryEmbedding: number[], limit: number, project?: string): Promise<EmbeddingHit[]> {
  const pool = getPool();
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  let query: string;
  let params: unknown[];

  if (project !== undefined) {
    query = `SELECT node_name, file_path, project,
                    1 - (embedding <=> $1::vector) AS score
             FROM public.embeddings
             WHERE embedding IS NOT NULL AND project = $3
             ORDER BY embedding <=> $1::vector
             LIMIT $2`;
    params = [vectorStr, limit, project];
  } else {
    query = `SELECT node_name, file_path, project,
                    1 - (embedding <=> $1::vector) AS score
             FROM public.embeddings
             WHERE embedding IS NOT NULL
             ORDER BY embedding <=> $1::vector
             LIMIT $2`;
    params = [vectorStr, limit];
  }

  const result = await pool.query(query, params);

  return result.rows.map((row: Record<string, unknown>) => ({
    name: row.node_name as string,
    filePath: row.file_path as string,
    project: (row.project as string) ?? '',
    score: parseFloat(row.score as string),
  }));
}

export async function deleteFileEmbeddings(filePath: string, project: string = ''): Promise<void> {
  const pool = getPool();
  await pool.query('DELETE FROM public.embeddings WHERE file_path = $1 AND project = $2', [filePath, project]);
}

export async function deleteProjectEmbeddings(project: string): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    'DELETE FROM public.embeddings WHERE project = $1',
    [project]
  );
  return result.rowCount ?? 0;
}

export async function listProjects(): Promise<Array<{ project: string; nodeCount: number }>> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT project, COUNT(*) AS node_count FROM public.embeddings GROUP BY project ORDER BY project`
  );
  return result.rows.map((row: Record<string, unknown>) => ({
    project: (row.project as string) ?? '',
    nodeCount: parseInt(row.node_count as string, 10),
  }));
}
