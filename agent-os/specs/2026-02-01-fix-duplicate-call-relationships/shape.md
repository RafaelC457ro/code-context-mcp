# Fix Duplicate Call Relationships — Shaping Notes

## Scope

Fix a bug where the graph viewer shows duplicate callee edges and missing function calls when indexing C code. The `main` function in `learning-c/key-value-memory-db/src/mendb.c` calls `init_structures()` and `init_server(...)`, but the graph shows `init_structures` twice and `init_server` is missing. Verify the fix works across all supported languages (C, TypeScript, Rust, Solidity).

## Decisions

- Fix at the graph layer (MERGE instead of CREATE) rather than adding more extractor-level deduplication — the extractors already deduplicate correctly
- Add DISTINCT to queries as defense-in-depth
- Add multi-call test cases for all four language extractors to prevent regression
- Update roadmap to reflect multi-language parser maturity

## Context

- **Visuals:** None
- **References:** All four language extractors (`src/parser/extractors/c.ts`, `typescript.ts`, `rust.ts`, `solidity.ts`), graph operations (`src/graph/operations.ts`), existing test suite (`tests/unit/parser/`)
- **Product alignment:** Directly supports the core mission of accurate code parsing and graph-based codebase understanding. Roadmap will be updated.

## Standards Applied

No standards indexed yet (standards index is empty).
