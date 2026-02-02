import { getPool } from './src/db/connection.js';

async function main() {
  const pool = getPool();
  await pool.query(`LOAD 'age';`);
  await pool.query(`SET search_path = ag_catalog, "$user", public;`);

  // Step 1: Get reachable nodes
  const res1 = await pool.query(`
    SELECT * FROM cypher('code_graph', $$
      MATCH path = (start:Function {name: 'client_handler', project: 'key-value-memory-db'})-[:CALLS*1..3]->(callee:Function)
      RETURN DISTINCT [callee.name, callee.file_path, callee.kind]
    $$) AS (result agtype);
  `);
  console.log('Reachable nodes:');
  const reachable = new Set<string>(['client_handler']);
  for (const row of res1.rows) {
    const parsed = JSON.parse(row.result);
    console.log('  ', parsed);
    reachable.add(parsed[0]);
  }
  console.log('\nReachable set:', [...reachable]);

  // Step 2: Get edges from comand_handler
  const res2 = await pool.query(`
    SELECT * FROM cypher('code_graph', $$
      MATCH (caller:Function {name: 'comand_handler', project: 'key-value-memory-db'})-[:CALLS]->(callee:Function)
      RETURN DISTINCT callee.name
    $$) AS (result agtype);
  `);
  console.log('\nEdges from comand_handler:');
  for (const row of res2.rows) {
    const parsed = JSON.parse(row.result);
    console.log('  ', parsed, 'in reachable?', reachable.has(typeof parsed === 'string' ? parsed : String(parsed)));
  }

  await pool.end();
}

main().catch(console.error);
