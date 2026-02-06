import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { setupTestDB, setupProjectGraph, cleanupProject, closePool, fixtureDir } from './setup.js';
import { populateGraph, findNodeByName } from '../../src/graph/operations.js';
import { updateEmbedding, searchByEmbedding } from '../../src/db/queries.js';
import { generateEmbedding, buildEmbeddingText } from '../../src/embeddings/ollama.js';
import { cExtractor } from '../../src/parser/extractors/c.js';

const TEST_PROJECT = 'test-c-lang';

describe('C Language (Integration)', () => {
  beforeAll(async () => {
    await setupTestDB();
    await cleanupProject(TEST_PROJECT);
    await setupProjectGraph(TEST_PROJECT);

    const source = readFileSync(resolve(fixtureDir, 'sample.c'), 'utf-8');
    const { nodes, relationships } = cExtractor.extract('sample.c', source);
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

  it('structs and typedefs appear in graph', async () => {
    // Point is a typedef struct, so kind is 'type'
    const point = await findNodeByName('Point', TEST_PROJECT);
    expect(point).not.toBeNull();
    expect(point?.kind).toBe('type');

    const color = await findNodeByName('Color', TEST_PROJECT);
    expect(color).not.toBeNull();
    expect(color?.kind).toBe('struct');
  });

  it('enums appear in graph', async () => {
    const direction = await findNodeByName('Direction', TEST_PROJECT);
    expect(direction).not.toBeNull();
    expect(direction?.kind).toBe('enum');
  });

  it('functions appear in graph', async () => {
    const printPoint = await findNodeByName('print_point', TEST_PROJECT);
    expect(printPoint).not.toBeNull();
    expect(printPoint?.kind).toBe('function');

    const add = await findNodeByName('add', TEST_PROJECT);
    expect(add).not.toBeNull();
    expect(add?.kind).toBe('function');

    const main = await findNodeByName('main', TEST_PROJECT);
    expect(main).not.toBeNull();
    expect(main?.kind).toBe('function');
  });

  it('search returns C results', async () => {
    const queryEmbedding = await generateEmbedding('print point coordinates');
    const results = await searchByEmbedding(queryEmbedding, 10, TEST_PROJECT);
    expect(results.length).toBeGreaterThan(0);

    const cResults = results.filter(r => r.filePath.endsWith('.c'));
    expect(cResults.length).toBeGreaterThan(0);
  });
});
