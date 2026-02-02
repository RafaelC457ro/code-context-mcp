import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the connection module before importing queries
vi.mock('../../../src/db/connection.js', () => {
  const mockPool = {
    query: vi.fn(),
  };
  return {
    getPool: vi.fn(() => mockPool),
  };
});

import { updateEmbedding, searchByEmbedding, deleteFileEmbeddings, deleteProjectEmbeddings, listProjects } from '../../../src/db/queries.js';
import { getPool } from '../../../src/db/connection.js';

describe('DB Queries', () => {
  const mockQuery = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    const pool = getPool();
    (pool.query as ReturnType<typeof vi.fn>) = mockQuery;
  });

  describe('updateEmbedding', () => {
    it('calls INSERT with correct parameters', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const embedding = [0.1, 0.2, 0.3];

      await updateEmbedding('myFunc', 'src/main.ts', embedding, 'my-project');

      expect(mockQuery).toHaveBeenCalledOnce();
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('INSERT INTO public.embeddings');
      expect(sql).toContain('ON CONFLICT');
      expect(params).toEqual(['myFunc', 'src/main.ts', 'my-project', '[0.1,0.2,0.3]']);
    });

    it('uses empty string as default project', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await updateEmbedding('fn', 'file.ts', [1]);

      const [, params] = mockQuery.mock.calls[0];
      expect(params[2]).toBe('');
    });
  });

  describe('searchByEmbedding', () => {
    it('returns parsed results with scores', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { node_name: 'foo', file_path: 'a.ts', project: 'p1', score: '0.95' },
          { node_name: 'bar', file_path: 'b.ts', project: 'p1', score: '0.80' },
        ],
      });

      const results = await searchByEmbedding([0.1, 0.2], 10, 'p1');

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        name: 'foo',
        filePath: 'a.ts',
        project: 'p1',
        score: 0.95,
      });
    });

    it('filters by project when provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await searchByEmbedding([0.1], 5, 'my-proj');

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('project = $3');
      expect(params).toEqual(['[0.1]', 5, 'my-proj']);
    });

    it('queries all projects when project is undefined', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await searchByEmbedding([0.1], 5);

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).not.toContain('project = $3');
      expect(params).toEqual(['[0.1]', 5]);
    });
  });

  describe('deleteFileEmbeddings', () => {
    it('deletes by file path and project', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await deleteFileEmbeddings('src/main.ts', 'proj');

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('DELETE FROM public.embeddings');
      expect(params).toEqual(['src/main.ts', 'proj']);
    });
  });

  describe('deleteProjectEmbeddings', () => {
    it('deletes all embeddings for a project and returns count', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 15, rows: [] });
      const count = await deleteProjectEmbeddings('my-project');

      expect(mockQuery).toHaveBeenCalledOnce();
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('DELETE FROM public.embeddings');
      expect(sql).toContain('project = $1');
      expect(params).toEqual(['my-project']);
      expect(count).toBe(15);
    });

    it('returns 0 when no embeddings exist', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });
      const count = await deleteProjectEmbeddings('nonexistent');
      expect(count).toBe(0);
    });
  });

  describe('listProjects', () => {
    it('returns projects with node counts', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { project: 'frontend', node_count: '42' },
          { project: 'backend', node_count: '100' },
        ],
      });

      const projects = await listProjects();
      expect(projects).toEqual([
        { project: 'frontend', nodeCount: 42 },
        { project: 'backend', nodeCount: 100 },
      ]);
    });
  });
});
