import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "../../src");

/** Files allowed to call Prisma's raw SQL without the helper, with the reason. */
const ALLOWED: Record<string, string> = {
  "src/server/sql.ts": "the helper itself",
  "src/server/demo-reset.ts": "the public-schema restore on the admin client (the shared demo and `npm run demo:reset-data`), never a visitor's sandbox",
};

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [join(dir, e.name)] : []));
}

const RAW = /(\w+)\.\$(queryRaw|executeRaw)(Unsafe)?\b/g;

describe("raw SQL goes through withSearchPath", () => {
  it("finds every raw call, and each one is made on the `tx` the helper hands out", () => {
    const offenders: string[] = [];
    let found = 0;
    for (const file of files(SRC)) {
      const rel = relative(join(SRC, ".."), file);
      if (ALLOWED[rel]) continue;
      const text = readFileSync(file, "utf-8");
      for (const m of text.matchAll(RAW)) {
        found += 1;
        const line = text.slice(0, m.index).split("\n").length;
        if (m[1] !== "tx") offenders.push(`${rel}:${line} calls ${m[0]} (use withSearchPath(db, (tx) => tx.$queryRaw...))`);
        else if (!/withSearchPath\(/.test(text)) offenders.push(`${rel}:${line} calls ${m[0]} in a file that never uses withSearchPath`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
    expect(found, "the guard found no raw calls at all: its pattern is broken").toBeGreaterThanOrEqual(3);
  });

  it("is not fooled by a call on `db`", () => {
    const sample = "await db.$queryRaw`SELECT 1`; await client.$executeRawUnsafe('x');";
    expect([...sample.matchAll(RAW)].map((m) => m[1])).toEqual(["db", "client"]);
  });

  it("lists only files that still exist", () => {
    for (const rel of Object.keys(ALLOWED)) expect(() => readFileSync(join(SRC, "..", rel))).not.toThrow();
  });
});
