import type { TextChunk } from '../types.js';

// Estimate tokens: ~4 chars per token
const CHARS_PER_TOKEN = 4;
// nomic-embed-text with Ollama has ~1560 token effective limit (~6250 chars)
// Use 1200 tokens (4800 chars) to leave buffer for chunk metadata
const DEFAULT_MAX_TOKENS = 1200;
const OVERLAP_LINES = 10;

// Patterns that indicate semantic boundaries (function/class starts)
const SEMANTIC_BOUNDARY_PATTERNS = [
  /^(export\s+)?(async\s+)?function\s+\w+/,           // function declarations
  /^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/,  // arrow functions
  /^(export\s+)?class\s+\w+/,                          // class declarations
  /^(export\s+)?interface\s+\w+/,                      // interface declarations
  /^(export\s+)?type\s+\w+/,                           // type declarations
  /^(export\s+)?enum\s+\w+/,                           // enum declarations
  /^(pub\s+)?(async\s+)?fn\s+\w+/,                     // Rust functions
  /^(pub\s+)?struct\s+\w+/,                            // Rust structs
  /^(pub\s+)?impl\s+/,                                 // Rust impl blocks
  /^(pub\s+)?trait\s+\w+/,                             // Rust traits
  /^(pub\s+)?enum\s+\w+/,                              // Rust enums
  /^(pub\s+)?mod\s+\w+/,                               // Rust modules
  /^contract\s+\w+/,                                   // Solidity contracts
  /^(public|private|internal|external)?\s*(function|modifier|event)\s+\w+/, // Solidity
  /^(static\s+)?(inline\s+)?[\w\*]+\s+\w+\s*\(/,       // C functions
  /^(typedef\s+)?struct\s+\w*/,                        // C structs
];

function isSemanticBoundary(line: string): boolean {
  const trimmed = line.trim();
  return SEMANTIC_BOUNDARY_PATTERNS.some(pattern => pattern.test(trimmed));
}

function isBlankLine(line: string): boolean {
  return line.trim() === '';
}

export function chunkFile(content: string, filePath: string, maxTokens = DEFAULT_MAX_TOKENS): TextChunk[] {
  const lines = content.split('\n');
  const maxChars = maxTokens * CHARS_PER_TOKEN;

  // If file is small enough, return single chunk
  if (content.length <= maxChars) {
    return [{
      filePath,
      chunkIndex: 0,
      totalChunks: 1,
      content,
      startLine: 1,
      endLine: lines.length,
    }];
  }

  const chunks: TextChunk[] = [];
  let currentChunkLines: string[] = [];
  let currentChunkStartLine = 1;
  let currentCharCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLength = line.length + 1; // +1 for newline

    // Check if adding this line would exceed the limit
    if (currentCharCount + lineLength > maxChars && currentChunkLines.length > 0) {
      // Try to find a good split point (semantic boundary or blank line)
      let splitIndex = currentChunkLines.length;

      // Look backwards for a semantic boundary or blank line
      for (let j = currentChunkLines.length - 1; j >= Math.max(0, currentChunkLines.length - 20); j--) {
        if (isSemanticBoundary(currentChunkLines[j]) || isBlankLine(currentChunkLines[j])) {
          splitIndex = j;
          break;
        }
      }

      // If we found a good split point that's not at the very beginning, use it
      if (splitIndex > 0 && splitIndex < currentChunkLines.length) {
        const chunkLines = currentChunkLines.slice(0, splitIndex);
        chunks.push({
          filePath,
          chunkIndex: chunks.length,
          totalChunks: 0, // Will be updated at the end
          content: chunkLines.join('\n'),
          startLine: currentChunkStartLine,
          endLine: currentChunkStartLine + chunkLines.length - 1,
        });

        // Keep overlap lines for context
        const overlapStart = Math.max(0, splitIndex - OVERLAP_LINES);
        currentChunkLines = currentChunkLines.slice(overlapStart);
        currentChunkStartLine = currentChunkStartLine + overlapStart;
        currentCharCount = currentChunkLines.join('\n').length;
      } else {
        // No good split point found, just split at the limit
        chunks.push({
          filePath,
          chunkIndex: chunks.length,
          totalChunks: 0,
          content: currentChunkLines.join('\n'),
          startLine: currentChunkStartLine,
          endLine: currentChunkStartLine + currentChunkLines.length - 1,
        });

        // Keep overlap lines for context
        const overlapStart = Math.max(0, currentChunkLines.length - OVERLAP_LINES);
        currentChunkLines = currentChunkLines.slice(overlapStart);
        currentChunkStartLine = currentChunkStartLine + overlapStart;
        currentCharCount = currentChunkLines.join('\n').length;
      }
    }

    currentChunkLines.push(line);
    currentCharCount += lineLength;
  }

  // Don't forget the last chunk
  if (currentChunkLines.length > 0) {
    chunks.push({
      filePath,
      chunkIndex: chunks.length,
      totalChunks: 0,
      content: currentChunkLines.join('\n'),
      startLine: currentChunkStartLine,
      endLine: currentChunkStartLine + currentChunkLines.length - 1,
    });
  }

  // Update totalChunks for all chunks
  const totalChunks = chunks.length;
  for (const chunk of chunks) {
    chunk.totalChunks = totalChunks;
  }

  return chunks;
}
