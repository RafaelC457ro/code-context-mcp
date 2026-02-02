import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { setupTestDB, cleanupProject, closePool, fixtureDir } from './setup.js';
import {
  populateGraph,
  findNodeByName,
  getCallers,
  getCallees,
  getCallStack,
  getUsedTypes,
  enrichSearchResults,
  getReverseImpact,
  upsertFileVertex,
  getFileHash,
  clearFileVertices,
  deleteProjectGraph,
} from '../../src/graph/operations.js';
import { updateEmbedding, searchByEmbedding } from '../../src/db/queries.js';
import { generateEmbedding, buildEmbeddingText } from '../../src/embeddings/ollama.js';
import { cExtractor } from '../../src/parser/extractors/c.js';
import { typescriptExtractor } from '../../src/parser/extractors/typescript.js';

const TEST_PROJECT = 'test-graph-ops';

describe('Graph Operations (Integration)', () => {
  beforeAll(async () => {
    await setupTestDB();
    await cleanupProject(TEST_PROJECT);

    // Index C fixture — has clear CALLS: main -> print_point, main -> add
    const cSource = readFileSync(resolve(fixtureDir, 'sample.c'), 'utf-8');
    const cResult = cExtractor.extract('sample.c', cSource);
    await populateGraph(cResult.nodes, cResult.relationships, TEST_PROJECT);

    for (const node of cResult.nodes) {
      const text = buildEmbeddingText(node.name, node.signature, node.body);
      const embedding = await generateEmbedding(text);
      await updateEmbedding(node.name, node.filePath, embedding, TEST_PROJECT);
    }

    // Index TS fixture — has USES relationships (loadConfig -> Config)
    const tsSource = readFileSync(resolve(fixtureDir, 'sample.ts'), 'utf-8');
    const tsResult = typescriptExtractor.extract('sample.ts', tsSource);
    await populateGraph(tsResult.nodes, tsResult.relationships, TEST_PROJECT);

    for (const node of tsResult.nodes) {
      const text = buildEmbeddingText(node.name, node.signature, node.body);
      const embedding = await generateEmbedding(text);
      await updateEmbedding(node.name, node.filePath, embedding, TEST_PROJECT);
    }
  }, 120_000);

  afterAll(async () => {
    await cleanupProject(TEST_PROJECT);
    await closePool();
  });

  it('getCallers returns functions that call a target', async () => {
    const callers = await getCallers('print_point', TEST_PROJECT);
    expect(callers.length).toBeGreaterThan(0);
    expect(callers.find(c => c.name === 'main')).toBeTruthy();
  });

  it('getCallees returns functions called by a source', async () => {
    const callees = await getCallees('main', TEST_PROJECT);
    expect(callees.length).toBeGreaterThan(0);
    const calleeNames = callees.map(c => c.name);
    expect(calleeNames).toContain('print_point');
    expect(calleeNames).toContain('add');
  });

  it('getCallStack returns call tree with depth', async () => {
    const stack = await getCallStack('main', 2, TEST_PROJECT);
    expect(stack.length).toBeGreaterThan(0);
    const topNames = stack.map(s => s.name);
    expect(topNames).toContain('print_point');
    expect(topNames).toContain('add');
    for (const entry of stack) {
      expect(entry.depth).toBe(1);
    }
  });

  it('getUsedTypes returns types referenced by a function', async () => {
    const types = await getUsedTypes('loadConfig', TEST_PROJECT);
    // loadConfig returns Config, so USES -> Config
    expect(types.length).toBeGreaterThan(0);
    expect(types.find(t => t.name === 'Config')).toBeTruthy();
  });

  it('enrichSearchResults augments embedding hits with graph data', async () => {
    const queryEmbedding = await generateEmbedding('add numbers');
    const hits = await searchByEmbedding(queryEmbedding, 5, TEST_PROJECT);
    expect(hits.length).toBeGreaterThan(0);

    const enriched = await enrichSearchResults(hits, TEST_PROJECT);
    expect(enriched.length).toBe(hits.length);
    for (const item of enriched) {
      expect(item.hit).toBeDefined();
      // node may be null if the graph vertex was cleaned up, but hit should always be present
    }
    // At least one result should have a node
    const withNode = enriched.filter(e => e.node !== null);
    expect(withNode.length).toBeGreaterThan(0);
  });

  it('getReverseImpact finds external dependents of a file', async () => {
    // getReverseImpact looks for nodes from other files that reference nodes in this file
    // Since sample.c and sample.ts are independent, expect empty or minimal results
    const impact = await getReverseImpact('sample.c', TEST_PROJECT);
    expect(Array.isArray(impact)).toBe(true);
  });

  it('upsertFileVertex and getFileHash track file hashes', async () => {
    const testPath = 'test-file.ts';
    const testHash = 'abc123def456';

    await upsertFileVertex(testPath, testHash, TEST_PROJECT);
    const retrieved = await getFileHash(testPath, TEST_PROJECT);
    expect(retrieved).toBe(testHash);

    // Update hash
    const newHash = '789xyz000';
    await upsertFileVertex(testPath, newHash, TEST_PROJECT);
    const updated = await getFileHash(testPath, TEST_PROJECT);
    expect(updated).toBe(newHash);
  });

  it('clearFileVertices removes all vertices for a file', async () => {
    // Verify a node exists from sample.c
    const before = await findNodeByName('add', TEST_PROJECT);
    expect(before).not.toBeNull();

    // Clear sample.c vertices
    await clearFileVertices('sample.c', TEST_PROJECT);

    // Node should be gone
    const after = await findNodeByName('add', TEST_PROJECT);
    expect(after).toBeNull();

    // Re-index so deleteProjectGraph test has data
    const cSource = readFileSync(resolve(fixtureDir, 'sample.c'), 'utf-8');
    const cResult = cExtractor.extract('sample.c', cSource);
    await populateGraph(cResult.nodes, cResult.relationships, TEST_PROJECT);
  });

  it('deleteProjectGraph removes all graph data for a project', async () => {
    const deletedCount = await deleteProjectGraph(TEST_PROJECT);
    expect(deletedCount).toBeGreaterThan(0);

    // Verify nodes are gone
    const node = await findNodeByName('main', TEST_PROJECT);
    expect(node).toBeNull();
  });
});
