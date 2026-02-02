# Extensible Language Plugin Architecture + C Support + JSX Extensions

## Summary

Refine the extractor architecture to make adding new languages a 1-file task, add C language support, and add `.js`/`.jsx` file extension support to the existing TypeScript extractor.

## Tasks

1. **Extract shared tree-sitter helpers** — Move `findDescendants()`/`findDescendant()` into `src/parser/extractors/helpers.ts`
2. **Add `language` property to LanguageExtractor** — Each extractor declares its language name
3. **Add `.js`/`.jsx` support** — TypeScript extractor handles JS/JSX via `tree-sitter-typescript`
4. **Create C extractor** — New `src/parser/extractors/c.ts` using `tree-sitter-c`
5. **Register C extractor** — Add to registry, add `getRegisteredLanguages()` helper
6. **Delete legacy `extractor.ts`** — Dead code, nothing imports it
7. **Update tests** — Registry tests, C extractor tests, fixture files

## C AST Node Mapping

| C AST Node | Kind |
|---|---|
| `function_definition` | `'function'` |
| `struct_specifier` | `'struct'` |
| `enum_specifier` | `'enum'` |
| `type_definition` | `'type'` |
| `preproc_include` | `'import'` |
| `declaration` w/ `function_declarator` | `'function'` |

## Design Decisions

- Explicit imports over auto-discovery
- No abstract base class — interface is the right contract
- Reuse `'type'` for C typedef
- Shared helpers for tree traversal only (call extraction differs per language)
