import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { setupTestDB, setupProjectGraph, cleanupProject, closePool, fixtureDir } from './setup.js';
import { populateGraph, findNodeByName } from '../../src/graph/operations.js';
import { updateEmbedding, searchByEmbedding } from '../../src/db/queries.js';
import { generateEmbedding, buildEmbeddingText } from '../../src/embeddings/ollama.js';
import { solidityExtractor } from '../../src/parser/extractors/solidity.js';

const TEST_PROJECT = 'test-solidity';

describe('Solidity (Integration)', () => {
  beforeAll(async () => {
    await setupTestDB();
    await cleanupProject(TEST_PROJECT);
    await setupProjectGraph(TEST_PROJECT);

    const source = readFileSync(resolve(fixtureDir, 'sample.sol'), 'utf-8');
    const { nodes, relationships } = solidityExtractor.extract('sample.sol', source);
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

  it('contracts appear in graph', async () => {
    const token = await findNodeByName('Token', TEST_PROJECT);
    expect(token).not.toBeNull();
    expect(token?.kind).toBe('contract');
  });

  it('events appear in graph', async () => {
    const transfer = await findNodeByName('Token.Transfer', TEST_PROJECT);
    expect(transfer).not.toBeNull();
    expect(transfer?.kind).toBe('event');
  });

  it('modifiers appear in graph', async () => {
    const onlyOwner = await findNodeByName('Token.onlyOwner', TEST_PROJECT);
    expect(onlyOwner).not.toBeNull();
    expect(onlyOwner?.kind).toBe('modifier');
  });

  it('interfaces appear in graph', async () => {
    const itoken = await findNodeByName('IToken', TEST_PROJECT);
    expect(itoken).not.toBeNull();
    expect(itoken?.kind).toBe('interface');
  });

  it('search returns Solidity results', async () => {
    const queryEmbedding = await generateEmbedding('transfer tokens');
    const results = await searchByEmbedding(queryEmbedding, 10, TEST_PROJECT);
    expect(results.length).toBeGreaterThan(0);

    const solResults = results.filter(r => r.filePath.endsWith('.sol'));
    expect(solResults.length).toBeGreaterThan(0);
  });
});
