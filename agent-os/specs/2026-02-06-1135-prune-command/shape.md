# Shape: Prune Command

## New Function: dropAllTables()

Location: `src/db/schema.ts`

```typescript
export async function dropAllTables(): Promise<void> {
  const pool = getPool();
  await pool.query(`DROP TABLE IF EXISTS public.embeddings;`);
  await pool.query(`DROP TABLE IF EXISTS public.git_commits;`);
  await pool.query(`DROP TABLE IF EXISTS public.file_hashes;`);
}
```

## New Command: prune

Location: `src/cli/index.ts`

```typescript
program
  .command('prune')
  .description('Reset database by dropping all tables and graphs')
  .option('--force', 'Required flag to confirm reset')
  .action(async (opts: { force?: boolean }) => {
    // Validate --force flag
    // Load AGE extension
    // List and drop all project graphs
    // Drop all tables
    // Recreate schema
    // Print summary
  });
```

## Expected Output

```
$ code-context-mcp prune --force

Pruning all indexed data...

Dropping project graphs:
  - code_graph_my-project (dropped)
  - code_graph_another-project (dropped)

Dropping tables...
  - embeddings (dropped)
  - git_commits (dropped)
  - file_hashes (dropped)

Recreating schema...
  - embeddings (created)
  - git_commits (created)
  - file_hashes (created)

--- Prune Summary ---
Graphs dropped: 2
Tables reset: 3
Database is now clean.
```
