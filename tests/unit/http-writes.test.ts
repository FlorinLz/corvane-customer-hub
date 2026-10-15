import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const recordDataWrite = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/server/demo-idle", () => ({ recordDataWrite }));

import { handle } from "@/server/http";
import { NotFoundError } from "@/server/errors";

const req = (method: string) => new Request("http://localhost/api/x", { method });

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "true");
  recordDataWrite.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("handle() records data writes for the idle restore", () => {
  it("records after a successful POST, PUT, PATCH and DELETE", async () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) await handle("t", async (r: Request) => ({ method: r.method }))(req(method));
    expect(recordDataWrite).toHaveBeenCalledTimes(4);
  });

  it("does not record reads", async () => {
    await handle("t", async (r: Request) => ({ method: r.method }))(req("GET"));
    expect(recordDataWrite).not.toHaveBeenCalled();
  });

  it("does not record a write that failed", async () => {
    const res = await handle("t", async (r: Request) => {
      void r;
      throw new NotFoundError();
    })(req("POST"));
    expect(res.status).toBe(404);
    expect(recordDataWrite).not.toHaveBeenCalled();
  });

  it("does not record a handler that says it writes nothing", async () => {
    await handle("t", async (r: Request) => ({ method: r.method }), { writes: false })(req("POST"));
    expect(recordDataWrite).not.toHaveBeenCalled();
  });

  it("does nothing outside the demo", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    await handle("t", async (r: Request) => ({ method: r.method }))(req("POST"));
    expect(recordDataWrite).not.toHaveBeenCalled();
  });
});

describe("which routes are exempt from counting as writes", () => {
  function routeFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? routeFiles(join(dir, e.name)) : e.name === "route.ts" ? [join(dir, e.name)] : []));
  }

  it("only the seven POST routes that read, set a cookie, or restore a sandbox (which has no idle clock) opt out", () => {
    const optedOut = routeFiles("src/app/api")
      .filter((f) => /writes:\s*false/.test(readFileSync(f, "utf-8")))
      .map((f) => f.replace("src/app/api/", ""))
      .sort();
    expect(optedOut).toEqual(["demo/prepare/route.ts", "demo/sandbox/route.ts", "demo/start-over/route.ts", "demo/view-as/route.ts", "duplicates/check/route.ts", "entities/[id]/issues/similar/route.ts", "gleif/lookup/route.ts"]);
  });
});
