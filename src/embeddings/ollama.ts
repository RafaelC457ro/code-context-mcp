const OLLAMA_BASE_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? 'nomic-embed-text';

interface OllamaEmbeddingResponse {
  embedding: number[];
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      prompt: text,
    }),
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errorBody = await response.text();
      errorDetail = ` - ${errorBody}`;
    } catch {
      // Ignore if we can't read the error body
    }
    throw new Error(`Ollama embedding request failed: ${response.status} ${response.statusText}${errorDetail}`);
  }

  const data = (await response.json()) as OllamaEmbeddingResponse;
  return data.embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await generateEmbedding(text));
  }
  return results;
}

export function buildEmbeddingText(name: string, signature: string, body: string): string {
  // Truncate body to keep embedding input reasonable
  const maxBodyLength = 1000;
  const truncatedBody = body.length > maxBodyLength
    ? body.substring(0, maxBodyLength) + '...'
    : body;

  return `${name}\n${signature}\n${truncatedBody}`;
}

import type { TextChunk } from '../types.js';

export function buildChunkEmbeddingText(chunk: TextChunk): string {
  return `File: ${chunk.filePath}\nChunk: ${chunk.chunkIndex + 1} of ${chunk.totalChunks}\nLines: ${chunk.startLine}-${chunk.endLine}\n---\n${chunk.content}`;
}
