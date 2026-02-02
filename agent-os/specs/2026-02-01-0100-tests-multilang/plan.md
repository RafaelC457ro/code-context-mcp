# Unit Tests, Integration Tests, Rust + Solidity Support, CLI Exclusions

## Summary

Add vitest unit tests, manual integration tests with separate Docker containers, Rust and Solidity language support via a multi-language extractor architecture, and improved CLI directory exclusions.

## Decisions

- **Test framework**: vitest (ESM-native, works with `"type": "module"` + Node16)
- **tree-sitter versions**: tree-sitter-rust@0.21.0 (peer: tree-sitter ^0.21.1), tree-sitter-solidity@1.2.11 (peer: tree-sitter ^0.21.0)
- **Integration DB**: Separate `docker-compose.test.yml` with different ports for full isolation (PG: 5434, Ollama: 11435)
- **Old `collectTypeScriptFiles`**: Removed completely, replaced with `collectFiles`
- **Extractor pattern**: Strategy pattern — `LanguageExtractor` interface, one impl per language, registry keyed by file extension

## Implementation

### New types
- `NodeKind` expanded: `struct`, `enum`, `trait`, `impl`, `module`, `contract`, `event`, `modifier`
- `RelationshipKind` expanded: `IMPLEMENTS`
- `SupportedLanguage` type added

### Extractor architecture
- `src/parser/extractors/types.ts` — `LanguageExtractor` interface
- `src/parser/extractors/typescript.ts` — TypeScript extractor
- `src/parser/extractors/rust.ts` — Rust extractor
- `src/parser/extractors/solidity.ts` — Solidity extractor
- `src/parser/extractors/index.ts` — Registry with `getExtractorForFile()` and `getSupportedExtensions()`
- `src/parser/extractor.ts` — Backward-compatible shim

### Scanner refactoring
- `collectFiles()` replaces `collectTypeScriptFiles()`
- Expanded exclusion set: `node_modules`, `.git`, `dist`, `target`, `build`, `out`

### Test setup
- vitest for unit tests (no Docker needed)
- Separate Docker Compose for integration tests
- 8 unit test files, 2 integration test files
