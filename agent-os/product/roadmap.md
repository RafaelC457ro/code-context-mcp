# Product Roadmap

## Phase 1: MVP

- **Tree-Sitter extraction pipeline** — Parse TypeScript files to extract functions, classes, types, and imports with metadata (name, signature, line range, body)
- **PostgreSQL schema + Apache AGE graph** — Store code nodes (Function, Class, Type, File) and relationships (CALLS, IMPORTS, EXTENDS, USES, RETURNS)
- **Embedding generation + pgvector storage** — Generate embeddings for code nodes using a local LLM (Ollama/Llamafile) and store in pgvector for semantic search
- **MCP server with tools:**
  - `search_code(query, limit)` — semantic search via embeddings
  - `get_call_stack(functionName, depth)` — trace dependencies
  - `get_function_context(functionName)` — gather related code
  - `get_impact_analysis(filePath)` — show affected code
- **CLI indexer** — Command-line tool to analyze and index a codebase
- **Claude Desktop configuration** — Ready-to-use MCP server config

## Phase 2: Multi-Language Support & Reliability

- **Multi-language extraction** — C, Rust, and Solidity parsers alongside the original TypeScript parser, with language-specific AST handling for functions, structs, traits, contracts, etc.
- **Graph deduplication** — MERGE-based edge creation to prevent duplicate relationships, DISTINCT queries for reliable results, and two-pass indexing (vertices first, edges second) to resolve cross-file dependencies
- **C forward declaration dedup** — Skip prototype nodes when a function definition exists in the same file, avoiding duplicate graph vertices
- **Extensible language plugin registry** — `getExtractorForFile()` routing with per-language extractors sharing common helpers
