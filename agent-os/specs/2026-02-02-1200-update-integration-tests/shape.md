# Update Integration Tests — Shaping Notes

## Scope

Update existing integration tests to cover the full current API surface. Split the combined multi-language test into per-language files and add a new graph operations test file covering untested functions.

## Decisions

- Split multi-language test into 4 separate per-language files for isolation and clarity
- Add C language coverage (was missing from integration tests)
- Add dedicated graph operations test covering 9 untested functions
- Keep existing pipeline.test.ts as-is (API surface matches current code)
- Follow existing unit test patterns as reference

## Context

- **Visuals:** None
- **References:** Unit tests in `tests/unit/` used as pattern reference
- **Product alignment:** Supports mission of semantic code search across multiple languages

## Standards Applied

- No standards indexed yet (standards index is empty)
