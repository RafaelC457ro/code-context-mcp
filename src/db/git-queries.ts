import { getPool } from './connection.js';
import type { GitCommitHit } from '../types.js';

export async function upsertGitCommit(
  commitHash: string,
  project: string,
  author: string,
  date: string,
  message: string,
  filesChanged: string,
  diffSummary: string,
  embedding: number[]
): Promise<void> {
  const pool = getPool();
  const vectorStr = `[${embedding.join(',')}]`;
  await pool.query(
    `INSERT INTO public.git_commits (commit_hash, project, author, date, message, files_changed, diff_summary, embedding)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)
     ON CONFLICT (project, commit_hash) DO UPDATE SET
       embedding = $8::vector,
       message = $5,
       files_changed = $6,
       diff_summary = $7`,
    [commitHash, project, author, date, message, filesChanged, diffSummary, vectorStr]
  );
}

export async function searchGitCommits(
  queryEmbedding: number[],
  limit: number,
  project?: string
): Promise<GitCommitHit[]> {
  const pool = getPool();
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  let query: string;
  let params: unknown[];

  if (project !== undefined) {
    query = `SELECT commit_hash, project, author, date, message, files_changed, diff_summary,
                    1 - (embedding <=> $1::vector) AS score
             FROM public.git_commits
             WHERE embedding IS NOT NULL AND project = $3
             ORDER BY embedding <=> $1::vector
             LIMIT $2`;
    params = [vectorStr, limit, project];
  } else {
    query = `SELECT commit_hash, project, author, date, message, files_changed, diff_summary,
                    1 - (embedding <=> $1::vector) AS score
             FROM public.git_commits
             WHERE embedding IS NOT NULL
             ORDER BY embedding <=> $1::vector
             LIMIT $2`;
    params = [vectorStr, limit];
  }

  const result = await pool.query(query, params);

  return result.rows.map((row: Record<string, unknown>) => ({
    commitHash: row.commit_hash as string,
    project: (row.project as string) ?? '',
    author: row.author as string,
    date: (row.date as Date).toISOString(),
    message: row.message as string,
    filesChanged: row.files_changed as string,
    diffSummary: row.diff_summary as string,
    score: parseFloat(row.score as string),
  }));
}

export async function getIndexedCommitHashes(project: string): Promise<Set<string>> {
  const pool = getPool();
  const result = await pool.query(
    'SELECT commit_hash FROM public.git_commits WHERE project = $1',
    [project]
  );
  return new Set(result.rows.map((row: Record<string, unknown>) => row.commit_hash as string));
}

export async function deleteProjectGitCommits(project: string): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    'DELETE FROM public.git_commits WHERE project = $1',
    [project]
  );
  return result.rowCount ?? 0;
}
