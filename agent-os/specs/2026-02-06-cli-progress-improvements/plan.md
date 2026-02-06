# CLI Progress Improvements

## Summary

Improve CLI progress reporting across all commands with:
1. Enhanced progress display (progress bar + current file + stage info)
2. Incremental indexing (skip unchanged files based on hash)
3. Stage-based progress with timing/ETA

## Files to Modify

| File | Changes |
|------|---------|
| `src/cli/progress.ts` | Add stages, current item, timing/ETA |
| `src/cli/index.ts` | Add incremental support and stages to all commands |
| `src/db/schema.ts` | Add `file_hashes` table |
| `src/db/queries.ts` | Add file hash query functions |
| `src/types.ts` | Extend `ProgressStats` interface |

## Task Breakdown

### Task 1: Save Spec Documentation
Create `agent-os/specs/2026-02-06-cli-progress-improvements/` with plan.md, shape.md, standards.md, references.md

### Task 2: Extend ProgressStats Type
Update `src/types.ts` to add stage, currentItem, timing fields

### Task 3: Enhance ProgressBar Class
Update `src/cli/progress.ts`:
- Add `setStage(stage: string)` method
- Add `setCurrentItem(item: string)` method
- Add timing/ETA calculation and display
- Enhanced render format: `[Stage] [Bar] count | current item | elapsed | ETA`

### Task 4: Add File Hash Schema
Update `src/db/schema.ts`:
- Add `file_hashes` table (file_path, project, hash, last_indexed)
- Add `setupFileHashSchema()` function

### Task 5: Add File Hash Queries
Update `src/db/queries.ts`:
- `getIndexedFileHashes(project)` - Get hash map for comparison
- `upsertFileHash(filePath, hash, project)` - Store hash after indexing
- `deleteProjectFileHashes(project)` - Cleanup on delete

### Task 6: Update Index Command
Update `index` command in `src/cli/index.ts`:
- Stage 1: Collecting files (show spinner/message)
- Stage 2: Scanning - compare hashes, identify changed files
- Stage 3: Generating embeddings - process only changed files
- Update hash after each successful file

### Task 7: Update Graph Command
Update `graph` command in `src/cli/index.ts`:
- Use existing `getFileHash()` from graph operations
- Skip unchanged files
- Add stage transitions

### Task 8: Update Delete Command
Update `delete` command to also delete file hashes

### Task 9: Run Tests and Verify
- Run existing tests to ensure no regressions
- Manually test incremental behavior

## Visual Design

**TTY Mode:**
```
[Stage 1/3] Collecting files...
Found 150 source files

[Stage 2/3] Scanning for changes
[████████████████████░░░░] 120/150 files | 30 unchanged

[Stage 3/3] Generating embeddings
[██████░░░░░░░░░░░░░░░░░░] 28/120 files | 45 nodes | 89 embeddings
Currently: src/db/queries.ts
Elapsed: 1m 23s | Remaining: ~4m 12s
```

**Non-TTY Mode:**
```
[Stage 1/3] Collecting files...
Found 150 source files
[Stage 2/3] Scanning for changes
  Changed: 120 files | Unchanged: 30 files (skipped)
[Stage 3/3] Generating embeddings
  Progress: 50% (60/120 files)
  Progress: 100% (120/120 files)
```

## Reusable Patterns

- `index-git` command already implements incremental support via `getIndexedCommitHashes()` - follow this pattern
- `graph` command already stores file hashes via `upsertFileVertex()` - use `getFileHash()` for comparison
- `ProgressBar.incrementSkipped()` already exists for tracking unchanged items

## Verification

1. Run `npm test` to verify no regressions
2. Test incremental indexing:
   - Run `index <dir>` twice - second run should show files as "unchanged"
   - Modify one file - next run should only process that file
3. Test progress display in TTY and non-TTY modes
4. Test `delete` command cleans up file hashes
