import { describe, it, expect } from 'vitest';
import { ProgressBar } from '../../../src/cli/progress.js';

describe('ProgressBar', () => {
  it('initializes with correct defaults', () => {
    const bar = new ProgressBar(10);
    const stats = bar.getStats();

    expect(stats.totalFiles).toBe(10);
    expect(stats.filesProcessed).toBe(0);
    expect(stats.filesSkipped).toBe(0);
    expect(stats.nodesExtracted).toBe(0);
    expect(stats.embeddingsGenerated).toBe(0);
  });

  it('tracks file processing', () => {
    const bar = new ProgressBar(5);

    bar.incrementFiles();
    bar.incrementFiles();
    const stats = bar.getStats();

    expect(stats.filesProcessed).toBe(2);
  });

  it('tracks skipped files', () => {
    const bar = new ProgressBar(5);

    bar.incrementSkipped();
    bar.incrementSkipped();
    bar.incrementSkipped();
    const stats = bar.getStats();

    expect(stats.filesSkipped).toBe(3);
  });

  it('tracks nodes extracted', () => {
    const bar = new ProgressBar(5);

    bar.addNodes(10);
    bar.addNodes(5);
    const stats = bar.getStats();

    expect(stats.nodesExtracted).toBe(15);
  });

  it('tracks embeddings generated', () => {
    const bar = new ProgressBar(5);

    bar.addEmbeddings(1);
    bar.addEmbeddings(1);
    bar.addEmbeddings(1);
    const stats = bar.getStats();

    expect(stats.embeddingsGenerated).toBe(3);
  });

  it('getStats returns a copy (not a reference)', () => {
    const bar = new ProgressBar(5);
    bar.incrementFiles();

    const stats1 = bar.getStats();
    bar.incrementFiles();
    const stats2 = bar.getStats();

    expect(stats1.filesProcessed).toBe(1);
    expect(stats2.filesProcessed).toBe(2);
  });

  it('accepts a custom label', () => {
    const bar = new ProgressBar(10, 'commits');
    const stats = bar.getStats();

    expect(stats.totalFiles).toBe(10);
    expect(stats.filesProcessed).toBe(0);
  });

  it('defaults label to files', () => {
    const bar = new ProgressBar(10);
    // Just verifying it constructs without error with default label
    const stats = bar.getStats();
    expect(stats.totalFiles).toBe(10);
  });
});
