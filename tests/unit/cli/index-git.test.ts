import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies before imports
vi.mock('../../../src/db/connection.js', () => ({
  getPool: vi.fn(() => ({ query: vi.fn() })),
  closePool: vi.fn(),
}));

vi.mock('../../../src/db/schema.js', () => ({
  setup: vi.fn(),
}));

vi.mock('../../../src/db/queries.js', () => ({
  deleteProjectEmbeddings: vi.fn(),
  listProjects: vi.fn(),
  updateEmbedding: vi.fn(),
  deleteFileEmbeddings: vi.fn(),
}));

vi.mock('../../../src/db/git-queries.js', () => ({
  upsertGitCommit: vi.fn(),
  getIndexedCommitHashes: vi.fn(),
  deleteProjectGitCommits: vi.fn(),
}));

vi.mock('../../../src/graph/operations.js', () => ({
  deleteProjectGraph: vi.fn(),
  clearFileVertices: vi.fn(),
  populateGraph: vi.fn(),
  upsertFileVertex: vi.fn(),
  getFileHash: vi.fn(),
}));

vi.mock('../../../src/parser/scanner.js', () => ({
  collectFiles: vi.fn(() => []),
  scanDirectory: vi.fn(() => []),
}));

vi.mock('../../../src/embeddings/ollama.js', () => ({
  generateEmbedding: vi.fn(),
  buildEmbeddingText: vi.fn(),
}));

vi.mock('../../../src/git/extractor.js', () => ({
  extractGitCommits: vi.fn(),
  buildCommitEmbeddingText: vi.fn(),
}));

const mockProgressInstance = {
  incrementFiles: vi.fn(),
  incrementSkipped: vi.fn(),
  addNodes: vi.fn(),
  addEmbeddings: vi.fn(),
  finish: vi.fn(),
  getStats: vi.fn(),
};

vi.mock('../../../src/cli/progress.js', () => {
  const MockProgressBar = vi.fn(function(this: typeof mockProgressInstance) {
    Object.assign(this, mockProgressInstance);
  });
  return { ProgressBar: MockProgressBar };
});

import { upsertGitCommit, getIndexedCommitHashes, deleteProjectGitCommits } from '../../../src/db/git-queries.js';
import { extractGitCommits, buildCommitEmbeddingText } from '../../../src/git/extractor.js';
import { generateEmbedding } from '../../../src/embeddings/ollama.js';
import { setup } from '../../../src/db/schema.js';
import { closePool } from '../../../src/db/connection.js';
import { deleteProjectEmbeddings, listProjects } from '../../../src/db/queries.js';
import { deleteProjectGraph } from '../../../src/graph/operations.js';
import { ProgressBar } from '../../../src/cli/progress.js';
import { Command } from 'commander';
import type { GitCommit } from '../../../src/types.js';

function sanitizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function createIndexGitCommand(): Command {
  const program = new Command();
  program.exitOverride();

  program
    .command('index-git <directory>')
    .description('Index git commit history for semantic search')
    .option('--project <name>', 'Project name')
    .option('--max-commits <n>', 'Maximum commits to index', '500')
    .action(async (directory: string, opts: { project?: string; maxCommits?: string }) => {
      const project = opts.project
        ? sanitizeProjectName(opts.project)
        : sanitizeProjectName(directory.split('/').pop() ?? directory);
      const maxCommits = parseInt(opts.maxCommits ?? '500', 10);

      await (setup as ReturnType<typeof vi.fn>)();

      const indexed = await (getIndexedCommitHashes as ReturnType<typeof vi.fn>)(project);
      const allCommits = (extractGitCommits as ReturnType<typeof vi.fn>)(directory, project) as GitCommit[];
      const newCommits = allCommits
        .filter((c: GitCommit) => !indexed.has(c.commitHash))
        .slice(0, maxCommits);
      const skippedCount = allCommits.length - newCommits.length;

      if (newCommits.length === 0) {
        await (closePool as ReturnType<typeof vi.fn>)();
        return;
      }

      const progress = new ProgressBar(newCommits.length + skippedCount, 'commits');
      for (let i = 0; i < skippedCount; i++) {
        progress.incrementSkipped();
      }

      for (const commit of newCommits) {
        const text = (buildCommitEmbeddingText as ReturnType<typeof vi.fn>)(commit) as string;
        const embedding = await (generateEmbedding as ReturnType<typeof vi.fn>)(text);
        await (upsertGitCommit as ReturnType<typeof vi.fn>)(
          commit.commitHash, project, commit.author, commit.date,
          commit.message, commit.filesChanged, commit.diffSummary, embedding
        );
        progress.addEmbeddings(1);
        progress.incrementFiles();
      }

      progress.finish();

      await (closePool as ReturnType<typeof vi.fn>)();
    });

  return program;
}

