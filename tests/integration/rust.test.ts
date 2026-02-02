import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { setupTestDB, cleanupProject, closePool, fixtureDir } from './setup.js';
import { populateGraph, findNodeByName } from '../../src/graph/operations.js';
import { updateEmbedding, searchByEmbedding } from '../../src/db/queries.js';
import { generateEmbedding, buildEmbeddingText } from '../../src/embeddings/ollama.js';
import { rustExtractor } from '../../src/parser/extractors/rust.js';

const TEST_PROJECT = 'test-rust';

describe('Rust (Integration)', () => {
  beforeAll(async () => {
    await setupTestDB();
    await cleanupProject(TEST_PROJECT);

    const source = readFileSync(resolve(fixtureDir, 'sample.rs'), 'utf-8');
    const { nodes, relationships } = rustExtractor.extract('sample.rs', source);
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

  it('structs appear in graph', async () => {
    const point = await findNodeByName('Point', TEST_PROJECT);
    expect(point).not.toBeNull();
    expect(point?.kind).toBe('struct');
  });

  it('traits appear in graph', async () => {
    const drawable = await findNodeByName('Drawable', TEST_PROJECT);
    expect(drawable).not.toBeNull();
    expect(drawable?.kind).toBe('trait');
  });

  it('enums appear in graph', async () => {
    const color = await findNodeByName('Color', TEST_PROJECT);
    expect(color).not.toBeNull();
    expect(color?.kind).toBe('enum');
  });

  it('functions appear in graph', async () => {
    const render = await findNodeByName('render', TEST_PROJECT);
    expect(render).not.toBeNull();
    expect(render?.kind).toBe('function');

    const computeSqrt = await findNodeByName('compute_sqrt', TEST_PROJECT);
    expect(computeSqrt).not.toBeNull();
    expect(computeSqrt?.kind).toBe('function');
  });

  it('search returns Rust results', async () => {
    const queryEmbedding = await generateEmbedding('point coordinate distance');
    const results = await searchByEmbedding(queryEmbedding, 10, TEST_PROJECT);
    expect(results.length).toBeGreaterThan(0);

    const rsResults = results.filter(r => r.filePath.endsWith('.rs'));
    expect(rsResults.length).toBeGreaterThan(0);
  });
});
