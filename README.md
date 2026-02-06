# code-context-mcp

MCP server for semantic code search and dependency graph analysis. Indexes codebases into a knowledge graph (Apache AGE) with vector embeddings (pgvector + Ollama) for AI-powered code understanding.

## Supported Languages

| Language | Extensions | Extracted Nodes | Relationships |
|----------|-----------|-----------------|---------------|
| TypeScript | `.ts`, `.tsx`, `.js`, `.jsx` | functions, classes, types, interfaces, imports | CALLS, IMPORTS, EXTENDS, USES |
| Rust | `.rs` | functions, structs, enums, traits, impl blocks, modules | CALLS, IMPORTS, IMPLEMENTS |
| Solidity | `.sol` | contracts, functions, events, modifiers, structs, enums, interfaces | CALLS, IMPORTS, EXTENDS |
| C | `.c`, `.h` | functions, structs, enums, typedefs | CALLS, IMPORTS |

## Prerequisites

- **Docker** and **Docker Compose**
- **Node.js** >= 18

### Quick Start

```bash
# Start PostgreSQL (with AGE + pgvector) and Ollama
docker-compose up -d

# Install dependencies and build
npm install
npm run build

# Optional: Install CLI globally
npm link
```

After installing globally, use `code-context-mcp` from any directory. Otherwise, use `node dist/cli/index.js`.

### CLI Usage

The CLI is available as `code-context-mcp` (after global install) or via `node dist/cli/index.js`.

### `index <directory>`

Index a codebase for semantic search (embeddings only).

```bash
# Index a directory (project name auto-derived from directory basename)
code-context-mcp index ./src

# Override the project name
code-context-mcp index ./src --project my-project

# Index multiple codebases
code-context-mcp index /path/to/frontend --project frontend
code-context-mcp index /path/to/backend --project backend
```

The indexer will:
1. Parse all supported source files (TypeScript, Rust, Solidity, C) using tree-sitter
2. Generate vector embeddings for semantic search via Ollama
3. Store embeddings in pgvector
4. Show a progress bar during indexing

### `graph <directory>`

Build code graph (vertices and edges) for a codebase. Each project gets its own isolated graph (`code_graph_{project}`).

```bash
# Build graph for a directory
code-context-mcp graph ./src

# Override the project name
code-context-mcp graph ./src --project my-project
```

The graph builder will:
1. Parse all supported source files using tree-sitter
2. Create a project-specific graph in Apache AGE
3. Build vertices for functions, classes, types, contracts, traits, etc.
4. Create edges for CALLS, IMPORTS, EXTENDS, USES relationships
5. Show a progress bar during graph building

**Typical workflow:**
```bash
# First, create embeddings for semantic search
code-context-mcp index ./my-project --project myproj

# Then, build the graph for dependency analysis
code-context-mcp graph ./my-project --project myproj
```

### `index-git <directory>`

Index git commit history for semantic search. Embeds commit messages and diffs so you can search commits by meaning.

```bash
# Index git history (project name auto-derived from directory basename)
code-context-mcp index-git .

# Override the project name
code-context-mcp index-git . --project my-project

# Limit the number of commits to index
code-context-mcp index-git . --project my-project --max-commits 200
```

The indexer will:
1. Extract commits from the git repository (hash, author, date, message, files changed, diff)
2. Generate vector embeddings for each commit via Ollama
3. Store commits in pgvector for semantic search

Re-running the command skips already-indexed commits (incremental indexing).

### `delete <project-name>`

Delete all indexed data for a project.

```bash
# Delete a project (requires --force flag)
code-context-mcp delete my-project --force
```

The delete command removes:
- All embeddings for the project
- The project-specific graph (`code_graph_{project}`)
- All indexed git commits for the project

**Warning:** This action cannot be undone.

### CLI Reference

| Command | Arguments | Options | Description |
|---------|-----------|---------|-------------|
| `index` | `<directory>` | `--project <name>` | Index a codebase for semantic search (embeddings only) |
| `graph` | `<directory>` | `--project <name>` | Build code graph for dependency analysis |
| `index-git` | `<directory>` | `--project <name>`, `--max-commits <n>` | Index git commit history for semantic search |
| `delete` | `<project-name>` | `--force` | Delete all indexed data for a project |

**Global Options:**
- `-h, --help` - Display help for command
- `-V, --version` - Display version number

