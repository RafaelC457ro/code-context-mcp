# Plan: Separate CLI Commands + Project-Specific Graphs + Raw Cypher API

## Summary

Refactor the CLI and MCP server to:
1. **Separate `index` command** - Only creates embeddings for semantic search
2. **New `graph` command** - Only builds graph vertices/edges (Apache AGE)
3. **Project-specific graphs** - Each project gets its own `code_graph_{project}` graph
4. **New `run_cypher` MCP tool** - Execute raw OpenCypher queries against a project's graph
5. **Documentation** - Full OpenCypher reference for agents

---

## Task 1: Save Spec Documentation

Create `agent-os/specs/2026-02-05-1430-separate-commands-project-graphs/` with:
- `plan.md` - This full plan
- `shape.md` - Shaping notes and decisions
- `references.md` - Pointers to current implementation

---

## Task 2: Add Project-Specific Graph Functions to Schema

**File:** `src/db/schema.ts`

Add three new functions:

```typescript
// Create project-specific graph with all labels
export async function ensureProjectGraph(projectName: string): Promise<void>

// Drop entire project graph
export async function dropProjectGraph(projectName: string): Promise<void>

// List all project graphs
export async function listProjectGraphs(): Promise<string[]>
```

Key implementation details:
- Graph name format: `code_graph_{projectName}`
- Create all vertex labels: Function, Class, Type, File, Struct, Enum, Trait, Impl, Module, Contract, Event, Modifier
- Create all edge labels: CALLS, IMPORTS, EXTENDS, USES, RETURNS, DEFINED_IN, IMPLEMENTS
- Use `SELECT drop_graph($1, true)` for cascading deletion

---

## Task 3: Parameterize Graph Name in Operations

**File:** `src/graph/operations.ts`

Changes:
1. Add `getGraphNameForProject(project: string): string` helper
2. Modify `cypherQuery(query, graphName = 'code_graph')` to accept graph name
3. Update ALL 17 functions that call `cypherQuery()` to derive graph name from project
4. Remove `projectFilter()` function (no longer needed with separate graphs)
5. Simplify Cypher queries - remove `, project: '${project}'` filters

Functions to update:
- `addVertex()`, `addEdge()`, `clearFileVertices()`, `deleteProjectGraph()`
- `populateGraph()`, `upsertFileVertex()`, `getFileHash()`, `findNodeByName()`
- `findNodesByFile()`, `enrichSearchResults()`, `getCallStack()`
- `getCallers()`, `getCallees()`, `getUsedTypes()`, `getReverseImpact()`
- `listGraphProjects()`

---

## Task 4: Add Raw Cypher Query Function

**File:** `src/graph/operations.ts`

Add new function:

```typescript
export async function runRawCypher(
  query: string,
  graphName: string
): Promise<{ rows: unknown[]; rowCount: number }>
```

Features:
- Validate query is read-only (block CREATE, DELETE, SET, REMOVE, MERGE, DROP)
- Execute against specified graph
- Parse AGE agtype results to JSON
- Return structured result with row count

---

## Task 5: Separate CLI Commands

**File:** `src/cli/index.ts`

### 5a: Modify `index` command (lines 32-142)
- Remove all graph imports and operations
- Keep only: file scanning, embedding generation, pgvector storage
- Update description: "Index a codebase for semantic search (embeddings only)"

### 5b: Add new `graph` command (after line 142)
```
code-context-mcp graph <directory> [--project <name>]
```
- Setup database and call `ensureProjectGraph(project)`
- Collect and parse files
- Two-pass indexing: vertices first, edges second
- Progress bar for graph building
- Skip file hash check (embeddings handle caching)

### 5c: Update `delete` command (lines 205-248)
- Import and use `dropProjectGraph()` from schema
- Drop entire project graph instead of deleting nodes with filter

---

## Task 6: Add `run_cypher` MCP Tool

**File:** `src/mcp/server.ts`

Add new tool:

```typescript
server.tool(
  'run_cypher',
  'Execute a raw OpenCypher query against a project\'s code graph.',
  {
    project: z.string().describe('Project name (required)'),
    query: z.string().describe('OpenCypher query (read-only)'),
  },
  async ({ project, query }) => {
    // 1. Validate project exists via listProjectGraphs()
    // 2. Get graph name: code_graph_{project}
    // 3. Execute query via runRawCypher()
    // 4. Return JSON results
  }
);
```

Also update `list_projects` tool to include `hasGraph` field.

---

## Task 7: Update Documentation

### 7a: Update README.md
- Add `graph` command documentation
- Add `run_cypher` tool documentation with examples
- Add graph schema reference section

### 7b: Create docs/CYPHER_REFERENCE.md
- Full vertex/edge schema
- 20+ example queries by use case
- Apache AGE-specific notes
- Query safety restrictions

---

## Verification

### Test the changes:
```bash
# 1. Build
npm run build

# 2. Test separate commands
npx code-context-mcp index ./test-project --project test
npx code-context-mcp graph ./test-project --project test

# 3. Test MCP tools via Claude Desktop or:
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_projects","arguments":{}},"id":1}' | node dist/mcp/server.js

# 4. Test run_cypher
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"run_cypher","arguments":{"project":"test","query":"MATCH (f:Function) RETURN f.name LIMIT 5"}},"id":1}' | node dist/mcp/server.js
```

### Check for regressions:
- Existing MCP tools (search_code, get_call_stack, etc.) should still work
- Project filtering should use graph isolation, not property filters

---

## Critical Files

| File | Changes |
|------|---------|
| `src/db/schema.ts` | Add 3 new graph lifecycle functions |
| `src/graph/operations.ts` | Parameterize graph name + add runRawCypher |
| `src/cli/index.ts` | Split index, add graph, update delete |
| `src/mcp/server.ts` | Add run_cypher tool |
| `README.md` | Document new commands and OpenCypher reference |
| `docs/CYPHER_REFERENCE.md` | New file with full query documentation |
