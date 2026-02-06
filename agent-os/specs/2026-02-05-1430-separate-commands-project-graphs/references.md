# References for Separate Commands + Project Graphs + Cypher API

## Similar Implementations

### Current CLI Indexing

- **Location:** `src/cli/index.ts`
- **Relevance:** Contains the combined index command that does both embeddings AND graph
- **Key patterns:**
  - Two-pass indexing: vertices first (lines 86-126), edges second (lines 129-137)
  - File hash caching for incremental updates (lines 63-69)
  - Progress bar integration (`ProgressBar` from `./progress.js`)
  - Project name sanitization (`sanitizeProjectName()` function)

### Graph Operations

- **Location:** `src/graph/operations.ts`
- **Relevance:** Core graph query execution layer
- **Key patterns:**
  - `cypherQuery()` wrapper at line 18-27 - needs graph name parameter
  - `escapeAGE()` for string escaping (line 4-11)
  - `projectFilter()` at line 13-16 - will be removed with separate graphs
  - All graph functions use hardcoded `'code_graph'` graph name

### Database Schema

- **Location:** `src/db/schema.ts`
- **Relevance:** Graph and label creation
- **Key patterns:**
  - `setupGraph()` at lines 51-89 creates the shared `code_graph`
  - Uses `SELECT create_graph()` and `SELECT create_vlabel()/create_elabel()`
  - Checks `ag_catalog.ag_graph` and `ag_catalog.ag_label` for existence

### MCP Server

- **Location:** `src/mcp/server.ts`
- **Relevance:** Tool definition pattern for new `run_cypher`
- **Key patterns:**
  - `server.tool(name, description, schema, handler)` pattern
  - Zod schema for parameter validation
  - Return format: `{ content: [{ type: 'text', text: JSON.stringify(...) }] }`
  - Error handling returns structured JSON errors

## External References

### Apache AGE OpenCypher Support

- AGE implements a subset of OpenCypher (not full Neo4j Cypher)
- Query execution: `SELECT * FROM cypher('graph_name', $$ CYPHER_QUERY $$) AS (result agtype);`
- Graph lifecycle: `create_graph()`, `drop_graph()` functions
- Label management: `create_vlabel()`, `create_elabel()` functions
- Does NOT support: `DETACH DELETE`, `MERGE ON CREATE SET`, some aggregations

### Graph Schema (Current)

**Vertex Labels:**
- Function, Class, Type, File, Struct, Enum, Trait, Impl, Module, Contract, Event, Modifier

**Edge Labels:**
- CALLS, IMPORTS, EXTENDS, USES, RETURNS, DEFINED_IN, IMPLEMENTS

**Common Properties:**
- `name` - Node name (function name, class name, etc.)
- `file_path` - Relative path to source file
- `kind` - Node kind string
- `signature` - Code signature
- `body` - Code body (truncated)
- `start_line`, `end_line` - Line range in source
- `project` - Project name (will be removed with separate graphs)