**Project Naming:**
When using the `--project` option, the name is sanitized to lowercase, with special characters replaced by hyphens. For example, `MyProject!` becomes `my-project`.

## Claude Desktop Configuration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "code-context": {
      "command": "node",
      "args": ["dist/mcp/server.js"],
      "cwd": "/path/to/code-context-mcp",
      "env": {
        "PGHOST": "localhost",
        "PGPORT": "5433",
        "PGDATABASE": "rag_db",
        "PGUSER": "postgres",
        "PGPASSWORD": "postgres",
        "OLLAMA_URL": "http://localhost:11434"
      }
    }
  }
}
```

## MCP Tools

### `list_projects`

List all indexed projects, their node counts, and whether they have a graph.

**Parameters:** none

**Returns:** Array with `project`, `nodeCount`, and `hasGraph` fields.

### `search_code`

Semantic search across the indexed codebase. Finds functions, classes, types, and imports by meaning.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | yes | Natural language search query |
| `limit` | number | no | Maximum results (default: 10) |
| `project` | string | no | Scope search to a project. Required for graph enrichment. |

### `get_call_stack`

Trace the call dependency tree from a function.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `functionName` | string | yes | Function to trace from |
| `depth` | number | no | Max traversal depth, 1-10 (default: 3) |
| `project` | string | **yes** | Project name (required for graph queries) |

### `get_function_context`

Gather full context for a function: callers, callees, types it uses.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `functionName` | string | yes | Function to get context for |
| `project` | string | **yes** | Project name (required for graph queries) |

### `get_impact_analysis`

Analyze impact of changes to a file. Shows all external code that depends on definitions in the file.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filePath` | string | yes | Relative path of the file (as indexed) |
| `project` | string | **yes** | Project name (required for graph queries) |

### `search_git_history`

Semantic search across indexed git commit history. Finds commits by meaning of their messages and changes.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | yes | Natural language search query (e.g. "fix authentication bug") |
| `limit` | number | no | Maximum results (default: 10) |
| `project` | string | no | Scope search to a project |

### `run_cypher`

Execute a raw OpenCypher query against a project's code graph. Only read-only queries are allowed.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project` | string | yes | Project name |
| `query` | string | yes | OpenCypher query (read-only) |

**Example queries:**
```cypher
-- List all functions
MATCH (f:Function) RETURN f.name, f.file_path LIMIT 10

-- Find functions that call a specific function
MATCH (caller:Function)-[:CALLS]->(f:Function {name: 'handleRequest'})
RETURN caller.name, caller.file_path

-- Find all types used by a function
MATCH (f:Function {name: 'processData'})-[:USES]->(t:Type)
RETURN t.name, t.file_path
```

See [docs/CYPHER_REFERENCE.md](docs/CYPHER_REFERENCE.md) for full schema and query examples.

## OpenCode Configuration

Add an `opencode.json` file to your project root (or edit your existing one):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "code-context": {
      "type": "local",
      "command": ["node", "dist/mcp/server.js"],
      "environment": {
        "PGHOST": "localhost",
        "PGPORT": "5433",
        "PGDATABASE": "rag_db",
        "PGUSER": "postgres",
        "PGPASSWORD": "postgres",
        "OLLAMA_URL": "http://localhost:11434"
      }
    }
  }
}
```

> **Note:** The `command` array runs from the directory where `opencode.json` is located. If the config is not in the `code-context-mcp` directory, use an absolute path: `["node", "/path/to/code-context-mcp/dist/mcp/server.js"]`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PGHOST` | `localhost` | PostgreSQL host |
| `PGPORT` | `5433` | PostgreSQL port |
| `PGDATABASE` | `rag_db` | Database name |
| `PGUSER` | `postgres` | Database user |
| `PGPASSWORD` | `postgres` | Database password |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama API endpoint |

## Testing

### Unit Tests

Unit tests run without Docker and cover extractors, scanner, registry, progress bar, embeddings, DB queries, git extractor, and git queries.

```bash
npm test              # Run all unit tests
npm run test:watch    # Watch mode
```

### Integration Tests

Integration tests require separate Docker containers to avoid interfering with development data.

```bash
# Start test infrastructure (separate ports: PG=5434, Ollama=11435)
docker compose -f docker-compose.test.yml up -d

# Run integration tests
npm run test:integration
```

Integration tests cover the full indexing pipeline and multi-language graph population.
