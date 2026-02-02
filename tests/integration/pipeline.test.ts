import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDB, cleanupProject, closePool, fixtureDir } from './setup.js';
import { collectFiles, scanDirectory } from '../../src/parser/scanner.js';
import { populateGraph } from '../../src/graph/operations.js';
import { updateEmbedding, searchByEmbedding } from '../../src/db/queries.js';
import { generateEmbedding, buildEmbeddingText } from '../../src/embeddings/ollama.js';
import { findNodeByName, getCallers } from '../../src/graph/operations.js';

const TEST_PROJECT = 'test-pipeline';

describe('Indexing Pipeline (Integration)', () => {
  beforeAll(async () => {
    await setupTestDB();
    await cleanupProject(TEST_PROJECT);
  });

  afterAll(async () => {
    await cleanupProject(TEST_PROJECT);
    await closePool();
  });

  it('collects, parses, and indexes fixture files', async () => {
    const files = collectFiles(fixtureDir);
    expect(files.length).toBeGreaterThan(0);

    const scanned = scanDirectory(fixtureDir, files);
    expect(scanned.length).toBeGreaterThan(0);

    // Populate graph
    for (const file of scanned) {
      const { nodes, relationships } = file.extraction;
      await populateGraph(nodes, relationships, TEST_PROJECT);

      // Generate embeddings
      for (const node of nodes) {
        const text = buildEmbeddingText(node.name, node.signature, node.body);
        const embedding = await generateEmbedding(text);
        await updateEmbedding(node.name, node.filePath, embedding, TEST_PROJECT);
      }
    }
  });

  it('searchByEmbedding returns results for semantic queries', async () => {
    const queryEmbedding = await generateEmbedding('load configuration from file');
    const results = await searchByEmbedding(queryEmbedding, 5, TEST_PROJECT);
    expect(results.length).toBeGreaterThan(0);
  });

  it('graph queries work on indexed data', async () => {
    const node = await findNodeByName('loadConfig', TEST_PROJECT);
    expect(node).not.toBeNull();
    expect(node?.kind).toBe('function');
  });
});
