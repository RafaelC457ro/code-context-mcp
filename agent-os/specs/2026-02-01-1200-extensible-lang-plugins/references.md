# References

## tree-sitter-c

- Package: `tree-sitter-c@0.21.4`
- Grammar: https://github.com/tree-sitter/tree-sitter-c
- Node types: `function_definition`, `struct_specifier`, `enum_specifier`, `type_definition`, `preproc_include`, `declaration`

## tree-sitter-typescript

- Handles `.js` and `.jsx` via its TypeScript grammar (superset of JavaScript)
- `tree-sitter-typescript` exports both `typescript` and `tsx` sub-parsers

## Existing Extractors

- `src/parser/extractors/typescript.ts` — TypeScript/TSX extraction
- `src/parser/extractors/rust.ts` — Rust extraction
- `src/parser/extractors/solidity.ts` — Solidity extraction

All three share identical `findDescendants`/`findDescendant` implementations.
