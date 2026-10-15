import { AsyncLocalStorage } from "node:async_hooks";
// Next's own request storage, the same way src/server/request-clock.ts reads the visitor's clock: `db` is a synchronous import used in hundreds of
// places, so it cannot await cookies().
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external";

import { SANDBOX_COOKIE, assertSandboxSchemaName } from "@/lib/sandbox";
import { sandboxesEnabled } from "@/server/sandbox-config";
import { verifySandboxCookie } from "@/server/sandbox-cookie";

// Shared through globalThis: a server may load this file once per bundle, and every copy must see the same override.
const globals = globalThis as { __corvaneSandbox?: AsyncLocalStorage<string> };
const forcedStorage = (globals.__corvaneSandbox ??= new AsyncLocalStorage<string>());

/** Runs `fn` with `db` pointing at one sandbox, whatever request (or none) this is. For the routes that act on a sandbox they just made, and for tests. */
export function runInSandbox<T>(schema: string, fn: () => Promise<T>): Promise<T> {
  return forcedStorage.run(assertSandboxSchemaName(schema), fn);
}

/**
 * The sandbox schema of the current request: the one in its signed ch_sandbox cookie, or undefined for the public schema (sandboxes off, no request,
 * no cookie, a cookie we did not sign, or a visitor on the shared demo).
 */
export function currentSandboxSchema(): string | undefined {
  if (!sandboxesEnabled()) return undefined;
  const forced = forcedStorage.getStore();
  if (forced) return forced;
  const store = workUnitAsyncStorage.getStore();
  if (!store || store.type !== "request") return undefined;
  return verifySandboxCookie(store.cookies.get(SANDBOX_COOKIE)?.value);
}