function createDeleteCommand(): Command {
  const program = new Command();
  program.exitOverride();

  program
    .command('delete <project-name>')
    .option('--force', 'Required flag')
    .action(async (projectName: string, opts: { force?: boolean }) => {
      if (!opts.force) {
        throw new Error('--force flag is required');
      }

      const project = sanitizeProjectName(projectName);

      const projects = await (listProjects as ReturnType<typeof vi.fn>)();
      const existing = projects.find((p: { project: string }) => p.project === project);
      if (!existing) {
        throw new Error(`Project "${project}" not found.`);
      }

      await (setup as ReturnType<typeof vi.fn>)();
      await (deleteProjectEmbeddings as ReturnType<typeof vi.fn>)(project);
      await (deleteProjectGraph as ReturnType<typeof vi.fn>)(project);
      await (deleteProjectGitCommits as ReturnType<typeof vi.fn>)(project);
      await (closePool as ReturnType<typeof vi.fn>)();
    });

  return program;
}

const sampleCommits: GitCommit[] = [
  {
    commitHash: 'aaa111',
    project: 'my-project',
    author: 'Alice',
    date: '2026-01-15T10:00:00Z',
    message: 'Fix auth bug',
    filesChanged: '["src/auth.ts"]',
    diffSummary: '+fixed',
  },
  {
    commitHash: 'bbb222',
    project: 'my-project',
    author: 'Bob',
    date: '2026-01-14T09:00:00Z',
    message: 'Add login page',
    filesChanged: '["src/login.ts"]',
    diffSummary: '+new page',
  },
];

