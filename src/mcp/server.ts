import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { setup, listProjectGraphs } from '../db/schema.js';
import { searchByEmbedding, listProjects } from '../db/queries.js';
import { searchGitCommits } from '../db/git-queries.js';
import { generateEmbedding } from '../embeddings/ollama.js';
import { findNodeByName, findNodesByFile, enrichSearchResults, getCallStack, getCallers, getCallees, getUsedTypes, getReverseImpact, runRawCypher, getGraphNameForProject } from '../graph/operations.js';

const server = new McpServer({
  name: 'code-context-mcp',
  version: '0.1.0',
});

server.tool(
  'list_projects',
  'List all indexed projects and their node counts.',
  {},
  async () => {
    const projects = await listProjects();
    const graphProjects = await listProjectGraphs();
    const graphSet = new Set(graphProjects);

    const enrichedProjects = projects.map(p => ({
      ...p,
      hasGraph: graphSet.has(p.project),
    }));

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(enrichedProjects, null, 2),
      }],
    };
  }
);

server.tool(
  'search_code',
  'Semantic search across the indexed codebase. Finds functions, classes, types, and imports by meaning.',
  {
    query: z.string().describe('Natural language search query (e.g. "state management functions")'),
    limit: z.number().optional().default(10).describe('Maximum number of results to return'),
    project: z.string().optional().describe('Project name to scope the search to. Required for graph enrichment.'),
  },
  async ({ query, limit, project }) => {
    const queryEmbedding = await generateEmbedding(query);
    const hits = await searchByEmbedding(queryEmbedding, limit, project);

    // If project is specified, try to enrich with graph data
    if (project) {
      const graphProjects = await listProjectGraphs();
      if (graphProjects.includes(project)) {
        const enriched = await enrichSearchResults(hits, project);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(enriched.map(r => {
              const node = r.node;
              if (!node) {
                return {
                  name: r.hit.name,
                  file: r.hit.filePath,
                  project: r.hit.project,
                  score: r.hit.score.toFixed(4),
                };
              }
              return {
                name: node.name,
                kind: node.kind,
                file: node.filePath,
                project: r.hit.project,
                lines: `${node.startLine}-${node.endLine}`,
                signature: node.signature,
                score: r.hit.score.toFixed(4),
                body: node.body,
              };
            }), null, 2),
          }],
        };
      }
    }

    // Return basic results without graph enrichment
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(hits.map(h => ({
          name: h.name,
          file: h.filePath,
          project: h.project,
          score: h.score.toFixed(4),
        })), null, 2),
      }],
    };
  }
);

server.tool(
  'get_call_stack',
  'Trace the call dependency tree from a function. Shows what functions it calls, recursively up to the specified depth.',
  {
    functionName: z.string().describe('Name of the function to trace from'),
    depth: z.number().optional().default(3).describe('Maximum depth to traverse (1-10)'),
    project: z.string().describe('Project name (required for graph queries)'),
  },
  async ({ functionName, depth, project }) => {
    // Verify project graph exists
    const graphProjects = await listProjectGraphs();
    if (!graphProjects.includes(project)) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: `Graph for project "${project}" not found. Run "code-context-mcp graph <directory> --project ${project}" first.`,
            availableGraphs: graphProjects,
          }, null, 2),
        }],
      };
    }

    const clampedDepth = Math.min(Math.max(depth, 1), 10);
    const stack = await getCallStack(functionName, clampedDepth, project);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          root: functionName,
          depth: clampedDepth,
          callees: stack,
        }, null, 2),
      }],
    };
  }
);

