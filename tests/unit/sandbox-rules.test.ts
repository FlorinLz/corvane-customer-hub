import { describe, expect, it } from "vitest";

import { LruCache } from "@/lib/lru";
import {
  SANDBOX_LIFETIME_MS,
  assertSandboxSchemaName,
  grantsForSandbox,
  isSandboxSchemaName,
  sandboxExpired,
  sandboxExpiresAtMs,
  sandboxSearchPath,
} from "@/lib/sandbox";
import { parseArrival } from "@/lib/visitor-clock";
import { DDL_HASH, SNAPSHOT_HASH, newSchemaName, sandboxUsable, type SandboxRow } from "@/server/sandbox";
import { DEFAULT_SANDBOX_MAX, sandboxClientCacheSize, sandboxMax, sandboxSpares, sandboxesEnabled } from "@/server/sandbox-config";
import { signSandboxCookie, verifySandboxCookie } from "@/server/sandbox-cookie";

const GOOD = "sbx_0123456789abcdef";

describe("schema names", () => {
  it("accepts sbx_ plus 16 lower-case hex characters and nothing else", () => {
    expect(isSandboxSchemaName(GOOD)).toBe(true);
    for (const bad of [
      "public",
      "sbx_0123456789abcde", // 15
      "sbx_0123456789abcdef0", // 17
      "sbx_0123456789ABCDEF", // upper case
      "sbx_0123456789abcdeg",
      "SBX_0123456789abcdef",
      " sbx_0123456789abcdef",
      "sbx_0123456789abcdef\n",
      'sbx_0123456789abcdef"; DROP SCHEMA public; --',
      "sbx_0123456789abcdef; DROP",
      "",
      undefined,
      null,
      42,
    ]) {
      expect(isSandboxSchemaName(bad), String(bad)).toBe(false);
      expect(() => assertSandboxSchemaName(bad)).toThrow("Invalid sandbox schema name");
    }
  });

  it("makes names that pass the check, and different ones each time", () => {
    const names = new Set(Array.from({ length: 200 }, () => newSchemaName()));
    expect(names.size).toBe(200);
    for (const n of names) expect(isSandboxSchemaName(n)).toBe(true);
  });

  it("refuses an invalid name before it reaches the search_path or the grants", () => {
    expect(sandboxSearchPath(GOOD)).toBe(`${GOOD}, public`);
    expect(() => sandboxSearchPath("public")).toThrow();
    expect(() => grantsForSandbox("GRANT USAGE ON SCHEMA public TO hub_app;", 'x"; --')).toThrow();
  });
});

describe("grantsForSandbox", () => {
  it("points the schema-level grants at the sandbox and leaves the rest alone", () => {
    const out = grantsForSandbox(
      [
        "GRANT USAGE ON SCHEMA public TO hub_app;",
        "GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO hub_app;",
        "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hub_app;",
        'REVOKE UPDATE ON "AuditEntry" FROM hub_app;',
      ].join("\n"),
      GOOD,
    );
    expect(out).toContain(`GRANT USAGE ON SCHEMA "${GOOD}" TO hub_app;`);
    expect(out).toContain(`ON ALL TABLES IN SCHEMA "${GOOD}" TO hub_app;`);
    expect(out).toContain(`ON ALL SEQUENCES IN SCHEMA "${GOOD}" TO hub_app;`);
    expect(out).toContain('REVOKE UPDATE ON "AuditEntry" FROM hub_app;');
    expect(out).not.toMatch(/SCHEMA public/);
  });
});

describe("the sandbox cookie", () => {
  const key = "k".repeat(40);

  it("round-trips a signed schema name", () => {
    expect(verifySandboxCookie(signSandboxCookie(GOOD, key), key)).toBe(GOOD);
  });

  it("rejects a changed name, a changed signature, another key, and junk", () => {
    const value = signSandboxCookie(GOOD, key);
    const other = "sbx_fedcba9876543210";
    expect(verifySandboxCookie(value.replace(GOOD, other), key)).toBeUndefined();
    expect(verifySandboxCookie(`${value.slice(0, -1)}${value.endsWith("0") ? "1" : "0"}`, key)).toBeUndefined();
    expect(verifySandboxCookie(value, "z".repeat(40))).toBeUndefined();
    for (const junk of [undefined, "", "shared", GOOD, `${GOOD}.`, `${GOOD}.zz`, `public.${"0".repeat(64)}`, `.${"0".repeat(64)}`]) {
      expect(verifySandboxCookie(junk, key), String(junk)).toBeUndefined();
    }
  });

  it("will not sign an invalid name", () => {
    expect(() => signSandboxCookie("public", key)).toThrow();
  });
});

