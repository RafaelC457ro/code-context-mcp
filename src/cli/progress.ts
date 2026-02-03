import type { ProgressStats } from '../types.js';

const BAR_WIDTH = 20;
const FILLED = '\u2588';
const EMPTY = '\u2591';

export class ProgressBar {
  private stats: ProgressStats;
  private isTTY: boolean;
  private label: string;

  constructor(totalFiles: number, label: string = 'files') {
    this.stats = {
      totalFiles,
      filesProcessed: 0,
      filesSkipped: 0,
      nodesExtracted: 0,
      embeddingsGenerated: 0,
    };
    this.isTTY = process.stdout.isTTY ?? false;
    this.label = label;
  }

  incrementFiles(): void {
    this.stats.filesProcessed++;
    this.render();
  }

  incrementSkipped(): void {
    this.stats.filesSkipped++;
    this.render();
  }

  addNodes(n: number): void {
    this.stats.nodesExtracted += n;
    this.render();
  }

  addEmbeddings(n: number): void {
    this.stats.embeddingsGenerated += n;
    this.render();
  }

  private render(): void {
    const done = this.stats.filesProcessed + this.stats.filesSkipped;
    const total = this.stats.totalFiles;
    const ratio = total > 0 ? done / total : 0;
    const filled = Math.round(ratio * BAR_WIDTH);
    const empty = BAR_WIDTH - filled;

    const bar = FILLED.repeat(filled) + EMPTY.repeat(empty);
    const parts = [`[${bar}] ${done}/${total} ${this.label}`];
    if (this.stats.nodesExtracted > 0) {
      parts.push(`${this.stats.nodesExtracted} nodes`);
    }
    parts.push(`${this.stats.embeddingsGenerated} embeddings`);
    const line = parts.join(' | ');

    if (this.isTTY) {
      process.stdout.write(`\r\x1b[K${line}`);
    }
  }

  finish(): void {
    if (this.isTTY) {
      process.stdout.write('\r\x1b[K');
    }

    const capitalLabel = this.label.charAt(0).toUpperCase() + this.label.slice(1);
    console.log('\n--- Indexing Summary ---');
    console.log(`${capitalLabel} processed: ${this.stats.filesProcessed}`);
    console.log(`${capitalLabel} skipped (unchanged): ${this.stats.filesSkipped}`);
    if (this.stats.nodesExtracted > 0) {
      console.log(`Nodes extracted: ${this.stats.nodesExtracted}`);
    }
    console.log(`Embeddings generated: ${this.stats.embeddingsGenerated}`);
  }

  getStats(): ProgressStats {
    return { ...this.stats };
  }
}
