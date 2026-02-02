import { getPool } from './src/db/connection.js';

async function main() {
  const pool = getPool();
  await pool.query(`LOAD 'age';`);
  await pool.query(`SET search_path = ag_catalog, "$user", public;`);

  const res = await pool.query(`
    SELECT * FROM cypher('code_graph', $$
      MATCH (caller:Function {name: 'comand_handler', project: 'key-value-memory-db'})-[:CALLS]->(callee:Function)
      RETURN DISTINCT callee.name
    $$) AS (result agtype);
  `);
  console.log('Raw rows:');
  for (const row of res.rows) {
    console.log('  raw result:', JSON.stringify(row.result));
    const parsed = JSON.parse(row.result);
    console.log('  parsed:', parsed, 'type:', typeof parsed);
  }

  await pool.end();
}

main().catch(console.error);
