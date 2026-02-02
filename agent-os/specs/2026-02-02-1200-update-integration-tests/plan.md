# Update Integration Tests — Full Coverage

## Summary

Update the integration tests to cover the full current API surface, add C language support, and split multi-language tests into per-language files. Add a new graph operations test file.

## Tasks

### Task 1: Save Spec Documentation
Create this spec folder with plan, shape, and references.

### Task 2: Per-Language Integration Tests
Replace `multi-language.test.ts` with:
- `typescript.test.ts` — TS nodes, relationships, search
- `rust.test.ts` — Rust structs/traits/impls, search
- `solidity.test.ts` — Contracts/events/modifiers, search
- `c-language.test.ts` — C structs/functions/enums, search

### Task 3: Graph Operations Integration Test
New `graph-operations.test.ts` covering:
- getCallStack, getCallees, getCallers
- getUsedTypes, enrichSearchResults
- getReverseImpact
- upsertFileVertex / getFileHash
- clearFileVertices, deleteProjectGraph

### Task 4: Run Tests
Start Docker, build, run `npm run test:integration`, fix failures.
