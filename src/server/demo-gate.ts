import { cookies } from "next/headers";

import { visitorClockEnabled } from "@/lib/dates";
import { SANDBOX_COOKIE, SHARED_MARKER } from "@/lib/sandbox";
import { parseArrival, VISITOR_CLOCK_COOKIE } from "@/lib/visitor-clock";
import { runtimePool } from "@/server/db";
import { idleRestoreEnabled, needsPreparing, readDemoState } from "@/server/demo-idle";
import { sandboxUsable, type SandboxRow } from "@/server/sandbox";
import { sandboxesEnabled } from "@/server/sandbox-config";
import { verifySandboxCookie } from "@/server/sandbox-cookie";

export interface DemoGate {
  /** What the "Preparing a fresh demo..." screen has to do before the app renders, or null when the app can render. */
  preparing: "sandbox" | "shared" | null;
  /** The visitor is on the shared demo because a sandbox could not be made: the demo bar says so. */
  shared: boolean;
  /** The visitor has (or is about to get) a private copy: the demo bar offers Start over. */
  sandbox: boolean;
}

/** The registry row of one sandbox, read on the runtime connection. Null when there is none. */
async function readSandboxRow(schema: string): Promise<SandboxRow | undefined> {
  const res = await runtimePool().query(
    `SELECT "schemaName", "status", "expiresAt", "ddlHash", "snapshotHash" FROM public."DemoSandbox" WHERE "schemaName" = $1`,
    [schema],
  );
  return res.rows[0] as SandboxRow | undefined;
}

/** The shared demo's idle rule: a restore is due or running, or the visitor arrived before the last restore. */
async function sharedNeedsPreparing(arrivalMs: number | undefined): Promise<boolean> {
  try {
    const state = await readDemoState();
    return state ? needsPreparing(state, arrivalMs) : false;
  } catch (err) {
    console.error("[demo-idle] could not read the demo state", err);
    return false;
  }
}

/**
 * What a page request has to do before it renders. Read before anything else touches the database. A failure here (for example a migration not applied
 * yet) must not take the site down, so it answers "render as before".
 *
 * With sandboxes on, a visitor needs a valid pair of cookies: ch_sandbox (signed) and ch_arrival, and a registry row that is assigned, current and
 * expires 24 h after that arrival. Anything else sends them to the Preparing screen, which makes or claims a sandbox and sets both cookies together.
 * A visitor on the shared fallback (ch_sandbox = "shared") gets the shared demo's idle rule, as before.
 */
export async function demoGate(): Promise<DemoGate> {
  const sandboxes = sandboxesEnabled();
  if (!sandboxes && !idleRestoreEnabled()) return { preparing: null, shared: false, sandbox: false };
  // Outside the try: during a build, cookies() throws Next's "dynamic usage" signal, which must reach Next, not be swallowed here.
  const jar = await cookies();
  const clock = visitorClockEnabled();
  const arrival = clock ? parseArrival(jar.get(VISITOR_CLOCK_COOKIE)?.value, Date.now()) : undefined;
  const raw = jar.get(SANDBOX_COOKIE)?.value;

  if (!sandboxes || raw === SHARED_MARKER) {
    const preparing = idleRestoreEnabled() && (await sharedNeedsPreparing(arrival)) ? "shared" : null;
    return { preparing, shared: sandboxes, sandbox: false };
  }

  const schema = verifySandboxCookie(raw);
  if (!schema || (clock && arrival === undefined)) return { preparing: "sandbox", shared: false, sandbox: true };
  try {
    return { preparing: sandboxUsable(await readSandboxRow(schema), clock ? arrival : undefined) ? null : "sandbox", shared: false, sandbox: true };
  } catch (err) {
    console.error("[sandbox] could not read the registry", err);
    return { preparing: "sandbox", shared: false, sandbox: true };
  }
}
