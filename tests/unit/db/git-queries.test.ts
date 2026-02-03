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

import { upsertGitCommit, searchGitCommits, getIndexedCommitHashes, deleteProjectGitCommits } from '../../../src/db/git-queries.js';
import { getPool } from '../../../src/db/connection.js';

describe('Git Queries', () => {
  const mockQuery = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    const pool = getPool();
    (pool.query as ReturnType<typeof vi.fn>) = mockQuery;
  });

  describe('upsertGitCommit', () => {
    it('calls INSERT with correct parameters', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const embedding = [0.1, 0.2, 0.3];

      await upsertGitCommit(
        'abc123', 'my-project', 'Alice', '2026-01-15T10:00:00Z',
        'fix auth bug', '["src/auth.ts"]', 'diff content', embedding
      );

      expect(mockQuery).toHaveBeenCalledOnce();
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('INSERT INTO public.git_commits');
      expect(sql).toContain('ON CONFLICT');
      expect(params).toEqual([
        'abc123', 'my-project', 'Alice', '2026-01-15T10:00:00Z',
        'fix auth bug', '["src/auth.ts"]', 'diff content', '[0.1,0.2,0.3]',
      ]);
    });

    it('updates embedding on conflict', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await upsertGitCommit(
        'abc123', 'proj', 'Bob', '2026-01-01T00:00:00Z',
        'msg', '[]', '', [1, 2]
      );

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('ON CONFLICT (project, commit_hash) DO UPDATE');
      expect(sql).toContain('embedding = $8::vector');
    });
  });

  describe('searchGitCommits', () => {
    it('returns parsed results with scores', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            commit_hash: 'abc123',
            project: 'p1',
            author: 'Alice',
            date: new Date('2026-01-15T10:00:00Z'),
            message: 'fix auth',
            files_changed: '["src/auth.ts"]',
            diff_summary: 'diff...',
            score: '0.92',
          },
        ],
      });

      const results = await searchGitCommits([0.1, 0.2], 10, 'p1');

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        commitHash: 'abc123',
        project: 'p1',
        author: 'Alice',
        date: '2026-01-15T10:00:00.000Z',
        message: 'fix auth',
        filesChanged: '["src/auth.ts"]',
        diffSummary: 'diff...',
        score: 0.92,
      });
    });

    it('filters by project when provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await searchGitCommits([0.1], 5, 'my-proj');

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('project = $3');
      expect(params).toEqual(['[0.1]', 5, 'my-proj']);
    });

    it('queries all projects when project is undefined', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await searchGitCommits([0.1], 5);

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).not.toContain('project = $3');
      expect(params).toEqual(['[0.1]', 5]);
    });
  });

  describe('getIndexedCommitHashes', () => {
    it('returns a Set of commit hashes', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { commit_hash: 'aaa111' },
          { commit_hash: 'bbb222' },
          { commit_hash: 'ccc333' },
        ],
      });

      const result = await getIndexedCommitHashes('my-project');

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(3);
      expect(result.has('aaa111')).toBe(true);
      expect(result.has('bbb222')).toBe(true);
      expect(result.has('ccc333')).toBe(true);

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('SELECT commit_hash');
      expect(sql).toContain('project = $1');
      expect(params).toEqual(['my-project']);
    });

    it('returns empty Set when no commits indexed', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await getIndexedCommitHashes('empty-project');
      expect(result.size).toBe(0);
    });
  });

  describe('deleteProjectGitCommits', () => {
    it('deletes all git commits for a project and returns count', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 25, rows: [] });
      const count = await deleteProjectGitCommits('my-project');

      expect(mockQuery).toHaveBeenCalledOnce();
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('DELETE FROM public.git_commits');
      expect(sql).toContain('project = $1');
      expect(params).toEqual(['my-project']);
      expect(count).toBe(25);
    });

    it('returns 0 when no commits exist', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });
      const count = await deleteProjectGitCommits('nonexistent');
      expect(count).toBe(0);
    });
  });
});