server.tool(
  'get_function_context',
  'Gather full context for a function: its callers, callees, types it uses, and the file it belongs to.',
  {
    functionName: z.string().describe('Name of the function to get context for'),
    project: z.string().describe('Project name (required for graph queries)'),
  },
  async ({ functionName, project }) => {
    // Verify project graph exists
    const graphProjects = await listProjectGraphs();
    if (!graphProjects.includes(project)) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: `Graph for project "${project}" not found. Run "code-context-mcp graph <directory> --project ${project}" first.`,
            availableGraphs: graphProjects,
          }, null, 2),
        }],
      };
    }

    const node = await findNodeByName(functionName, project);
    if (!node) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ error: `Function "${functionName}" not found in the index` }),
        }],
      };
    }

    const [callers, callees, usedTypes] = await Promise.all([
      getCallers(functionName, project),
      getCallees(functionName, project),
      getUsedTypes(functionName, project),
    ]);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          function: {
            name: node.name,
            kind: node.kind,
            file: node.filePath,
            lines: `${node.startLine}-${node.endLine}`,
            signature: node.signature,
            body: node.body,
          },
          callers: callers.map(n => ({ name: n.name, file: n.filePath })),
          callees: callees.map(n => ({ name: n.name, file: n.filePath })),
          usedTypes: usedTypes.map(n => ({ name: n.name, file: n.filePath })),
        }, null, 2),
      }],
    };
  }
);

server.tool(
  'get_impact_analysis',
  'Analyze the impact of changes to a file. Shows all external code that depends on functions, classes, and types defined in the file.',
  {
    filePath: z.string().describe('Relative path of the file to analyze (as indexed)'),
    project: z.string().describe('Project name (required for graph queries)'),
  },
  async ({ filePath, project }) => {
    // Verify project graph exists
    const graphProjects = await listProjectGraphs();
    if (!graphProjects.includes(project)) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: `Graph for project "${project}" not found. Run "code-context-mcp graph <directory> --project ${project}" first.`,
            availableGraphs: graphProjects,
          }, null, 2),
        }],
      };
    }

    const nodesInFile = await findNodesByFile(filePath, project);
    if (nodesInFile.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ error: `No indexed code found for "${filePath}"` }),
        }],
      };
    }

    const affected = await getReverseImpact(filePath, project);

    // Group by affected file
    const byFile = new Map<string, Array<{ name: string; kind: string; relationship: string }>>();
    for (const a of affected) {
      const list = byFile.get(a.filePath) ?? [];
      list.push({ name: a.name, kind: a.kind, relationship: a.relationship });
      byFile.set(a.filePath, list);
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          sourceFile: filePath,
          definedNodes: nodesInFile.map(n => ({ name: n.name, kind: n.kind })),
          affectedFiles: Object.fromEntries(byFile),
        }, null, 2),
      }],
    };
  }
);

server.tool(
  'search_git_history',
  'Semantic search across indexed git commit history. Finds commits by meaning of their messages and changes.',
  {
    query: z.string().describe('Natural language search query (e.g. "fix authentication bug")'),
    limit: z.number().optional().default(10).describe('Maximum number of results to return'),
    project: z.string().optional().describe('Project name to scope the search to. Omit to search all projects.'),
  },
  async ({ query, limit, project }) => {
    const queryEmbedding = await generateEmbedding(query);
    const hits = await searchGitCommits(queryEmbedding, limit, project);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(hits.map(h => ({
          commitHash: h.commitHash,
          author: h.author,
          date: h.date,
          message: h.message,
          filesChanged: JSON.parse(h.filesChanged),
          score: h.score.toFixed(4),
        })), null, 2),
      }],
    };
  }
);

server.tool(
  'run_cypher',
  'Execute a raw OpenCypher query against a project\'s code graph. Only read-only queries are allowed.',
  {
    project: z.string().describe('Project name (required)'),
    query: z.string().describe('OpenCypher query (read-only). See docs/CYPHER_REFERENCE.md for schema and examples.'),
  },
  async ({ project, query }) => {
    // Check if project graph exists
    const graphProjects = await listProjectGraphs();
    if (!graphProjects.includes(project)) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: `Graph for project "${project}" not found. Run "code-context-mcp graph <directory> --project ${project}" first.`,
            availableGraphs: graphProjects,
          }, null, 2),
        }],
      };
    }

    try {
      const result = await runRawCypher(query, project);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            query,
            graphName: getGraphNameForProject(project),
            rowCount: result.rowCount,
            rows: result.rows,
          }, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: err instanceof Error ? err.message : String(err),
            query,
          }, null, 2),
        }],
      };
    }
  }
);

async function main() {
  // Initialize database schema and graph
  await setup();

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server failed to start:', err);
  process.exit(1);
});
