# Code Graph RAG MCP Server — Implementation Plan

## Overview

Build a full MVP of the Code Graph RAG MCP server: a TypeScript MCP server that enables Claude to understand and query local TypeScript codebases through semantic search (pgvector) and dependency graph analysis (Apache AGE). All infrastructure (Postgres, embedding engine) runs self-contained in Docker.

## Key Decision

- **All infrastructure in Docker:** PostgreSQL (with AGE + pgvector) and Ollama (embedding engine) run as Docker containers via docker-compose. The existing `docker-compose.yml` is the starting point.

---

## Task 1: Save Spec Documentation

Create `agent-os/specs/2026-01-31-1745-code-graph-rag-mcp-server/` with:

- **plan.md** — This full plan
- **shape.md** — Shaping notes (scope, decisions, context)
- **references.md** — No existing references (greenfield project)

No visuals or standards to include.

---

## Task 2: Project Scaffolding

Initialize the Node.js + TypeScript project:

- `package.json` with dependencies: `@modelcontextprotocol/sdk`, `tree-sitter`, `tree-sitter-typescript`, `pg`, `ollama` (or HTTP client for Ollama API)
- `tsconfig.json` with strict mode, ES module output
- Directory structure:
  ```
  src/
  ├── parser/        # Tree-Sitter extraction
  ├── db/            # PostgreSQL connection, schema, queries
  ├── graph/         # Apache AGE graph operations
  ├── embeddings/    # Ollama embedding generation
  ├── mcp/           # MCP server and tool handlers
  └── cli/           # CLI indexer entry point
  ```

---

## Task 3: Docker Infrastructure

Expand `docker-compose.yml` to include all services:

**Postgres container** (custom Dockerfile):
- Base: `postgres:16`
- Install extensions: `pgvector`, `apache-age`
- Init script to `CREATE EXTENSION` on startup
- Port: 5433:5432 (as existing)
- Healthcheck (as existing)

**Ollama container:**
- Image: `ollama/ollama`
- Volume for model storage (persist downloaded models)
- Port: 11434:11434
- Healthcheck: `curl http://localhost:11434/api/tags`
- Pull a default embedding model on first run (e.g., `nomic-embed-text`)

Create the Postgres `Dockerfile` with AGE + pgvector extensions installed.

---

## Task 4: Database Schema + Graph Setup

**Relational schema** (for pgvector search):
- `code_nodes` table: `id`, `file_path`, `name`, `kind` (function/class/type/import), `signature`, `start_line`, `end_line`, `body`, `embedding vector(768)`
- `files` table: `id`, `path`, `hash` (for change detection on re-index)
- Indexes: GiST or IVFFlat index on embedding column, indexes on `name`, `kind`, `file_path`

**Graph setup** (Apache AGE):
- Create graph: `ag_catalog.create_graph('code_graph')`
- Vertex labels: `Function`, `Class`, `Type`, `File`
- Edge labels: `CALLS`, `IMPORTS`, `EXTENDS`, `USES`, `RETURNS`

Create an init SQL script and a TypeScript migration/setup module.

---

## Task 5: Tree-Sitter Extraction Pipeline

- Parse `.ts` and `.tsx` files using Tree-Sitter TypeScript grammar
- Extract nodes:
  - **Functions**: name, parameters, return type, body, line range
  - **Classes**: name, methods, properties, extends/implements
  - **Types/Interfaces**: name, members
  - **Imports**: source module, imported names
- Extract relationships by analyzing:
  - Function calls within bodies → CALLS edges
  - Import statements → IMPORTS edges
  - Class extends/implements → EXTENDS edges
  - Type references in signatures → USES edges
  - Return type references → RETURNS edges
- Output structured `CodeNode[]` and `Relationship[]` arrays

---

## Task 6: Embedding Generation + Storage

- Connect to Ollama container at `http://localhost:11434`
- For each extracted code node, generate an embedding from a text representation (combine name + signature + body snippet)
- Use `nomic-embed-text` model (768-dim vectors)
- Batch insert embeddings into `code_nodes.embedding` column
- Implement similarity search query: `ORDER BY embedding <=> $query_embedding LIMIT $n`

---

## Task 7: Graph Population

- For each extracted code node, create a vertex in AGE with properties (name, file_path, kind, line range)
- For each extracted relationship, create an edge in AGE
- Use Cypher queries via AGE's SQL interface
- Handle re-indexing: clear graph for changed files, re-insert

---

## Task 8: MCP Server with Tools

Implement MCP server using `@modelcontextprotocol/sdk`:

**`search_code(query, limit)`**
- Generate embedding for the query string via Ollama
- Run pgvector similarity search
- Return top-N matching code nodes with metadata

**`get_call_stack(functionName, depth)`**
- Cypher query: traverse CALLS edges from the named function up to `depth` levels
- Return the call tree as structured data

**`get_function_context(functionName)`**
- Find the function node
- Gather: its callers, callees, types it uses, file it belongs to, imports
- Return a combined context object

**`get_impact_analysis(filePath)`**
- Find all code nodes in the file
- Traverse reverse edges (who CALLS, IMPORTS, USES these nodes)
- Return affected files and functions

Server transport: stdio (standard for Claude Desktop MCP servers).

---

## Task 9: CLI Indexer

- Entry point: `src/cli/index.ts`
- Command: `npx code-context-mcp index <directory>`
- Steps:
  1. Scan directory for `.ts`/`.tsx` files
  2. Hash each file, skip unchanged files (compare with `files` table)
  3. Run Tree-Sitter extraction
  4. Generate embeddings via Ollama
  5. Insert/update code_nodes and graph
  6. Report summary (files processed, nodes extracted, relationships created)
- Add `bin` entry in `package.json`

---

## Task 10: Claude Desktop Configuration

- Create example config file: `claude-desktop-config.json`
- MCP server entry pointing to the built server
- Document: how to start Docker services, run indexer, configure Claude Desktop
