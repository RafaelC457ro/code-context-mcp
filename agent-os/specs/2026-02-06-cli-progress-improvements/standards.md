# Standards: CLI Progress Improvements

## Code Style

- Follow existing TypeScript patterns in the codebase
- Use async/await for database operations
- Use optional chaining for potentially undefined values
- Export functions at module level, not as class methods (matching queries.ts pattern)

## Database Conventions

- Table names use snake_case: `file_hashes`
- Column names use snake_case: `file_path`, `last_indexed`
- Use `UNIQUE(project, file_path)` constraint for upsert support
- Use `$1, $2` parameterized queries to prevent SQL injection
- Schema setup functions follow `setup*Schema()` naming pattern

## Progress Display

- Use Unicode block characters for progress bar: `█` (filled) and `░` (empty)
- Clear line with `\r\x1b[K` in TTY mode
- No ANSI escape codes in non-TTY mode
- Show percentages at 25%, 50%, 75%, 100% milestones in non-TTY mode
- Format time as `Xm Ys` (e.g., "1m 23s")

## Error Handling

- Log errors with `console.error()` but continue processing
- Prefix error messages with context (e.g., file path)
- Don't throw on individual file failures

## Testing

- Unit tests go in `tests/unit/`
- Integration tests go in `tests/integration/`
- Test files match source file names with `.test.ts` suffix
- Use vitest assertions
