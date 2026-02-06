# Separate Commands + Project Graphs + Cypher API - Shaping Notes

## Scope

Refactor the code-context-mcp tool to:
1. **Separate the `index` command** into two concerns: embeddings (semantic search) vs graph (relationships)
2. **Create project-specific graphs** in Apache AGE (`code_graph_{project}`) instead of a shared graph with project field filtering
3. **Add raw Cypher query capability** via a new MCP tool (`run_cypher`)
4. **Document OpenCypher usage** so agents can write custom graph queries

## Decisions

- **Graph isolation approach:** Separate graphs per project (not property filtering)
  - Pro: True isolation, cleaner queries, can drop entire graph on delete
  - Con: More graphs to manage, but this is handled automatically

- **Keep existing high-level MCP tools:** `search_code`, `get_call_stack`, `get_function_context`, `get_impact_analysis` remain unchanged in interface (they now use project-specific graphs internally)

- **Raw Cypher is read-only:** The `run_cypher` tool blocks write operations (CREATE, DELETE, SET, MERGE, REMOVE, DROP) to prevent agents from corrupting the graph

- **Backward compatibility:** The shared `code_graph` remains as default for empty project parameter, enabling gradual migration

- **Graph name convention:** `code_graph_{sanitized_project_name}` (e.g., `code_graph_my-app`)

## Context

- **Visuals:** None
- **References:** Current codebase explored - see references.md
- **Product alignment:** Aligns with Phase 2 roadmap for multi-project support and extensibility

## Standards Applied

- No project-specific standards defined in `agent-os/standards/index.yml`
- Following existing patterns from the codebase:
  - Commander.js for CLI commands
  - McpServer from `@modelcontextprotocol/sdk` for MCP tools
  - Zod for schema validation
  - Apache AGE Cypher syntax for graph queries
