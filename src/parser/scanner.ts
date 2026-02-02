import { readFileSync, readdirSync } from 'fs';
import { resolve, relative, join, extname } from 'path';
import { createHash } from 'crypto';
import { getExtractorForFile, getSupportedExtensions } from './extractors/index.js';
import type { ExtractionResult } from './extractors/types.js';

export interface ScannedFile {
  absolutePath: string;
  relativePath: string;
  hash: string;
  extraction: ExtractionResult;
}

const EXCLUDED_DIRS = new Set(['node_modules', '.git', 'dist', 'target', 'build', 'out']);

export function scanDirectory(directory: string, fileList: string[]): ScannedFile[] {
  const results: ScannedFile[] = [];

  for (const filePath of fileList) {
    const absolutePath = resolve(directory, filePath);
    const relativePath = relative(directory, absolutePath);

    const extractor = getExtractorForFile(filePath);
    if (!extractor) {
      console.error(`No extractor found for ${relativePath}`);
      continue;
    }

    try {
      const source = readFileSync(absolutePath, 'utf-8');
      const hash = createHash('sha256').update(source).digest('hex');
      const extraction = extractor.extract(relativePath, source);

      results.push({
        absolutePath,
        relativePath,
        hash,
        extraction,
      });
    } catch (err) {
      console.error(`Failed to parse ${relativePath}: ${err}`);
    }
  }

  return results;
}

export function collectFiles(directory: string): string[] {
  const supportedExtensions = new Set(getSupportedExtensions());
  const files: string[] = [];

  function walk(dir: string): void {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        walk(fullPath);
      } else {
        const ext = extname(entry.name);
        if (!supportedExtensions.has(ext)) continue;
        // Skip TypeScript declaration files
        if (entry.name.endsWith('.d.ts')) continue;
        files.push(relative(directory, fullPath));
      }
    }
  }

  walk(directory);
  return files;
}
