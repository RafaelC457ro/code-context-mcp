import { typescriptExtractor } from './typescript.js';
import { rustExtractor } from './rust.js';
import { solidityExtractor } from './solidity.js';
import { cExtractor } from './c.js';
import type { LanguageExtractor } from './types.js';
import { extname } from 'path';

const extractors: LanguageExtractor[] = [
  typescriptExtractor,
  rustExtractor,
  solidityExtractor,
  cExtractor,
];

const extensionMap = new Map<string, LanguageExtractor>();
for (const extractor of extractors) {
  for (const ext of extractor.extensions) {
    extensionMap.set(ext, extractor);
  }
}

export function getExtractorForFile(filePath: string): LanguageExtractor | undefined {
  const ext = extname(filePath);
  return extensionMap.get(ext);
}

export function getSupportedExtensions(): string[] {
  return Array.from(extensionMap.keys());
}

export function getRegisteredLanguages(): string[] {
  return extractors.map(e => e.language);
}

export { typescriptExtractor } from './typescript.js';
export { rustExtractor } from './rust.js';
export { solidityExtractor } from './solidity.js';
export { cExtractor } from './c.js';
export type { LanguageExtractor, ExtractionResult } from './types.js';
