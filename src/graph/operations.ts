import { getPool } from '../db/connection.js';
import type { CodeNode, Relationship, CallStackEntry, EmbeddingHit } from '../types.js';

function escapeAGE(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

export function getGraphNameForProject(project: string): string {
  return `code_graph_${project}`;
}

async function cypherQuery(query: string, graphName: string): Promise<unknown[]> {
  const pool = getPool();
  await pool.query(`LOAD 'age';`);
  await pool.query(`SET search_path = ag_catalog, "$user", public;`);

  const result = await pool.query(
    `SELECT * FROM cypher('${graphName}', $$ ${query} $$) AS (result agtype);`
  );
  return result.rows;
}

function getVertexLabel(kind: string): string {
  switch (kind) {
    case 'function': return 'Function';
    case 'class': return 'Class';
    case 'type':
    case 'interface': return 'Type';
    case 'import': return 'File';
    case 'struct': return 'Struct';
    case 'enum': return 'Enum';
    case 'trait': return 'Trait';
    case 'impl': return 'Impl';
    case 'module': return 'Module';
    case 'contract': return 'Contract';
    case 'event': return 'Event';
    case 'modifier': return 'Modifier';
    default: return 'Function';
  }
}

export async function addVertex(node: CodeNode, project: string): Promise<void> {
  const label = getVertexLabel(node.kind);
  const name = escapeAGE(node.name);
  const filePath = escapeAGE(node.filePath);
  const signature = escapeAGE(node.signature);
  const body = escapeAGE(node.body);
  const graphName = getGraphNameForProject(project);

  await cypherQuery(
    `CREATE (n:${label} {name: '${name}', file_path: '${filePath}', kind: '${node.kind}', signature: '${signature}', body: '${body}', start_line: ${node.startLine}, end_line: ${node.endLine}})`,
    graphName
  );
}

export async function addEdge(rel: Relationship, project: string): Promise<void> {
  const sourceLabel = getVertexLabel(rel.sourceKind);
  const targetLabel = getVertexLabel(rel.targetKind);
  const sourceName = escapeAGE(rel.sourceName);
  const targetName = escapeAGE(rel.targetName);
  const graphName = getGraphNameForProject(project);

  await cypherQuery(
    `MATCH (a:${sourceLabel} {name: '${sourceName}'}), (b:${targetLabel} {name: '${targetName}'})
     MERGE (a)-[:${rel.relationshipKind}]->(b)`,
    graphName
  );
}

export async function clearFileVertices(filePath: string, project: string): Promise<void> {
  const escaped = escapeAGE(filePath);
  const graphName = getGraphNameForProject(project);
  // Delete edges first, then vertices for this file
  await cypherQuery(
    `MATCH (n {file_path: '${escaped}'})-[r]-() DELETE r`,
    graphName
  );
  await cypherQuery(
    `MATCH (n {file_path: '${escaped}'}) DELETE n`,
    graphName
  );
}

export async function deleteProjectGraph(project: string): Promise<number> {
  const graphName = getGraphNameForProject(project);

  // Count vertices before deletion (for reporting)
  const countRows = await cypherQuery(
    `MATCH (n) RETURN count(n)`,
    graphName
  );
  let vertexCount = 0;
  if (countRows.length > 0) {
    try {
      vertexCount = JSON.parse((countRows[0] as { result: string }).result);
    } catch {
      // Default to 0
    }
  }

  // Delete edges first (AGE doesn't support DETACH DELETE)
  await cypherQuery(
    `MATCH (n)-[r]-() DELETE r`,
    graphName
  );

  // Delete all vertices for the project
  await cypherQuery(
    `MATCH (n) DELETE n`,
    graphName
  );

  return vertexCount;
}

export async function populateGraph(nodes: CodeNode[], relationships: Relationship[], project: string): Promise<void> {
  // Insert vertices
  for (const node of nodes) {
    try {
      await addVertex(node, project);
    } catch (err) {
      // Vertex may already exist; skip
    }
  }

  // Insert edges — only if both endpoints exist
  for (const rel of relationships) {
    try {
      await addEdge(rel, project);
    } catch (err) {
      // Target may not exist (external dependency); skip
    }
  }
}

export async function upsertFileVertex(path: string, hash: string, project: string): Promise<void> {
  const escapedPath = escapeAGE(path);
  const escapedHash = escapeAGE(hash);
  const graphName = getGraphNameForProject(project);

  // AGE doesn't support MERGE ON CREATE SET, so delete + create
  try {
    await cypherQuery(
      `MATCH (f:File {path: '${escapedPath}'})-[r]-() DELETE r`,
      graphName
    );
  } catch {
    // No edges to delete
  }
  try {
    await cypherQuery(
      `MATCH (f:File {path: '${escapedPath}'}) DELETE f`,
      graphName
    );
  } catch {
    // File vertex may not exist yet
  }

  await cypherQuery(
    `CREATE (f:File {path: '${escapedPath}', hash: '${escapedHash}'})`,
    graphName
  );
}

export async function getFileHash(path: string, project: string): Promise<string | null> {
  const escaped = escapeAGE(path);
  const graphName = getGraphNameForProject(project);
  const rows = await cypherQuery(
    `MATCH (f:File {path: '${escaped}'}) RETURN f.hash`,
    graphName
  );

  if (rows.length === 0) return null;
  try {
    const row = rows[0] as { result: string };
    const parsed = JSON.parse(row.result);
    // AGE returns strings with quotes, strip them
    return typeof parsed === 'string' ? parsed : String(parsed);
  } catch {
    return null;
  }
}

export async function findNodeByName(name: string, project: string): Promise<CodeNode | null> {
  const escaped = escapeAGE(name);
  const graphName = getGraphNameForProject(project);
  const rows = await cypherQuery(
    `MATCH (n {name: '${escaped}'}) WHERE n.kind IS NOT NULL RETURN [n.name, n.file_path, n.kind, n.signature, n.start_line, n.end_line, n.body] LIMIT 1`,
    graphName
  );

  if (rows.length === 0) return null;
  try {
    const row = rows[0] as { result: string };
    const parsed = JSON.parse(row.result);
    if (Array.isArray(parsed)) {
      const [nodeName, filePath, kind, signature, startLine, endLine, body] = parsed;
      return {
        name: nodeName ?? '',
        filePath: filePath ?? '',
        kind: kind ?? 'function',
        signature: signature ?? '',
        startLine: startLine ?? 0,
        endLine: endLine ?? 0,
        body: body ?? '',
      };
    }
  } catch {
    // Skip
  }
  return null;
}

export async function findNodesByFile(filePath: string, project: string): Promise<CodeNode[]> {
  const escaped = escapeAGE(filePath);
  const graphName = getGraphNameForProject(project);
  const rows = await cypherQuery(
    `MATCH (n {file_path: '${escaped}'}) WHERE n.kind IS NOT NULL RETURN [n.name, n.file_path, n.kind, n.signature, n.start_line, n.end_line, n.body]`,
    graphName
  );

  const nodes: CodeNode[] = [];
  for (const row of rows as Array<{ result: string }>) {
    try {
      const parsed = JSON.parse(row.result);
      if (Array.isArray(parsed)) {
        const [name, fp, kind, signature, startLine, endLine, body] = parsed;
        nodes.push({
          name: name ?? '',
          filePath: fp ?? '',
          kind: kind ?? 'function',
          signature: signature ?? '',
          startLine: startLine ?? 0,
          endLine: endLine ?? 0,
          body: body ?? '',
        });
      }
    } catch {
      // Skip
    }
  }
  return nodes;
}

export async function enrichSearchResults(hits: EmbeddingHit[], project: string): Promise<Array<{ hit: EmbeddingHit; node: CodeNode | null }>> {
  const graphName = getGraphNameForProject(project);
  const results = await Promise.all(
    hits.map(async (hit) => {
      const escaped = escapeAGE(hit.name);
      const escapedPath = escapeAGE(hit.filePath);
      const rows = await cypherQuery(
        `MATCH (n {name: '${escaped}', file_path: '${escapedPath}'}) WHERE n.kind IS NOT NULL RETURN [n.name, n.file_path, n.kind, n.signature, n.start_line, n.end_line, n.body] LIMIT 1`,
        graphName
      );

      if (rows.length === 0) return { hit, node: null };
      try {
        const row = rows[0] as { result: string };
        const parsed = JSON.parse(row.result);
        if (Array.isArray(parsed)) {
          const [name, filePath, kind, signature, startLine, endLine, body] = parsed;
          return {
            hit,
            node: {
              name: name ?? '',
              filePath: filePath ?? '',
              kind: kind ?? 'function',
              signature: signature ?? '',
              startLine: startLine ?? 0,
              endLine: endLine ?? 0,
              body: body ?? '',
            } as CodeNode,
          };
        }
      } catch {
        // Skip
      }
      return { hit, node: null };
    })
  );
  return results;
}

export async function getCallStack(functionName: string, depth: number, project: string): Promise<CallStackEntry[]> {
  const escaped = escapeAGE(functionName);
  const graphName = getGraphNameForProject(project);

  // Build the call tree level-by-level. At each level, get the direct callees
  // of the current frontier, then expand the frontier for the next level.
  const nodeInfo = new Map<string, { filePath: string; kind: string }>();
  const childrenOf = new Map<string, Set<string>>();
  const visited = new Set<string>([functionName]);
  let frontier = [functionName];

  for (let d = 1; d <= depth && frontier.length > 0; d++) {
    const nextFrontier: string[] = [];

    for (const callerName of frontier) {
      const escapedCaller = escapeAGE(callerName);
      const rows = await cypherQuery(
        `MATCH (caller:Function {name: '${escapedCaller}'})-[:CALLS]->(callee:Function)
         RETURN DISTINCT [callee.name, callee.file_path, callee.kind]`,
        graphName
      );

      for (const row of rows as Array<{ result: string }>) {
        try {
          const parsed = JSON.parse(row.result);
          if (!Array.isArray(parsed)) continue;
          const [name, filePath, kind] = parsed;

          if (!nodeInfo.has(name)) {
            nodeInfo.set(name, { filePath: filePath ?? '', kind: kind ?? 'function' });
          }

          if (!childrenOf.has(callerName)) {
            childrenOf.set(callerName, new Set());
          }
          childrenOf.get(callerName)!.add(name);

          if (!visited.has(name)) {
            visited.add(name);
            nextFrontier.push(name);
          }
        } catch {
          // Skip
        }
      }
    }

    frontier = nextFrontier;
  }

  // Build tree structure from adjacency data
  function buildTree(name: string, currentDepth: number, ancestors: Set<string>): CallStackEntry[] {
    const calleeNames = childrenOf.get(name);
    if (!calleeNames || currentDepth > depth) return [];

    const result: CallStackEntry[] = [];
    for (const calleeName of calleeNames) {
      if (ancestors.has(calleeName)) continue; // Prevent cycles
      const info = nodeInfo.get(calleeName);
      if (!info) continue;
      const nextAncestors = new Set(ancestors);
      nextAncestors.add(calleeName);
      result.push({
        name: calleeName,
        filePath: info.filePath,
        kind: info.kind as CallStackEntry['kind'],
        depth: currentDepth,
        children: buildTree(calleeName, currentDepth + 1, nextAncestors),
      });
    }
    return result;
  }

  return buildTree(functionName, 1, new Set([functionName]));
}

export async function getCallers(functionName: string, project: string): Promise<CodeNode[]> {
  const escaped = escapeAGE(functionName);
  const graphName = getGraphNameForProject(project);
  const rows = await cypherQuery(
    `MATCH (caller:Function)-[:CALLS]->(target:Function {name: '${escaped}'})
     RETURN DISTINCT [caller.name, caller.file_path, caller.kind, caller.start_line, caller.end_line, caller.signature, caller.body]`,
    graphName
  );
  return parseNodeRows(rows);
}

export async function getCallees(functionName: string, project: string): Promise<CodeNode[]> {
  const escaped = escapeAGE(functionName);
  const graphName = getGraphNameForProject(project);
  const rows = await cypherQuery(
    `MATCH (source:Function {name: '${escaped}'})-[:CALLS]->(callee:Function)
     RETURN DISTINCT [callee.name, callee.file_path, callee.kind, callee.start_line, callee.end_line, callee.signature, callee.body]`,
    graphName
  );
  return parseNodeRows(rows);
}

export async function getUsedTypes(functionName: string, project: string): Promise<CodeNode[]> {
  const escaped = escapeAGE(functionName);
  const graphName = getGraphNameForProject(project);
  const rows = await cypherQuery(
    `MATCH (source:Function {name: '${escaped}'})-[:USES]->(t:Type)
     RETURN DISTINCT [t.name, t.file_path, t.kind, t.start_line, t.end_line, t.signature, t.body]`,
    graphName
  );
  return parseNodeRows(rows);
}

export async function getReverseImpact(filePath: string, project: string): Promise<Array<{ name: string; filePath: string; kind: string; relationship: string }>> {
  const escaped = escapeAGE(filePath);
  const graphName = getGraphNameForProject(project);
  const rows = await cypherQuery(
    `MATCH (external)-[r]->(target {file_path: '${escaped}'})
     WHERE external.file_path <> '${escaped}'
     RETURN [external.name, external.file_path, external.kind, type(r)]`,
    graphName
  );

  const results: Array<{ name: string; filePath: string; kind: string; relationship: string }> = [];
  for (const row of rows as Array<{ result: string }>) {
    try {
      const parsed = JSON.parse(row.result);
      if (Array.isArray(parsed)) {
        const [name, fp, kind, relType] = parsed;
        results.push({
          name: name ?? '',
          filePath: fp ?? '',
          kind: kind ?? 'function',
          relationship: relType ?? 'CALLS',
        });
      }
    } catch {
      // Skip
    }
  }
  return results;
}

export async function listGraphProjects(): Promise<string[]> {
  // Import from schema to avoid circular dependencies
  const { listProjectGraphs } = await import('../db/schema.js');
  return listProjectGraphs();
}

function parseNodeRows(rows: unknown[]): CodeNode[] {
  const nodes: CodeNode[] = [];
  for (const row of rows as Array<{ result: string }>) {
    try {
      const parsed = JSON.parse(row.result);
      if (Array.isArray(parsed)) {
        const [name, filePath, kind, startLine, endLine, signature, body] = parsed;
        nodes.push({
          name: name ?? '',
          filePath: filePath ?? '',
          kind: kind ?? 'function',
          signature: signature ?? '',
          startLine: startLine ?? 0,
          endLine: endLine ?? 0,
          body: body ?? '',
        });
      }
    } catch {
      // Skip
    }
  }
  return nodes;
}

// Blocked keywords for read-only query validation
const WRITE_KEYWORDS = ['CREATE', 'DELETE', 'SET', 'REMOVE', 'MERGE', 'DROP'];

function isReadOnlyQuery(query: string): boolean {
  const upperQuery = query.toUpperCase();
  for (const keyword of WRITE_KEYWORDS) {
    // Match whole words only to avoid false positives (e.g., "CREATED_AT" matching "CREATE")
    const regex = new RegExp(`\\b${keyword}\\b`);
    if (regex.test(upperQuery)) {
      return false;
    }
  }
  return true;
}

export async function runRawCypher(
  query: string,
  project: string
): Promise<{ rows: unknown[]; rowCount: number }> {
  // Validate query is read-only
  if (!isReadOnlyQuery(query)) {
    throw new Error('Query contains write operations (CREATE, DELETE, SET, REMOVE, MERGE, DROP). Only read-only queries are allowed.');
  }

  const graphName = getGraphNameForProject(project);
  const rows = await cypherQuery(query, graphName);

  // Parse AGE agtype results to JSON
  const parsedRows: unknown[] = [];
  for (const row of rows as Array<{ result: string }>) {
    try {
      const parsed = JSON.parse(row.result);
      parsedRows.push(parsed);
    } catch {
      // Return raw value if parsing fails
      parsedRows.push(row.result);
    }
  }

  return {
    rows: parsedRows,
    rowCount: parsedRows.length,
  };
}
