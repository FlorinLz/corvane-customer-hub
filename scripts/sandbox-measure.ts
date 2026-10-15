import "dotenv/config";

import { Pool } from "pg";

// `npm run sandbox:measure`: makes one sandbox schema on DATABASE_ADMIN_URL, prints how long each phase took and how big it is, then drops it.
// It never reads or writes the public schema and does not use the registry. Refuses to run without DATABASE_ADMIN_URL.
async function main() {
  const url = process.env.DATABASE_ADMIN_URL;
  if (!url) {
    console.error("DATABASE_ADMIN_URL is not set. sandbox:measure makes a schema with the owner role, so it needs the admin URL.");
    process.exit(1);
  }
  const { buildSandboxSchema, newSchemaName } = await import("../src/server/sandbox");
  const host = new URL(url).host;
  console.log(`Measuring on ${host}`);

  const pool = new Pool({ connectionString: url, max: 1 });
  const schema = newSchemaName();
  try {
    const client = await pool.connect();
    let phases;
    try {
      await client.query("BEGIN");
      phases = await buildSandboxSchema(client, schema);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
    const fmt = (ms: number) => `${(ms / 1000).toFixed(2)} s`;
    console.log(`schema     ${fmt(phases.schemaMs)}`);
    console.log(`DDL        ${fmt(phases.ddlMs)}`);
    console.log(`snapshot   ${fmt(phases.snapshotMs)}`);
    console.log(`grants     ${fmt(phases.grantsMs)}`);
    console.log(`total      ${fmt(phases.totalMs)}`);

    const size = await pool.query(
      `SELECT coalesce(sum(pg_total_relation_size(c.oid)), 0)::bigint AS bytes, count(*)::int AS tables
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relkind = 'r'`,
      [schema],
    );
    const db = await pool.query("SELECT pg_database_size(current_database())::bigint AS bytes");
    const mb = (bytes: string) => (Number(bytes) / 1024 / 1024).toFixed(2);
    console.log(`schema size    ${mb(size.rows[0].bytes)} MB over ${size.rows[0].tables} tables (sum of pg_total_relation_size: tables, indexes, TOAST)`);
    console.log(`database total ${mb(db.rows[0].bytes)} MB (including this sandbox)`);
    const perSandbox = Number(size.rows[0].bytes) / 1024 / 1024;
    console.log(`at 800 MB: ${Math.floor(800 / perSandbox)} sandboxes of this size would fit if the rest of the database were empty`);
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch((err) => console.error("could not drop the measuring schema", schema, err));
    await pool.end();
    console.log(`Dropped ${schema}.`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
