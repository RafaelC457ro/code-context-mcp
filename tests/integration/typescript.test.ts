import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { setupTestDB, setupProjectGraph, cleanupProject, closePool, fixtureDir } from './setup.js';
import { populateGraph, findNodeByName } from '../../src/graph/operations.js';
import { updateEmbedding, searchByEmbedding } from '../../src/db/queries.js';
import { generateEmbedding, buildEmbeddingText } from '../../src/embeddings/ollama.js';
import { typescriptExtractor } from '../../src/parser/extractors/typescript.js';

const TEST_PROJECT = 'test-typescript';

describe('TypeScript (Integration)', () => {
  beforeAll(async () => {
    await setupTestDB();
    await cleanupProject(TEST_PROJECT);
    await setupProjectGraph(TEST_PROJECT);

    const source = readFileSync(resolve(fixtureDir, 'sample.ts'), 'utf-8');
    const { nodes, relationships } = typescriptExtractor.extract('sample.ts', source);
    await populateGraph(nodes, relationships, TEST_PROJECT);

    for (const node of nodes) {
      const text = buildEmbeddingText(node.name, node.signature, node.body);
      const embedding = await generateEmbedding(text);
      await updateEmbedding(node.name, node.filePath, embedding, TEST_PROJECT);
    }
  }, 120_000);

  afterAll(async () => {
    await cleanupProject(TEST_PROJECT);
    await closePool();
  });

  it('classes appear in graph', async () => {
    const logger = await findNodeByName('Logger', TEST_PROJECT);
    expect(logger).not.toBeNull();
    expect(logger?.kind).toBe('class');
  });

  it('functions appear in graph', async () => {
    const loadConfig = await findNodeByName('loadConfig', TEST_PROJECT);
    expect(loadConfig).not.toBeNull();
    expect(loadConfig?.kind).toBe('function');

    const greet = await findNodeByName('greet', TEST_PROJECT);
    expect(greet).not.toBeNull();
    expect(greet?.kind).toBe('function');
  });

  it('interfaces and types appear in graph', async () => {
    const config = await findNodeByName('Config', TEST_PROJECT);
    expect(config).not.toBeNull();
    expect(config?.kind).toBe('interface');

    const status = await findNodeByName('Status', TEST_PROJECT);
    expect(status).not.toBeNull();
    expect(status?.kind).toBe('type');
  });

  it('search returns TypeScript results', async () => {
    const queryEmbedding = await generateEmbedding('load configuration from file');
    const results = await searchByEmbedding(queryEmbedding, 10, TEST_PROJECT);
    expect(results.length).toBeGreaterThan(0);

    const tsResults = results.filter(r => r.filePath.endsWith('.ts'));
    expect(tsResults.length).toBeGreaterThan(0);
  });
});
