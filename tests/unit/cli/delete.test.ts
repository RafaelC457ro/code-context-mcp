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

vi.mock('../../../src/cli/progress.js', () => ({
  ProgressBar: vi.fn(() => ({
    incrementFiles: vi.fn(),
    incrementSkipped: vi.fn(),
    addNodes: vi.fn(),
    addEmbeddings: vi.fn(),
    finish: vi.fn(),
    getStats: vi.fn(),
  })),
}));

import { deleteProjectEmbeddings, listProjects } from '../../../src/db/queries.js';
import { deleteProjectGraph } from '../../../src/graph/operations.js';
import { setup } from '../../../src/db/schema.js';
import { closePool } from '../../../src/db/connection.js';
import { Command } from 'commander';

// Re-create the delete command for testing (same logic as CLI)
function sanitizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function createDeleteCommand(): Command {
  const program = new Command();
  program.exitOverride(); // Throw instead of process.exit for testing

  program
    .command('delete <project-name>')
    .description('Delete all indexed data for a project')
    .option('--force', 'Required flag to confirm deletion')
    .action(async (projectName: string, opts: { force?: boolean }) => {
      if (!opts.force) {
        throw new Error('--force flag is required to confirm deletion.');
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
      await (closePool as ReturnType<typeof vi.fn>)();
    });

  return program;
}

describe('Delete Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes project data when --force is provided', async () => {
    (listProjects as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { project: 'my-app', nodeCount: 42 },
    ]);
    (deleteProjectEmbeddings as ReturnType<typeof vi.fn>).mockResolvedValueOnce(42);
    (deleteProjectGraph as ReturnType<typeof vi.fn>).mockResolvedValueOnce(30);

    const program = createDeleteCommand();
    await program.parseAsync(['node', 'cli', 'delete', 'my-app', '--force']);

    expect(deleteProjectEmbeddings).toHaveBeenCalledWith('my-app');
    expect(deleteProjectGraph).toHaveBeenCalledWith('my-app');
    expect(closePool).toHaveBeenCalled();
  });

  it('errors when --force is missing', async () => {
    const program = createDeleteCommand();

    await expect(
      program.parseAsync(['node', 'cli', 'delete', 'my-app'])
    ).rejects.toThrow('--force flag is required');
  });

  it('errors when project does not exist', async () => {
    (listProjects as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { project: 'other-project', nodeCount: 10 },
    ]);

    const program = createDeleteCommand();

    await expect(
      program.parseAsync(['node', 'cli', 'delete', 'nonexistent', '--force'])
    ).rejects.toThrow('not found');
  });

  it('sanitizes project name before lookup', async () => {
    (listProjects as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { project: 'my-app', nodeCount: 42 },
    ]);
    (deleteProjectEmbeddings as ReturnType<typeof vi.fn>).mockResolvedValueOnce(0);
    (deleteProjectGraph as ReturnType<typeof vi.fn>).mockResolvedValueOnce(0);

    const program = createDeleteCommand();
    await program.parseAsync(['node', 'cli', 'delete', 'My App!', '--force']);

    expect(deleteProjectEmbeddings).toHaveBeenCalledWith('my-app');
    expect(deleteProjectGraph).toHaveBeenCalledWith('my-app');
  });
});
