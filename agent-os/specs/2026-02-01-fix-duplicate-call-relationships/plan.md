# Fix Duplicate Call Relationships in Graph

## Summary

When indexing C code (and potentially other languages), the graph viewer shows duplicate callee edges (e.g., `init_structures` appearing twice) while missing other callees (e.g., `init_server`). The root cause is in the graph layer: `addEdge` uses `CREATE` instead of `MERGE`, allowing duplicate edges, and graph queries lack `DISTINCT`.

## Root Cause Analysis

1. **`addEdge` in `src/graph/operations.ts:61-71`** uses `CREATE (a)-[:RELATIONSHIPKIND]->(b)` which creates a new edge every time, even if one already exists between the same nodes
2. **`getCallees` query** at `src/graph/operations.ts:317-324` does not use `RETURN DISTINCT`, so duplicate edges produce duplicate results
3. The extractor-level deduplication (using `seen` Set) works correctly — the bug is at the graph storage/query layer

## Tasks

### Task 1: Save Spec Documentation
Create `agent-os/specs/2026-02-01-fix-duplicate-call-relationships/` with plan.md, shape.md, references.md

### Task 2: Fix `addEdge` to use MERGE instead of CREATE
**File:** `src/graph/operations.ts` (line 68)
Change `CREATE` to `MERGE` to prevent duplicate edges at the database level.

### Task 3: Add DISTINCT to graph queries
**File:** `src/graph/operations.ts`
Update `getCallees`, `getCallers`, `getUsedTypes` to use `RETURN DISTINCT`.

### Task 4: Add multi-call test cases for C extractor
**File:** `tests/unit/parser/c-extractor.test.ts`
Test function calling multiple different functions with arguments.

### Task 5: Add multi-call test cases for other language extractors
Add equivalent multi-call tests for TypeScript, Rust, and Solidity.

### Task 6: Run all tests to verify fixes

### Task 7: Re-index and verify the fix
Re-index `learning-c/key-value-memory-db/src` and verify correct callees.

### Task 8: Update roadmap
Update `agent-os/product/roadmap.md` to reflect multi-language parser maturity.
