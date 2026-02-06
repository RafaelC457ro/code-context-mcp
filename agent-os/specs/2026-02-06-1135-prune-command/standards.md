# Standards: Prune Command

## CLI Patterns

- Use `--force` flag for destructive operations (consistent with delete command)
- Exit with code 1 on validation errors
- Print step-by-step progress for visibility
- Print summary at end of operation

## Database Patterns

- Use `DROP TABLE IF EXISTS` to handle missing tables gracefully
- Load AGE extension before graph operations
- Use existing `listProjectGraphs()` and `dropProjectGraph()` functions
- Use existing `setupSchema()`, `setupGitSchema()`, `setupFileHashSchema()` for recreation

## Error Handling

- Require `--force` flag with clear error message
- Handle case where no graphs exist
- Handle case where tables don't exist
