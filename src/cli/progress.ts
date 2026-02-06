import type { ProgressStats } from '../types.js';

const BAR_WIDTH = 20;
const FILLED = '\u2588';
const EMPTY = '\u2591';

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export class ProgressBar {
  private stats: ProgressStats;
  private isTTY: boolean;
  private label: string;
  private lastNonTTYPercent: number = 0;

  constructor(totalFiles: number, label: string = 'files') {
    this.stats = {
      totalFiles,
      filesProcessed: 0,
      filesSkipped: 0,
      nodesExtracted: 0,
      embeddingsGenerated: 0,
      startTime: Date.now(),
    };
    this.isTTY = process.stdout.isTTY ?? false;
    this.label = label;
  }

  setStage(stage: string, stageNumber?: number, totalStages?: number): void {
    this.stats.stage = stage;
    this.stats.stageNumber = stageNumber;
    this.stats.totalStages = totalStages;

    if (stageNumber !== undefined && totalStages !== undefined) {
      console.log(`\n[Stage ${stageNumber}/${totalStages}] ${stage}`);
    } else {
      console.log(`\n${stage}`);
    }
  }

  setCurrentItem(item: string): void {
    this.stats.currentItem = item;
    this.render();
  }

  reset(totalFiles: number): void {
    this.stats.totalFiles = totalFiles;
    this.stats.filesProcessed = 0;
    this.stats.filesSkipped = 0;
    this.stats.nodesExtracted = 0;
    this.stats.embeddingsGenerated = 0;
    this.stats.startTime = Date.now();
    this.stats.currentItem = undefined;
    this.lastNonTTYPercent = 0;
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
    if (this.stats.embeddingsGenerated > 0) {
      parts.push(`${this.stats.embeddingsGenerated} embeddings`);
    }

    const line = parts.join(' | ');

    if (this.isTTY) {
      // Build multi-line TTY display
      let display = `\r\x1b[K${line}`;

      // Add current item on next line if set
      if (this.stats.currentItem) {
        display += `\n\x1b[KCurrently: ${this.stats.currentItem}`;
      }

      // Add timing info
      if (this.stats.startTime && done > 0) {
        const elapsed = Date.now() - this.stats.startTime;
        const elapsedStr = formatTime(elapsed);

        // Calculate ETA based on processed items only (not skipped)
        const processed = this.stats.filesProcessed;
        const remaining = total - done;
        if (processed > 0 && remaining > 0) {
          const msPerItem = elapsed / processed;
          const eta = remaining * msPerItem;
          const etaStr = formatTime(eta);
          display += `\n\x1b[KElapsed: ${elapsedStr} | Remaining: ~${etaStr}`;
        } else {
          display += `\n\x1b[KElapsed: ${elapsedStr}`;
        }
      }

      // Move cursor back up to the bar line for next update
      const extraLines = (this.stats.currentItem ? 1 : 0) + (this.stats.startTime && done > 0 ? 1 : 0);
      if (extraLines > 0) {
        display += `\x1b[${extraLines}A`;
      }

      process.stdout.write(display);
    } else {
      // Non-TTY mode: print at milestones (25%, 50%, 75%, 100%)
      const percent = Math.floor(ratio * 100);
      const milestone = Math.floor(percent / 25) * 25;

      if (milestone > this.lastNonTTYPercent || percent === 100) {
        console.log(`  Progress: ${percent}% (${done}/${total} ${this.label})`);
        this.lastNonTTYPercent = milestone;
      }
    }
  }

  finish(): void {
    if (this.isTTY) {
      // Clear the multi-line display
      const extraLines = (this.stats.currentItem ? 1 : 0) + (this.stats.startTime ? 1 : 0);
      let clear = '\r\x1b[K';
      for (let i = 0; i < extraLines; i++) {
        clear += '\n\x1b[K';
      }
      if (extraLines > 0) {
        clear += `\x1b[${extraLines}A`;
      }
      process.stdout.write(clear + '\r\x1b[K');
    }

    const capitalLabel = this.label.charAt(0).toUpperCase() + this.label.slice(1);

    // Calculate total time
    let timeStr = '';
    if (this.stats.startTime) {
      const elapsed = Date.now() - this.stats.startTime;
      timeStr = ` (${formatTime(elapsed)})`;
    }

    console.log('\n--- Indexing Summary ---');
    console.log(`${capitalLabel} processed: ${this.stats.filesProcessed}${timeStr}`);
    console.log(`${capitalLabel} skipped (unchanged): ${this.stats.filesSkipped}`);
    if (this.stats.nodesExtracted > 0) {
      console.log(`Nodes extracted: ${this.stats.nodesExtracted}`);
    }
    if (this.stats.embeddingsGenerated > 0) {
      console.log(`Embeddings generated: ${this.stats.embeddingsGenerated}`);
    }
  }

  getStats(): ProgressStats {
    return { ...this.stats };
  }
}
