import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateEmbedding, buildEmbeddingText } from '../../../src/embeddings/ollama.js';

describe('Ollama Embeddings', () => {
  const mockEmbedding = Array.from({ length: 768 }, (_, i) => i * 0.001);

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generateEmbedding calls Ollama API correctly', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ embedding: mockEmbedding }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await generateEmbedding('test text');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/embeddings');
    expect(options?.method).toBe('POST');
    const body = JSON.parse(options?.body as string);
    expect(body.prompt).toBe('test text');
    expect(body.model).toBe('nomic-embed-text');

    expect(result).toEqual(mockEmbedding);
  });

  it('generateEmbedding throws on non-ok response', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' })
    );

    await expect(generateEmbedding('test')).rejects.toThrow('Ollama embedding request failed');
  });

  describe('buildEmbeddingText', () => {
    it('combines name, signature, and body', () => {
      const result = buildEmbeddingText('myFunc', 'function myFunc(x: number)', 'return x + 1;');
      expect(result).toContain('myFunc');
      expect(result).toContain('function myFunc(x: number)');
      expect(result).toContain('return x + 1;');
    });

    it('truncates long bodies', () => {
      const longBody = 'x'.repeat(2000);
      const result = buildEmbeddingText('fn', 'fn()', longBody);
      expect(result.length).toBeLessThan(2000 + 50); // name + signature + truncated body + newlines
      expect(result).toContain('...');
    });

    it('does not truncate short bodies', () => {
      const body = 'return 42;';
      const result = buildEmbeddingText('fn', 'fn()', body);
      expect(result).toContain(body);
      expect(result).not.toContain('...');
    });
  });
});
