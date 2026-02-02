# Shaping Notes

## Problem

Adding a new language extractor currently requires:
1. Creating the extractor file
2. Registering it in `index.ts`
3. Knowing about duplicated helper functions to copy

The helper duplication (`findDescendants`/`findDescendant`) across all three extractors is unnecessary and creates maintenance burden.

Additionally, `.js` and `.jsx` files are not supported despite `tree-sitter-typescript` handling them natively.

## Appetite

Small batch — focused refactor + one new language + one extension expansion.

## Solution Shape

- Extract shared helpers to reduce boilerplate
- Add `language` property so extractors are self-describing
- Add C as proof that the pattern works for non-JS languages
- Extend TS extractor to cover JS/JSX (zero logic changes needed)

## Rabbit Holes

- **Auto-discovery of extractors**: Dynamic imports add complexity for no real benefit. One import line per language is fine.
- **Abstract base class**: Would over-constrain extractors. The interface contract is sufficient.
- **C++ support**: Out of scope. C is simpler and validates the pattern. C++ can follow later.

## No-Gos

- No changes to graph schema or database
- No new `NodeKind` values (C maps to existing kinds)
- No changes to embedding or search logic
