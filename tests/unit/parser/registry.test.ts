import { describe, it, expect } from 'vitest';
import { getExtractorForFile, getSupportedExtensions, getRegisteredLanguages, typescriptExtractor, rustExtractor, solidityExtractor, cExtractor } from '../../../src/parser/extractors/index.js';

describe('Extractor Registry', () => {
  it('returns TypeScript extractor for .ts files', () => {
    expect(getExtractorForFile('foo.ts')).toBe(typescriptExtractor);
  });

  it('returns TypeScript extractor for .tsx files', () => {
    expect(getExtractorForFile('component.tsx')).toBe(typescriptExtractor);
  });

  it('returns TypeScript extractor for .js files', () => {
    expect(getExtractorForFile('app.js')).toBe(typescriptExtractor);
  });

  it('returns TypeScript extractor for .jsx files', () => {
    expect(getExtractorForFile('component.jsx')).toBe(typescriptExtractor);
  });

  it('returns Rust extractor for .rs files', () => {
    expect(getExtractorForFile('main.rs')).toBe(rustExtractor);
  });

  it('returns Solidity extractor for .sol files', () => {
    expect(getExtractorForFile('contract.sol')).toBe(solidityExtractor);
  });

  it('returns C extractor for .c files', () => {
    expect(getExtractorForFile('main.c')).toBe(cExtractor);
  });

  it('returns C extractor for .h files', () => {
    expect(getExtractorForFile('header.h')).toBe(cExtractor);
  });

  it('returns undefined for unsupported extensions', () => {
    expect(getExtractorForFile('file.py')).toBeUndefined();
    expect(getExtractorForFile('file.go')).toBeUndefined();
    expect(getExtractorForFile('file.md')).toBeUndefined();
  });

  it('handles paths with directories', () => {
    expect(getExtractorForFile('src/parser/main.ts')).toBe(typescriptExtractor);
    expect(getExtractorForFile('/absolute/path/lib.rs')).toBe(rustExtractor);
  });

  it('getSupportedExtensions returns all supported extensions', () => {
    const extensions = getSupportedExtensions();
    expect(extensions).toContain('.ts');
    expect(extensions).toContain('.tsx');
    expect(extensions).toContain('.js');
    expect(extensions).toContain('.jsx');
    expect(extensions).toContain('.rs');
    expect(extensions).toContain('.sol');
    expect(extensions).toContain('.c');
    expect(extensions).toContain('.h');
  });

  it('getRegisteredLanguages returns all registered languages', () => {
    const languages = getRegisteredLanguages();
    expect(languages).toContain('typescript');
    expect(languages).toContain('rust');
    expect(languages).toContain('solidity');
    expect(languages).toContain('c');
    expect(languages).toHaveLength(4);
  });
});
