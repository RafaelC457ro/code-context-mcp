# Force Delete Project CLI Command + Commander.js Migration

## Summary

Add a `delete <project-name> --force` CLI command to wipe all stored data for a single project. Migrate the CLI from manual arg parsing to commander.js.

## Tasks

1. **Install commander.js** — Replace manual arg parsing with a CLI framework
2. **Add bulk delete functions** — `deleteProjectEmbeddings()` in queries, `deleteProjectGraph()` in graph operations
3. **Rewrite CLI** — Migrate `index` command to commander, add `delete` command
4. **Add tests** — Unit tests for delete functions and CLI behavior

## Delete Command Behavior

```
code-context-mcp delete <project-name> --force
```

- Requires `--force` flag (prevents accidental deletion)
- Sanitizes project name to match indexed format
- Checks project exists before deleting (lists available projects on miss)
- Deletes all embeddings and graph data for the project
- Prints deletion summary with counts

## Design Decisions

- **Commander.js**: Project is gaining commands; framework prevents arg-parsing bugs and gives free `--help`
- **`--force` flag**: Scriptable alternative to interactive confirmation prompts
- **CLI only**: Destructive operations not exposed via MCP
- **Count-then-delete for graph**: AGE DELETE doesn't return a count
