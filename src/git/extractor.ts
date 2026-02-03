import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import type { GitCommit } from '../types.js';

const COMMIT_DELIMITER = '---COMMIT_DELIMITER---';
const FIELD_DELIMITER = '---FIELD_DELIMITER---';

export function extractGitCommits(repoDir: string, project: string): GitCommit[] {
  const gitDir = join(repoDir, '.git');
  if (!existsSync(gitDir)) {
    throw new Error(`Not a git repository: ${repoDir}`);
  }

  // Get commit list with structured format
  const logFormat = [
    '%H',   // commit hash
    '%an',  // author name
    '%aI',  // author date ISO 8601
    '%s',   // subject
    '%b',   // body
  ].join(FIELD_DELIMITER);

  let logOutput: string;
  try {
    logOutput = execFileSync('git', [
      'log',
      `--format=${logFormat}${COMMIT_DELIMITER}`,
      '--no-color',
    ], { cwd: repoDir, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
  } catch {
    return [];
  }

  if (!logOutput.trim()) {
    return [];
  }

  const commitBlocks = logOutput.split(COMMIT_DELIMITER).filter(b => b.trim());
  const commits: GitCommit[] = [];

  for (const block of commitBlocks) {
    const fields = block.trim().split(FIELD_DELIMITER);
    if (fields.length < 4) continue;

    const [hash, author, date, subject, ...bodyParts] = fields;
    const body = bodyParts.join('').trim();
    const message = body ? `${subject.trim()}\n\n${body}` : subject.trim();

    // Get changed files
    let filesChanged: string[] = [];
    try {
      const nameOnly = execFileSync('git', [
        'show', '--name-only', '--format=', hash.trim(),
      ], { cwd: repoDir, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      filesChanged = nameOnly.trim().split('\n').filter(f => f.trim());
    } catch {
      // skip if we can't get files
    }

    // Get diff
    let diff = '';
    try {
      const diffOutput = execFileSync('git', [
        'show', '--format=', '--no-color', hash.trim(),
      ], { cwd: repoDir, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      diff = diffOutput;
    } catch {
      // skip if we can't get diff
    }

    // Filter out binary diff markers
    diff = diff
      .split('\n')
      .filter(line => !line.startsWith('Binary files'))
      .join('\n');

    commits.push({
      commitHash: hash.trim(),
      project,
      author: author.trim(),
      date: date.trim(),
      message,
      filesChanged: JSON.stringify(filesChanged),
      diffSummary: diff,
    });
  }

  return commits;
}

const DEFAULT_MAX_LENGTH = 6000;

export function buildCommitEmbeddingText(commit: GitCommit, maxLength: number = DEFAULT_MAX_LENGTH): string {
  let filesDisplay: string;
  try {
    const files = JSON.parse(commit.filesChanged) as string[];
    filesDisplay = files.join('\n');
  } catch {
    filesDisplay = commit.filesChanged;
  }

  const header = `${commit.message}\n\nFiles changed:\n${filesDisplay}`;
  const diffPrefix = '\n\nDiff:\n';

  if (header.length >= maxLength) {
    return header.substring(0, maxLength) + '...';
  }

  const remaining = maxLength - header.length - diffPrefix.length;
  if (remaining <= 0) {
    return header;
  }

  const truncatedDiff = commit.diffSummary.length > remaining
    ? commit.diffSummary.substring(0, remaining) + '...'
    : commit.diffSummary;

  return `${header}${diffPrefix}${truncatedDiff}`;
}
