import type { CodeNode, Relationship } from '../../types.js';

export interface ExtractionResult {
  nodes: CodeNode[];
  relationships: Relationship[];
}

export interface LanguageExtractor {
  language: string;
  extensions: string[];
  extract(filePath: string, source: string): ExtractionResult;
}
