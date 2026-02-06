# code-context-mcp

MCP server for semantic code search and dependency graph analysis. Indexes codebases into a knowledge graph (Apache AGE) with vector embeddings (pgvector + Ollama) for AI-powered code understanding.

## Supported Languages

- **TypeScript** (`.ts`, `.tsx`) — functions, classes, types, interfaces, imports
- **Rust** (`.rs`) — functions, structs, enums, traits, impl blocks, modules, use declarations
- **Solidity** (`.sol`) — contracts, functions, events, modifiers, structs, enums, interfaces, imports

## Prerequisites

- **Docker** and **Docker Compose**
- **Node.js** >= 18

## Quick Start

```bash
# Start PostgreSQL (with AGE + pgvector) and Ollama
docker-compose up -d

# Install dependencies and build
npm install
npm run build
```

## Indexing a Codebase

```bash
# Index a directory (project name auto-derived from directory basename)
node dist/cli/index.js index ./src

# Override the project name
node dist/cli/index.js index ./src --project my-project

# Index multiple codebases
node dist/cli/index.js index /path/to/frontend --project frontend
node dist/cli/index.js index /path/to/backend --project backend
```

The indexer will:
1. Parse all supported source files (TypeScript, Rust, Solidity) using tree-sitter
2. Build a code graph with functions, classes, types, contracts, traits, and their relationships
3. Generate vector embeddings for semantic search via Ollama
4. Show a progress bar during indexing

Re-running the indexer on the same directory skips unchanged files (detected via content hash).

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

List all indexed projects and their node counts.

**Parameters:** none

### `search_code`

Semantic search across the indexed codebase. Finds functions, classes, types, and imports by meaning.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | yes | Natural language search query |
| `limit` | number | no | Maximum results (default: 10) |
| `project` | string | no | Scope search to a project |

### `get_call_stack`

Trace the call dependency tree from a function.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `functionName` | string | yes | Function to trace from |
| `depth` | number | no | Max traversal depth, 1-10 (default: 3) |
| `project` | string | no | Scope to a project |

### `get_function_context`

Gather full context for a function: callers, callees, types it uses.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `functionName` | string | yes | Function to get context for |
| `project` | string | no | Scope to a project |

### `get_impact_analysis`

Analyze impact of changes to a file. Shows all external code that depends on definitions in the file.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filePath` | string | yes | Relative path of the file (as indexed) |
| `project` | string | no | Scope to a project |

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

Unit tests run without Docker and cover extractors, scanner, registry, progress bar, embeddings, and DB queries.

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
