# References for Update Integration Tests

## Similar Implementations

### Existing Integration Tests

- **Location:** `tests/integration/`
- **Relevance:** Direct predecessor — these are the files being updated
- **Key patterns:** beforeAll/afterAll setup with cleanupProject, unique TEST_PROJECT per file, fixture-based indexing

### Unit Tests

- **Location:** `tests/unit/`
- **Relevance:** Reference for test structure and assertion patterns
- **Key patterns:** Per-extractor test files, fixture file usage, vitest describe/it/expect
