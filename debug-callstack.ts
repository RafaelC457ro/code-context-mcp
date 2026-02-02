import { getPool } from './src/db/connection.js';

async function main() {
  const pool = getPool();
  await pool.query(`LOAD 'age';`);
  await pool.query(`SET search_path = ag_catalog, "$user", public;`);

  // Test: what does the variable-length path query return?
  const res = await pool.query(`
    SELECT * FROM cypher('code_graph', $$
      MATCH path = (start:Function {name: 'client_handler', project: 'key-value-memory-db'})-[:CALLS*1..3]->(callee:Function)
      RETURN [callee.name, callee.file_path, callee.kind, length(path)]
    $$) AS (result agtype);
  `);
  console.log('Variable-length path results:');
  for (const row of res.rows) {
    console.log('  ', JSON.parse(row.result));
  }

  // Test: can we get relationships() from path to see each hop?
  try {
    const res2 = await pool.query(`
      SELECT * FROM cypher('code_graph', $$
        MATCH path = (start:Function {name: 'client_handler', project: 'key-value-memory-db'})-[:CALLS*1..3]->(callee:Function)
        WITH nodes(path) AS ns
        UNWIND ns AS n
        RETURN [n.name, n.file_path]
      $$) AS (result agtype);
    `);
    console.log('\nnodes(path) results:');
    for (const row of res2.rows) {
      console.log('  ', JSON.parse(row.result));
    }
  } catch(e: any) {
    console.log('\nnodes(path) failed:', e.message);
  }

  // Alternative: get caller-callee pairs at each depth
  try {
    const res3 = await pool.query(`
      SELECT * FROM cypher('code_graph', $$
        MATCH (caller:Function {project: 'key-value-memory-db'})-[:CALLS]->(callee:Function {project: 'key-value-memory-db'})
        WHERE caller.name = 'client_handler' OR caller.name = 'comand_handler' OR caller.name = 'read_client' OR caller.name = 'send_client' OR caller.name = 'close_client'
        RETURN [caller.name, callee.name, callee.file_path]
      $$) AS (result agtype);
    `);
    console.log('\nDirect caller->callee pairs:');
    for (const row of res3.rows) {
      console.log('  ', JSON.parse(row.result));
    }
  } catch(e: any) {
    console.log('\nDirect pairs failed:', e.message);
  }

  await pool.end();
}

main().catch(console.error);
