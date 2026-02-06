# Shape: CLI Progress Improvements

## Overview

This feature enhances the CLI progress reporting system with:
- Stage-based progress display
- Current item display
- Timing and ETA calculations
- Incremental indexing support via file hashing

## Data Model

### File Hashes Table

```sql
CREATE TABLE IF NOT EXISTS public.file_hashes (
  id SERIAL PRIMARY KEY,
  file_path TEXT NOT NULL,
  project TEXT NOT NULL,
  hash TEXT NOT NULL,
  last_indexed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project, file_path)
);
```

### Extended ProgressStats

```typescript
export interface ProgressStats {
  totalFiles: number;
  filesProcessed: number;
  filesSkipped: number;
  nodesExtracted: number;
  embeddingsGenerated: number;
  stage?: string;
  currentItem?: string;
  startTime?: number;
}
```

## ProgressBar API

### New Methods

```typescript
class ProgressBar {
  setStage(stage: string, totalStages?: number): void
  setCurrentItem(item: string): void
  reset(totalFiles: number): void
}
```

### Display Format

TTY mode shows dynamic updates:
```
[Stage 2/3] Processing files
[████████░░░░░░░░░░░░░░░░] 50/150 files | 120 nodes | 45 embeddings
Currently: src/db/queries.ts
Elapsed: 1m 23s | Remaining: ~2m 15s
```

Non-TTY mode shows milestone updates:
```
[Stage 2/3] Processing files
  Progress: 25% (38/150 files)
  Progress: 50% (75/150 files)
```

## Query Functions

```typescript
// Get all indexed file hashes for a project
getIndexedFileHashes(project: string): Promise<Map<string, string>>

// Update or insert a file hash after indexing
upsertFileHash(filePath: string, hash: string, project: string): Promise<void>

// Delete all file hashes for a project
deleteProjectFileHashes(project: string): Promise<number>
```

## Command Stages

### Index Command
1. **Collecting** - Scan directory for source files
2. **Scanning** - Compare file hashes, identify changed files
3. **Generating** - Generate embeddings for changed files only

### Graph Command
1. **Collecting** - Scan directory for source files
2. **Scanning** - Compare file hashes using existing graph File vertices
3. **Building** - Build graph vertices and edges for changed files

### Index-Git Command (existing)
Already has incremental support via `getIndexedCommitHashes()`

## Error Handling

- File hash comparison failures should not block indexing
- Missing hash entries indicate new files that need processing
- Database errors during hash update should be logged but not fatal
