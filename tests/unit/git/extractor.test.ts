import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { extractGitCommits, buildCommitEmbeddingText } from '../../../src/git/extractor.js';
import type { GitCommit } from '../../../src/types.js';

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

const mockExecFileSync = vi.mocked(execFileSync);
const mockExistsSync = vi.mocked(existsSync);

const FIELD_DELIMITER = '---FIELD_DELIMITER---';
const COMMIT_DELIMITER = '---COMMIT_DELIMITER---';

function fakeLogEntry(hash: string, author: string, date: string, subject: string, body: string): string {
  return `${hash}${FIELD_DELIMITER}${author}${FIELD_DELIMITER}${date}${FIELD_DELIMITER}${subject}${FIELD_DELIMITER}${body}${COMMIT_DELIMITER}`;
}

describe('Git Extractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractGitCommits', () => {
    it('throws when directory is not a git repo', () => {
      mockExistsSync.mockReturnValue(false);

      expect(() => extractGitCommits('/some/dir', 'proj')).toThrow('Not a git repository');
    });

    it('returns empty array when git log produces no output', () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFileSync.mockReturnValueOnce('');

      const result = extractGitCommits('/repo', 'proj');
      expect(result).toEqual([]);
    });

    it('returns empty array when git log fails', () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFileSync.mockImplementationOnce(() => { throw new Error('git failed'); });

      const result = extractGitCommits('/repo', 'proj');
      expect(result).toEqual([]);
    });

    it('parses a single commit correctly', () => {
      mockExistsSync.mockReturnValue(true);

      const logOutput = fakeLogEntry(
        'abc123def456', 'Alice', '2026-01-15T10:00:00+00:00',
        'Fix authentication bug', 'Detailed body description'
      );

      // git log call
      mockExecFileSync.mockReturnValueOnce((logOutput));
      // git show --name-only (files changed)
      mockExecFileSync.mockReturnValueOnce(('src/auth.ts\nsrc/login.ts\n'));
      // git show (diff)
      mockExecFileSync.mockReturnValueOnce(('diff --git a/src/auth.ts\n+fixed line\n'));

      const result = extractGitCommits('/repo', 'my-project');

      expect(result).toHaveLength(1);
      expect(result[0].commitHash).toBe('abc123def456');
      expect(result[0].author).toBe('Alice');
      expect(result[0].date).toBe('2026-01-15T10:00:00+00:00');
      expect(result[0].message).toBe('Fix authentication bug\n\nDetailed body description');
      expect(result[0].project).toBe('my-project');

      const filesChanged = JSON.parse(result[0].filesChanged);
      expect(filesChanged).toContain('src/auth.ts');
      expect(filesChanged).toContain('src/login.ts');

      expect(result[0].diffSummary).toContain('+fixed line');
    });

    it('parses multiple commits', () => {
      mockExistsSync.mockReturnValue(true);

      const logOutput = [
        fakeLogEntry('aaa111', 'Alice', '2026-01-15T10:00:00Z', 'First commit', ''),
        fakeLogEntry('bbb222', 'Bob', '2026-01-14T09:00:00Z', 'Second commit', ''),
      ].join('\n');

      mockExecFileSync.mockReturnValueOnce((logOutput));
      // For each commit: name-only + diff
      mockExecFileSync.mockReturnValueOnce(('file1.ts\n'));
      mockExecFileSync.mockReturnValueOnce(('diff1\n'));
      mockExecFileSync.mockReturnValueOnce(('file2.ts\n'));
      mockExecFileSync.mockReturnValueOnce(('diff2\n'));

      const result = extractGitCommits('/repo', 'proj');

      expect(result).toHaveLength(2);
      expect(result[0].commitHash).toBe('aaa111');
      expect(result[1].commitHash).toBe('bbb222');
    });

    it('handles commit with no body', () => {
      mockExistsSync.mockReturnValue(true);

      const logOutput = fakeLogEntry('abc123', 'Alice', '2026-01-15T10:00:00Z', 'Short message', '');

      mockExecFileSync.mockReturnValueOnce((logOutput));
      mockExecFileSync.mockReturnValueOnce((''));
      mockExecFileSync.mockReturnValueOnce((''));

      const result = extractGitCommits('/repo', 'proj');

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('Short message');
    });

    it('filters out binary file markers from diff', () => {
      mockExistsSync.mockReturnValue(true);

      const logOutput = fakeLogEntry('abc123', 'Alice', '2026-01-15T10:00:00Z', 'Add image', '');

      mockExecFileSync.mockReturnValueOnce((logOutput));
      mockExecFileSync.mockReturnValueOnce(('logo.png\n'));
      mockExecFileSync.mockReturnValueOnce(('Binary files /dev/null and b/logo.png differ\n+real diff line\n'));

      const result = extractGitCommits('/repo', 'proj');

      expect(result[0].diffSummary).not.toContain('Binary files');
      expect(result[0].diffSummary).toContain('+real diff line');
    });

    it('handles failed git show gracefully', () => {
      mockExistsSync.mockReturnValue(true);

      const logOutput = fakeLogEntry('abc123', 'Alice', '2026-01-15T10:00:00Z', 'msg', '');

      mockExecFileSync.mockReturnValueOnce((logOutput));
      // git show --name-only fails
      mockExecFileSync.mockImplementationOnce(() => { throw new Error('show failed'); });
      // git show (diff) fails
      mockExecFileSync.mockImplementationOnce(() => { throw new Error('show failed'); });

      const result = extractGitCommits('/repo', 'proj');

      expect(result).toHaveLength(1);
      expect(result[0].filesChanged).toBe('[]');
      expect(result[0].diffSummary).toBe('');
    });
  });

  describe('buildCommitEmbeddingText', () => {
    const baseCommit: GitCommit = {
      commitHash: 'abc123',
      project: 'proj',
      author: 'Alice',
      date: '2026-01-15T10:00:00Z',
      message: 'Fix authentication bug',
      filesChanged: '["src/auth.ts","src/login.ts"]',
      diffSummary: '+added new check\n-removed old check',
    };

    it('combines message, files, and diff', () => {
      const result = buildCommitEmbeddingText(baseCommit);

      expect(result).toContain('Fix authentication bug');
      expect(result).toContain('src/auth.ts');
      expect(result).toContain('src/login.ts');
      expect(result).toContain('+added new check');
      expect(result).toContain('-removed old check');
    });

    it('truncates long diffs to fit within default budget', () => {
      const longDiff = 'x'.repeat(10000);
      const commit: GitCommit = { ...baseCommit, diffSummary: longDiff };

      const result = buildCommitEmbeddingText(commit);

      expect(result).toContain('...');
      expect(result.length).toBeLessThanOrEqual(6004); // 6000 budget + '...'
    });

    it('does not truncate short diffs', () => {
      const result = buildCommitEmbeddingText(baseCommit);

      expect(result).not.toContain('...');
    });

    it('respects custom maxLength parameter', () => {
      const longDiff = 'x'.repeat(5000);
      const commit: GitCommit = { ...baseCommit, diffSummary: longDiff };

      const result = buildCommitEmbeddingText(commit, 500);

      expect(result.length).toBeLessThanOrEqual(504); // 500 + '...'
      expect(result).toContain('...');
    });

    it('truncates header when message + files exceed budget', () => {
      const longMessage = 'y'.repeat(7000);
      const commit: GitCommit = { ...baseCommit, message: longMessage };

      const result = buildCommitEmbeddingText(commit, 6000);

      expect(result.length).toBeLessThanOrEqual(6004);
      expect(result).toContain('...');
    });

    it('allocates remaining budget to diff after message and files', () => {
      const shortCommit: GitCommit = {
        ...baseCommit,
        message: 'short',
        filesChanged: '["a.ts"]',
        diffSummary: 'z'.repeat(100),
      };

      const result = buildCommitEmbeddingText(shortCommit, 6000);

      // Short commit should include full diff without truncation
      expect(result).toContain('z'.repeat(100));
      expect(result).not.toContain('...');
    });

    it('handles invalid JSON in filesChanged gracefully', () => {
      const commit: GitCommit = { ...baseCommit, filesChanged: 'not-json' };

      const result = buildCommitEmbeddingText(commit);

      expect(result).toContain('not-json');
    });

    it('handles empty files list', () => {
      const commit: GitCommit = { ...baseCommit, filesChanged: '[]' };

      const result = buildCommitEmbeddingText(commit);

      expect(result).toContain('Files changed:');
    });
  });
});
