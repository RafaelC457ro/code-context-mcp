# Prune Command - Full Database Reset

## Summary

Add a `prune` command that completely resets the database by dropping all tables and graphs, then recreating the schema fresh. This avoids compatibility issues with schema changes from old implementations.

## Scope

- Command: `code-context-mcp prune --force`
- Drops ALL project graphs (code_graph_*)
- Drops ALL tables (embeddings, git_commits, file_hashes)
- Recreates fresh schema

## Implementation Flow

```
prune --force
├── Validate --force flag
├── Load AGE extension
├── List all graphs: listProjectGraphs()
├── For each graph:
│   └── dropProjectGraph(project)
├── Drop tables:
│   └── dropAllTables()
│       ├── DROP TABLE IF EXISTS public.embeddings
│       ├── DROP TABLE IF EXISTS public.git_commits
│       └── DROP TABLE IF EXISTS public.file_hashes
├── Recreate schema:
│   ├── setupSchema()
│   ├── setupGitSchema()
│   └── setupFileHashSchema()
└── Print summary
```

## Files Modified

| File | Changes |
|------|---------|
| `src/cli/index.ts` | Add new `prune` command |
| `src/db/schema.ts` | Add `dropAllTables()` function |

## Verification

1. Run `npm test` - all tests should pass
2. Run `npm run build` - no TypeScript errors
