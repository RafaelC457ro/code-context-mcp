import type { ProgressStats } from '../types.js';
import { COLORS, CURSOR, cyan, yellow, magenta, green, red, dim } from './colors.js';

const BAR_WIDTH = 20;
const FILLED = '\u2588';
const EMPTY = '\u2591';

// Spinner frames for animated progress
const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

// Track if cursor is hidden globally to restore on exit
let cursorHidden = false;

function hideCursor(): void {
  if (process.stdout.isTTY && !cursorHidden) {
    process.stdout.write(CURSOR.hide);
    cursorHidden = true;
  }
}

function showCursor(): void {
  if (cursorHidden) {
    process.stdout.write(CURSOR.show);
    cursorHidden = false;
  }
}

// Register cleanup handlers
function setupCleanup(): void {
  const cleanup = () => {
    showCursor();
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(143);
  });
}

// Initialize cleanup handlers
setupCleanup();

export class ProgressBar {
  private stats: ProgressStats;
  private isTTY: boolean;
  private label: string;
  private lastNonTTYPercent: number = 0;
  private spinnerIndex: number = 0;
  private spinnerInterval: ReturnType<typeof setInterval> | null = null;
  private displayedLines: number = 0;

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

    if (this.isTTY) {
      hideCursor();
      this.startSpinner();
    }
  }

  private startSpinner(): void {
    if (this.spinnerInterval) return;
    this.spinnerInterval = setInterval(() => {
      this.spinnerIndex = (this.spinnerIndex + 1) % SPINNER.length;
      this.render();
    }, 80);
  }

  private stopSpinner(): void {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
    }
  }

  private clearDisplay(): void {
    if (!this.isTTY) return;

    // Move to start of current line and clear
    let clear = '\r\x1b[K';
    // Clear any extra lines we displayed
    for (let i = 0; i < this.displayedLines; i++) {
      clear += '\x1b[1B\x1b[K'; // Move down and clear
    }
    // Move back up
    for (let i = 0; i < this.displayedLines; i++) {
      clear += '\x1b[1A';
    }
    process.stdout.write(clear + '\r\x1b[K');
  }

  setStage(stage: string, stageNumber?: number, totalStages?: number): void {
    this.stats.stage = stage;
    this.stats.stageNumber = stageNumber;
    this.stats.totalStages = totalStages;

    // Clear current display before printing stage
    this.clearDisplay();
    this.displayedLines = 0;

    if (stageNumber !== undefined && totalStages !== undefined) {
      console.log(`${cyan(`[Stage ${stageNumber}/${totalStages}]`)} ${stage}`);
    } else {
      console.log(stage);
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
    this.displayedLines = 0;
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

  logError(message: string): void {
    if (this.isTTY) {
      // Clear current display, print error, then re-render
      this.clearDisplay();
      console.error(red(message));
      this.render();
    } else {
      console.error(message);
    }
  }

  private render(): void {
    const done = this.stats.filesProcessed + this.stats.filesSkipped;
    const total = this.stats.totalFiles;
    const ratio = total > 0 ? done / total : 0;
    const filled = Math.round(ratio * BAR_WIDTH);
    const empty = BAR_WIDTH - filled;

    const spinner = SPINNER[this.spinnerIndex];
    const barColored = `${COLORS.green}${FILLED.repeat(filled)}${COLORS.reset}${COLORS.dim}${EMPTY.repeat(empty)}${COLORS.reset}`;

    // Build display parts
    const parts: string[] = [`${spinner} [${barColored}] ${yellow(`${done}/${total}`)} ${this.label}`];

    if (this.stats.nodesExtracted > 0) {
      parts.push(`${magenta(String(this.stats.nodesExtracted))} chunks`);
    }
    if (this.stats.embeddingsGenerated > 0) {
      parts.push(`${cyan(String(this.stats.embeddingsGenerated))} embeddings`);
    }

    const line = parts.join(' | ');

    if (this.isTTY) {
      // Build multi-line TTY display
      let display = `\r\x1b[K${line}`;
      let extraLines = 0;

      // Add current item on next line if set
      if (this.stats.currentItem) {
        display += `\n\x1b[K${dim(`  → ${this.stats.currentItem}`)}`;
        extraLines++;
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
          display += `\n\x1b[K${dim(`  Elapsed: ${elapsedStr} | Remaining: ~${etaStr}`)}`;
        } else {
          display += `\n\x1b[K${dim(`  Elapsed: ${elapsedStr}`)}`;
        }
        extraLines++;
      }

      // Move cursor back up to the bar line for next update
      if (extraLines > 0) {
        display += `\x1b[${extraLines}A`;
      }

      this.displayedLines = extraLines;
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
    this.stopSpinner();

    if (this.isTTY) {
      // Clear the multi-line display
      this.clearDisplay();
      showCursor();
    }

    const capitalLabel = this.label.charAt(0).toUpperCase() + this.label.slice(1);

    // Calculate total time
    let timeStr = '';
    if (this.stats.startTime) {
      const elapsed = Date.now() - this.stats.startTime;
      timeStr = ` ${dim(`(${formatTime(elapsed)})`)}`;
    }

    console.log(green('--- Indexing Summary ---'));
    console.log(`${capitalLabel} processed: ${yellow(String(this.stats.filesProcessed))}${timeStr}`);
    console.log(`${capitalLabel} skipped (unchanged): ${dim(String(this.stats.filesSkipped))}`);
    if (this.stats.nodesExtracted > 0) {
      console.log(`Chunks indexed: ${magenta(String(this.stats.nodesExtracted))}`);
    }
    if (this.stats.embeddingsGenerated > 0) {
      console.log(`Embeddings generated: ${cyan(String(this.stats.embeddingsGenerated))}`);
    }
  }

  getStats(): ProgressStats {
    return { ...this.stats };
  }
}
