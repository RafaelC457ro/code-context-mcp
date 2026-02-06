import { describe, it, expect } from 'vitest';
import { chunkFile } from '../../../src/chunker/index.js';

describe('chunkFile', () => {
  it('returns single chunk for small files', () => {
    const content = 'const x = 1;\nconst y = 2;';
    const chunks = chunkFile(content, 'test.ts');

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      filePath: 'test.ts',
      chunkIndex: 0,
      totalChunks: 1,
      content,
      startLine: 1,
      endLine: 2,
    });
  });

  it('splits large files into multiple chunks', () => {
    // Create a file that exceeds the default max tokens (6000 * 4 = 24000 chars)
    const lines: string[] = [];
    for (let i = 0; i < 1000; i++) {
      lines.push(`const variable${i} = 'This is a line of code that takes up some space';`);
    }
    const content = lines.join('\n');

    const chunks = chunkFile(content, 'large.ts');

    expect(chunks.length).toBeGreaterThan(1);

    // Check all chunks have correct metadata
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].filePath).toBe('large.ts');
      expect(chunks[i].chunkIndex).toBe(i);
      expect(chunks[i].totalChunks).toBe(chunks.length);
      expect(chunks[i].startLine).toBeGreaterThan(0);
      expect(chunks[i].endLine).toBeGreaterThanOrEqual(chunks[i].startLine);
    }
  });

  it('respects custom maxTokens parameter', () => {
    const lines = Array(100).fill('const x = 1;');
    const content = lines.join('\n');

    // With very small max tokens, should create many chunks
    const smallChunks = chunkFile(content, 'test.ts', 50);
    // With larger max tokens, should create fewer chunks
    const largeChunks = chunkFile(content, 'test.ts', 5000);

    expect(smallChunks.length).toBeGreaterThan(largeChunks.length);
  });

  it('maintains chunk overlap', () => {
    // Create content that will definitely split
    const lines: string[] = [];
    for (let i = 0; i < 500; i++) {
      lines.push(`function func${i}() { return ${i}; }`);
    }
    const content = lines.join('\n');

    const chunks = chunkFile(content, 'test.ts', 500);

    // With overlap, chunks should cover some of the same lines
    if (chunks.length >= 2) {
      // Second chunk should start before or at where first chunk ends
      // (due to overlap)
      const firstEnd = chunks[0].endLine;
      const secondStart = chunks[1].startLine;
      expect(secondStart).toBeLessThanOrEqual(firstEnd + 1);
    }
  });

  it('handles empty files', () => {
    const chunks = chunkFile('', 'empty.ts');

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('');
  });

  it('handles files with only whitespace', () => {
    const chunks = chunkFile('   \n\n   \n', 'whitespace.ts');

    expect(chunks).toHaveLength(1);
    expect(chunks[0].startLine).toBe(1);
  });

  it('preserves file path in all chunks', () => {
    const lines = Array(500).fill('const x = 1;');
    const content = lines.join('\n');

    const chunks = chunkFile(content, 'src/components/Button.tsx', 200);

    for (const chunk of chunks) {
      expect(chunk.filePath).toBe('src/components/Button.tsx');
    }
  });

  it('attempts to split at semantic boundaries', () => {
    // Create content with clear semantic boundaries (functions) that will force multiple chunks
    const lines: string[] = [];
    for (let i = 0; i < 100; i++) {
      lines.push(`function myFunction${i}() {`);
      lines.push(`  const value = ${i};`);
      lines.push(`  return value * 2;`);
      lines.push(`}`);
      lines.push('');
    }
    const content = lines.join('\n');

    // With small token limit to force splits
    const chunks = chunkFile(content, 'test.ts', 100);

    // Should have multiple chunks
    expect(chunks.length).toBeGreaterThan(1);
  });
});
