# Code Graph RAG MCP Server — Shaping Notes

## Scope

Build the full MVP: a TypeScript MCP server that enables Claude to understand and query local TypeScript codebases through semantic search (pgvector) and dependency graph analysis (Apache AGE). Includes Tree-Sitter extraction pipeline, Docker-containerized infrastructure, 4 MCP tools, CLI indexer, and Claude Desktop configuration.

## Decisions

- All infrastructure (PostgreSQL with AGE + pgvector, Ollama embedding engine) runs self-contained in Docker containers via docker-compose
- Embedding model: `nomic-embed-text` via Ollama (768-dim vectors)
- MCP transport: stdio (standard for Claude Desktop)
- Graph database: Apache AGE extension for PostgreSQL (not a separate graph DB)
- Re-indexing uses file hashing to skip unchanged files

## Context

- **Visuals:** None
- **References:** Greenfield project, no existing code references
- **Product alignment:** Directly implements Phase 1 MVP from product roadmap

## Standards Applied

No standards defined yet for this project.
