import snapshotData from "../../data/demo-snapshot.js";

/**
 * The demo data as a generated snapshot (data/demo-snapshot.js, `npm run demo:snapshot`): every row of
 * every data table, taken right after the seed ran at the default demo clock with GLEIF_SEED_SOURCE=cache.
 * Restoring it is one transaction of a handful of statements instead of ~2000 round trips, which is what
 * brings the restore under 5 s from a function a network hop away from the database.
 *
 * tests/unit/demo-snapshot.test.ts fails when anything the seed reads has changed since the snapshot was
 * written (`inputHash`), and when a restore does not produce the same row counts as a fresh seed.
 */
export interface DemoSnapshot {
  version: 1;
  /** The clock the seed ran at: `today()` then, in APP_TIMEZONE. The snapshot is only valid for a restore on that day. */
  seedToday: string;
  /** sha256 over the seed, the schema and every module the seed imports (scripts/demo-snapshot-lib.ts). */
  inputHash: string;
  /** Insert order: parents before children. */
  tables: { name: string; rows: Record<string, unknown>[] }[];
  /** `issue_number_seq` position after the seed (the next number to hand out). */
  issueNumberNext: number;
}

export const demoSnapshot = snapshotData as DemoSnapshot;

/** A dollar-quote tag that does not occur in `text`, so the JSON can be embedded without escaping. */
function quoteTag(text: string): string {
  for (let i = 0; ; i++) {
    const tag = `$snap${i}$`;
    if (!text.includes(tag)) return tag;
  }
}

/**
 * TRUNCATE ... RESTART IDENTITY puts every serial/identity sequence back at 1, and the snapshot inserts rows with their ids, which does not move
 * them. Without this the next insert (AuditEntry.id is the one autoincrement column) collides with a restored row. It moves each such sequence past
 * the largest id in the current schema (the first schema of the search_path: public, or the visitor's sandbox).
 */
const ADVANCE_SERIAL_COLUMNS = `DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl, a.attname AS col, pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) AS seq
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema() AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
      AND pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) IS NOT NULL
  LOOP
    EXECUTE format('SELECT setval(%L, coalesce((SELECT max(%I) FROM %I), 0) + 1, false)', r.seq, r.col, r.tbl);
  END LOOP;
END $$`;

/**
 * The statements that replace the data with the snapshot, to run inside a transaction that already holds the
 * restore lock. No parameters, so the whole thing goes to the server as one simple query (one round trip).
 * Each table is one INSERT ... SELECT from its rows as JSON: the server converts text to enums, dates and
 * arrays by column name.
 */
export function buildRestoreSql(snapshot: DemoSnapshot): string {
  const names = snapshot.tables.map((t) => `"${t.name}"`).join(", ");
  const statements = [`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`];
  for (const table of snapshot.tables) {
    if (table.rows.length === 0) continue;
    const json = JSON.stringify(table.rows);
    const tag = quoteTag(json);
    statements.push(`INSERT INTO "${table.name}" SELECT * FROM jsonb_populate_recordset(null::"${table.name}", ${tag}${json}${tag}::jsonb)`);
  }
  statements.push(ADVANCE_SERIAL_COLUMNS);
  statements.push(`SELECT setval('issue_number_seq', ${snapshot.issueNumberNext}, false)`);
  return statements.join(";\n");
}
