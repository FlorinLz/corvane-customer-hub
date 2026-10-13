import pg from "pg";

/**
 * Simulates a database that is far away (Neon from Vercel): every SQL statement the pg driver sends waits
 * `ms` first. Installed on `pg.Client.prototype.query`, so it covers every Prisma query, including the ones
 * inside interactive transactions (the adapter sends BEGIN, each statement and COMMIT through it).
 * Also records, per transaction, how many statements ran between BEGIN and COMMIT and how long that took.
 * Only for tests that ask for it: call `uninstall()` when done.
 */
export interface TransactionStat {
  statements: number;
  durationMs: number;
  committed: boolean;
}

export function installQueryLatency(ms: number) {
  const proto = pg.Client.prototype as unknown as { query: (...args: unknown[]) => unknown };
  const original = proto.query;
  const open = new Map<object, { statements: number; startedAt: number }>();
  const transactions: TransactionStat[] = [];
  let total = 0;

  proto.query = function patched(this: object, ...args: unknown[]) {
    const first = args[0];
    const text = (typeof first === "string" ? first : (first as { text?: string } | undefined)?.text ?? "").trim().toUpperCase();
    total++;
    if (text.startsWith("BEGIN")) open.set(this, { statements: 0, startedAt: Date.now() });
    else if (open.has(this) && !text.startsWith("COMMIT") && !text.startsWith("ROLLBACK")) open.get(this)!.statements++;
    const finish = (committed: boolean) => {
      const tx = open.get(this);
      if (tx) {
        transactions.push({ statements: tx.statements, durationMs: Date.now() - tx.startedAt, committed });
        open.delete(this);
      }
    };
    const isEnd = text.startsWith("COMMIT") || text.startsWith("ROLLBACK");
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        Promise.resolve((original as (...a: unknown[]) => unknown).apply(this, args)).then(
          (r) => {
            if (isEnd) finish(text.startsWith("COMMIT"));
            resolve(r);
          },
          (e) => {
            if (isEnd) finish(false);
            reject(e);
          },
        );
      }, ms);
    });
  };

  return {
    transactions,
    totalStatements: () => total,
    /** The longest transaction recorded since the last reset (the one a request is waiting on). */
    biggest: () => transactions.reduce<TransactionStat | null>((m, t) => (m === null || t.statements > m.statements ? t : m), null),
    reset: () => {
      transactions.length = 0;
      total = 0;
    },
    uninstall: () => {
      proto.query = original;
    },
  };
}
