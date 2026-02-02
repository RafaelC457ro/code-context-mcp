import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { collectFiles, scanDirectory } from '../../../src/parser/scanner.js';

describe('Scanner', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'scanner-test-'));

  // Create test structure
  const setupFixtures = () => {
    writeFileSync(join(tempDir, 'main.ts'), 'function hello() {}');
    writeFileSync(join(tempDir, 'lib.tsx'), 'const App = () => <div />;');
    writeFileSync(join(tempDir, 'types.d.ts'), 'declare module "foo";');
    writeFileSync(join(tempDir, 'code.rs'), 'fn main() {}');
    writeFileSync(join(tempDir, 'contract.sol'), 'pragma solidity ^0.8.0; contract Foo {}');
    writeFileSync(join(tempDir, 'readme.md'), '# Hello');
    writeFileSync(join(tempDir, 'data.json'), '{}');

    // Create excluded directories
    mkdirSync(join(tempDir, 'node_modules'), { recursive: true });
    writeFileSync(join(tempDir, 'node_modules', 'dep.ts'), 'export const x = 1;');

    mkdirSync(join(tempDir, '.git'), { recursive: true });
    writeFileSync(join(tempDir, '.git', 'config.ts'), '');

    mkdirSync(join(tempDir, 'dist'), { recursive: true });
    writeFileSync(join(tempDir, 'dist', 'main.ts'), '');

    mkdirSync(join(tempDir, 'target'), { recursive: true });
    writeFileSync(join(tempDir, 'target', 'output.rs'), '');

    mkdirSync(join(tempDir, 'build'), { recursive: true });
    writeFileSync(join(tempDir, 'build', 'index.ts'), '');

    mkdirSync(join(tempDir, 'out'), { recursive: true });
    writeFileSync(join(tempDir, 'out', 'result.ts'), '');

    // Nested directory
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    writeFileSync(join(tempDir, 'src', 'nested.ts'), 'export const y = 2;');
  };

  setupFixtures();

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('collects .ts, .tsx, .rs, .sol files', () => {
    const files = collectFiles(tempDir);

    expect(files).toContain('main.ts');
    expect(files).toContain('lib.tsx');
    expect(files).toContain('code.rs');
    expect(files).toContain('contract.sol');
  });

  it('excludes .d.ts files', () => {
    const files = collectFiles(tempDir);
    expect(files.find(f => f.includes('.d.ts'))).toBeUndefined();
  });

  it('excludes non-supported file types', () => {
    const files = collectFiles(tempDir);
    expect(files.find(f => f.endsWith('.md'))).toBeUndefined();
    expect(files.find(f => f.endsWith('.json'))).toBeUndefined();
  });

  it('excludes node_modules, .git, dist, target, build, out', () => {
    const files = collectFiles(tempDir);
    expect(files.find(f => f.includes('node_modules'))).toBeUndefined();
    expect(files.find(f => f.includes('.git'))).toBeUndefined();
    expect(files.find(f => f.startsWith('dist'))).toBeUndefined();
    expect(files.find(f => f.startsWith('target'))).toBeUndefined();
    expect(files.find(f => f.startsWith('build'))).toBeUndefined();
    expect(files.find(f => f.startsWith('out'))).toBeUndefined();
  });

  it('finds files in subdirectories', () => {
    const files = collectFiles(tempDir);
    expect(files.find(f => f.includes('nested.ts'))).toBeTruthy();
  });

  it('scanDirectory parses files and returns results', () => {
    const files = ['main.ts'];
    const results = scanDirectory(tempDir, files);

    expect(results).toHaveLength(1);
    expect(results[0].relativePath).toBe('main.ts');
    expect(results[0].hash).toBeTruthy();
    expect(results[0].extraction.nodes.length).toBeGreaterThan(0);
  });

  it('scanDirectory uses correct extractor per file type', () => {
    const files = ['main.ts', 'code.rs', 'contract.sol'];
    const results = scanDirectory(tempDir, files);

    expect(results).toHaveLength(3);
    for (const result of results) {
      expect(result.extraction.nodes.length).toBeGreaterThan(0);
    }
  });
});
