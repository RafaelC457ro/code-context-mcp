# Product Mission

## Problem

Developers working with large TypeScript codebases lack an efficient way to semantically search code, trace dependencies, and understand the impact of changes. Traditional text-based search and manual code navigation are slow and miss semantic relationships between code elements.

## Target Users

Developers using Claude (via Claude Desktop or other MCP-compatible clients) who need to understand, navigate, and reason about local TypeScript codebases.

## Solution

An MCP server that combines code parsing (Tree-Sitter), a knowledge graph (PostgreSQL + Apache AGE), and vector search (pgvector) to give Claude deep, queryable understanding of a codebase. This enables semantic code search, dependency tracing, context gathering, and impact analysis — all accessible as MCP tools.