describe('index-git command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('indexes new commits and calls upsertGitCommit for each', async () => {
    (getIndexedCommitHashes as ReturnType<typeof vi.fn>).mockResolvedValue(new Set());
    (extractGitCommits as ReturnType<typeof vi.fn>).mockReturnValue(sampleCommits);
    (buildCommitEmbeddingText as ReturnType<typeof vi.fn>).mockReturnValue('embedding text');
    (generateEmbedding as ReturnType<typeof vi.fn>).mockResolvedValue([0.1, 0.2]);

    const program = createIndexGitCommand();
    await program.parseAsync(['node', 'cli', 'index-git', '/repo', '--project', 'my-project']);

    expect(setup).toHaveBeenCalled();
    expect(getIndexedCommitHashes).toHaveBeenCalledWith('my-project');
    expect(extractGitCommits).toHaveBeenCalledWith('/repo', 'my-project');
    expect(upsertGitCommit).toHaveBeenCalledTimes(2);
    expect(upsertGitCommit).toHaveBeenCalledWith(
      'aaa111', 'my-project', 'Alice', '2026-01-15T10:00:00Z',
      'Fix auth bug', '["src/auth.ts"]', '+fixed', [0.1, 0.2]
    );
    expect(closePool).toHaveBeenCalled();
  });

  it('skips already-indexed commits', async () => {
    (getIndexedCommitHashes as ReturnType<typeof vi.fn>).mockResolvedValue(new Set(['aaa111']));
    (extractGitCommits as ReturnType<typeof vi.fn>).mockReturnValue(sampleCommits);
    (buildCommitEmbeddingText as ReturnType<typeof vi.fn>).mockReturnValue('text');
    (generateEmbedding as ReturnType<typeof vi.fn>).mockResolvedValue([0.1]);

    const program = createIndexGitCommand();
    await program.parseAsync(['node', 'cli', 'index-git', '/repo', '--project', 'my-project']);

    expect(upsertGitCommit).toHaveBeenCalledTimes(1);
    expect(upsertGitCommit).toHaveBeenCalledWith(
      'bbb222', expect.any(String), expect.any(String), expect.any(String),
      expect.any(String), expect.any(String), expect.any(String), [0.1]
    );
  });

  it('does nothing when all commits are already indexed', async () => {
    (getIndexedCommitHashes as ReturnType<typeof vi.fn>).mockResolvedValue(new Set(['aaa111', 'bbb222']));
    (extractGitCommits as ReturnType<typeof vi.fn>).mockReturnValue(sampleCommits);

    const program = createIndexGitCommand();
    await program.parseAsync(['node', 'cli', 'index-git', '/repo', '--project', 'my-project']);

    expect(upsertGitCommit).not.toHaveBeenCalled();
    expect(closePool).toHaveBeenCalled();
  });

  it('respects --max-commits limit', async () => {
    (getIndexedCommitHashes as ReturnType<typeof vi.fn>).mockResolvedValue(new Set());
    (extractGitCommits as ReturnType<typeof vi.fn>).mockReturnValue(sampleCommits);
    (buildCommitEmbeddingText as ReturnType<typeof vi.fn>).mockReturnValue('text');
    (generateEmbedding as ReturnType<typeof vi.fn>).mockResolvedValue([0.1]);

    const program = createIndexGitCommand();
    await program.parseAsync(['node', 'cli', 'index-git', '/repo', '--project', 'my-project', '--max-commits', '1']);

    expect(upsertGitCommit).toHaveBeenCalledTimes(1);
  });

  it('uses ProgressBar with commits label', async () => {
    (getIndexedCommitHashes as ReturnType<typeof vi.fn>).mockResolvedValue(new Set(['aaa111']));
    (extractGitCommits as ReturnType<typeof vi.fn>).mockReturnValue(sampleCommits);
    (buildCommitEmbeddingText as ReturnType<typeof vi.fn>).mockReturnValue('text');
    (generateEmbedding as ReturnType<typeof vi.fn>).mockResolvedValue([0.1]);

    const program = createIndexGitCommand();
    await program.parseAsync(['node', 'cli', 'index-git', '/repo', '--project', 'my-project']);

    expect(ProgressBar).toHaveBeenCalledWith(2, 'commits');
    expect(mockProgressInstance.incrementSkipped).toHaveBeenCalledTimes(1);
    expect(mockProgressInstance.addEmbeddings).toHaveBeenCalledWith(1);
    expect(mockProgressInstance.incrementFiles).toHaveBeenCalledTimes(1);
    expect(mockProgressInstance.finish).toHaveBeenCalled();
  });

  it('sanitizes project name', async () => {
    (getIndexedCommitHashes as ReturnType<typeof vi.fn>).mockResolvedValue(new Set());
    (extractGitCommits as ReturnType<typeof vi.fn>).mockReturnValue([]);

    const program = createIndexGitCommand();
    await program.parseAsync(['node', 'cli', 'index-git', '/repo', '--project', 'My App!']);

    expect(getIndexedCommitHashes).toHaveBeenCalledWith('my-app');
  });
});

describe('delete command includes git commits cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes git commits alongside embeddings and graph', async () => {
    (listProjects as ReturnType<typeof vi.fn>).mockResolvedValue([
      { project: 'my-app', nodeCount: 10 },
    ]);
    (deleteProjectEmbeddings as ReturnType<typeof vi.fn>).mockResolvedValue(10);
    (deleteProjectGraph as ReturnType<typeof vi.fn>).mockResolvedValue(5);
    (deleteProjectGitCommits as ReturnType<typeof vi.fn>).mockResolvedValue(25);

    const program = createDeleteCommand();
    await program.parseAsync(['node', 'cli', 'delete', 'my-app', '--force']);

    expect(deleteProjectEmbeddings).toHaveBeenCalledWith('my-app');
    expect(deleteProjectGraph).toHaveBeenCalledWith('my-app');
    expect(deleteProjectGitCommits).toHaveBeenCalledWith('my-app');
    expect(closePool).toHaveBeenCalled();
  });
});