describe("sandbox expiry is tied to the arrival", () => {
  const arrival = Date.UTC(2026, 9, 5, 8, 0, 0);

  it("expires 24 hours after the arrival", () => {
    expect(sandboxExpiresAtMs(arrival)).toBe(arrival + 24 * 3600_000);
    expect(SANDBOX_LIFETIME_MS).toBe(24 * 3600_000);
    expect(sandboxExpired(arrival + SANDBOX_LIFETIME_MS, arrival + SANDBOX_LIFETIME_MS - 1)).toBe(false);
    expect(sandboxExpired(arrival + SANDBOX_LIFETIME_MS, arrival + SANDBOX_LIFETIME_MS)).toBe(true);
  });

  it("lasts exactly as long as the arrival cookie is credible", () => {
    // parseArrival allows the cookie lifetime plus an hour of slack; the sandbox itself never outlives its 24 hours.
    expect(parseArrival(String(arrival), arrival + 23 * 3600_000)).toBe(arrival);
    expect(sandboxExpired(sandboxExpiresAtMs(arrival), arrival + 23 * 3600_000)).toBe(false);
    expect(sandboxExpired(sandboxExpiresAtMs(arrival), arrival + 25 * 3600_000)).toBe(true);
  });

  const row = (over: Partial<SandboxRow> = {}): SandboxRow => ({
    schemaName: GOOD,
    status: "ASSIGNED",
    expiresAt: new Date(sandboxExpiresAtMs(arrival)),
    ddlHash: DDL_HASH,
    snapshotHash: SNAPSHOT_HASH,
    ...over,
  });

  it("is usable when assigned, current and expiring 24 h after this arrival", () => {
    expect(sandboxUsable(row(), arrival, arrival + 3600_000)).toBe(true);
    expect(sandboxUsable(row(), undefined, arrival + 3600_000)).toBe(true); // demo clock off: no arrival to compare
  });

  it("is not usable when gone, a spare, expired, out of date, or from another arrival", () => {
    const now = arrival + 3600_000;
    expect(sandboxUsable(undefined, arrival, now)).toBe(false);
    expect(sandboxUsable(row({ status: "SPARE" }), arrival, now)).toBe(false);
    expect(sandboxUsable(row(), arrival, arrival + SANDBOX_LIFETIME_MS)).toBe(false);
    expect(sandboxUsable(row({ ddlHash: "old" }), arrival, now)).toBe(false);
    expect(sandboxUsable(row({ snapshotHash: "old" }), arrival, now)).toBe(false);
    expect(sandboxUsable(row(), arrival + 60_000, now)).toBe(false); // a newer ch_arrival than the sandbox was made for
  });
});

describe("LruCache", () => {
  it("keeps the most recently used entries and reports what it drops", () => {
    const evicted: string[] = [];
    const cache = new LruCache<string, number>(2, (k) => evicted.push(k));
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1); // a is now the newest
    cache.set("c", 3); // drops b
    expect(evicted).toEqual(["b"]);
    expect(cache.has("b")).toBe(false);
    expect(cache.keys()).toEqual(["a", "c"]);
    cache.set("a", 10); // replacing refreshes, drops nothing
    expect(evicted).toEqual(["b"]);
    cache.set("d", 4); // drops c
    expect(evicted).toEqual(["b", "c"]);
    expect(cache.size).toBe(2);
    expect(cache.get("zzz")).toBeUndefined();
  });

  it("needs a size of at least one", () => {
    expect(() => new LruCache(0)).toThrow();
  });
});

describe("sandbox settings", () => {
  it("are off unless DEMO_SANDBOXES=true in demo mode with the admin URL", () => {
    const on = { DEMO_MODE: "true", DEMO_SANDBOXES: "true", DATABASE_ADMIN_URL: "postgres://x" };
    expect(sandboxesEnabled(on)).toBe(true);
    expect(sandboxesEnabled({ ...on, DEMO_SANDBOXES: undefined })).toBe(false);
    expect(sandboxesEnabled({ ...on, DEMO_MODE: "false" })).toBe(false);
    expect(sandboxesEnabled({ ...on, DATABASE_ADMIN_URL: "" })).toBe(false);
  });

  it("have the documented defaults", () => {
    const none = {};
    expect(sandboxSpares(none)).toBe(2);
    expect(sandboxMax(none)).toBe(DEFAULT_SANDBOX_MAX);
    expect(sandboxClientCacheSize(none)).toBe(20);
    expect(sandboxSpares({ DEMO_SANDBOX_SPARES: "0" })).toBe(0);
    expect(sandboxMax({ DEMO_SANDBOX_MAX: "7" })).toBe(7);
    expect(sandboxMax({ DEMO_SANDBOX_MAX: "abc" })).toBe(DEFAULT_SANDBOX_MAX);
  });
});
