# Smart Truncation + Git Progress Bar — Plan

## Summary

Two improvements to `index-git`:
1. Budget-based embedding text truncation (6000 char limit matching nomic-embed-text context window)
2. Reuse existing ProgressBar with configurable label for git indexing

## Tasks

1. Update `buildCommitEmbeddingText` with budget-based truncation
2. Add configurable label to ProgressBar
3. Use ProgressBar in `index-git` command
4. Update tests

## Files Modified

- `src/git/extractor.ts` — budget-based truncation
- `src/cli/progress.ts` — configurable label
- `src/cli/index.ts` — use ProgressBar for git indexing
- `tests/unit/git/extractor.test.ts`
- `tests/unit/cli/progress.test.ts`
- `tests/unit/cli/index-git.test.ts`
