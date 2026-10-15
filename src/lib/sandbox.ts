/**
 * Pure rules of the per-visitor sandbox (one Postgres schema per visitor, src/server/sandbox.ts). No I/O here, so the browser and the tests can import it.
 */

/** Cookie holding the signed sandbox schema name, or SHARED_MARKER when the visitor uses the shared demo. Set together with ch_arrival. */
export const SANDBOX_COOKIE = "ch_sandbox";
/** The value of ch_sandbox for a visitor on the shared demo (a sandbox could not be made). Short-lived, so the next visit tries again. */
export const SHARED_MARKER = "shared";
export const SHARED_MARKER_MAX_AGE_SECONDS = 5 * 60;

/** A sandbox lives 24 h from the visitor's arrival, the same as the clock cookie (src/lib/visitor-clock.ts). */
export const SANDBOX_LIFETIME_MS = 24 * 60 * 60 * 1000;

const SCHEMA_NAME = /^sbx_[0-9a-f]{16}$/;

/** Whether `name` is a sandbox schema name: `sbx_` plus 16 lower-case hex characters. The only check between a name and SQL text. */
export function isSandboxSchemaName(name: unknown): name is string {
  return typeof name === "string" && SCHEMA_NAME.test(name);
}

/** Throws unless `name` is a valid sandbox schema name; returns it. Call this before a name is put into SQL text. */
export function assertSandboxSchemaName(name: unknown): string {
  if (!isSandboxSchemaName(name)) throw new Error("Invalid sandbox schema name");
  return name;
}

/** The instant a sandbox whose visitor arrived at `arrivalMs` expires. */
export function sandboxExpiresAtMs(arrivalMs: number): number {
  return arrivalMs + SANDBOX_LIFETIME_MS;
}

/** Whether a sandbox that expires at `expiresAtMs` is expired at `nowMs`. */
export function sandboxExpired(expiresAtMs: number, nowMs: number): boolean {
  return expiresAtMs <= nowMs;
}

/** The search_path every statement on a sandbox runs with: the sandbox first, so its tables win; public second, for the pg_trgm operators. */
export function sandboxSearchPath(schema: string): string {
  return `${assertSandboxSchemaName(schema)}, public`;
}

/** The grants file rewritten for one sandbox: every mention of the public schema becomes the sandbox, and nothing else changes. */
export function grantsForSandbox(grantsSql: string, schema: string): string {
  return grantsSql.replace(/\b(ON|IN) SCHEMA public\b/g, `$1 SCHEMA "${assertSandboxSchemaName(schema)}"`);
}
