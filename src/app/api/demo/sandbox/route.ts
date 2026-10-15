import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";

import { visitorClockEnabled } from "@/lib/dates";
import { SANDBOX_COOKIE, SANDBOX_LIFETIME_MS, SHARED_MARKER, SHARED_MARKER_MAX_AGE_SECONDS } from "@/lib/sandbox";
import { VISITOR_CLOCK_COOKIE, VISITOR_CLOCK_MAX_AGE_SECONDS } from "@/lib/visitor-clock";
import { NotFoundError } from "@/server/errors";
import { handle } from "@/server/http";
import { acquireSandbox, sandboxHousekeeping } from "@/server/sandbox";
import { sandboxesEnabled } from "@/server/sandbox-config";
import { signSandboxCookie } from "@/server/sandbox-cookie";

export const maxDuration = 300;

/** The cookie on a request that makes the sandbox creation fail, for the e2e test of the shared fallback. Honoured only with DEMO_SANDBOX_TEST_HOOKS=true. */
const FORCE_FAIL_COOKIE = "ch_test_sandbox_fail";

// Called by the "Preparing a fresh demo..." screen of a visitor who has no valid sandbox. Claims a spare or makes a sandbox, then sets ch_sandbox and a new
// ch_arrival together, so the data and the clock start together. When that fails (an error, or the cap) the visitor gets the shared demo for a few minutes
// and the reason is logged. Open to every visitor and takes no input: the schema name is made on the server.
export const POST = handle("demo.sandbox", async (req: Request) => {
  if (!sandboxesEnabled()) throw new NotFoundError();
  const secure = new URL(req.url).protocol === "https:";
  const arrival = Date.now();
  const response = NextResponse.json({ ok: true, data: {} });

  let schema: string | undefined;
  try {
    if (process.env.DEMO_SANDBOX_TEST_HOOKS === "true" && (await cookies()).get(FORCE_FAIL_COOKIE)) throw new Error("creation forced to fail by the test hook");
    const acquired = await acquireSandbox(arrival);
    schema = acquired.schema;
    console.info(`[sandbox] ${acquired.source === "spare" ? "claimed a spare" : `created a sandbox in ${Math.round(acquired.createMs ?? 0)} ms`}: ${schema}`);
    after(sandboxHousekeeping); // top the spares up, drop up to 3 expired sandboxes
  } catch (err) {
    console.error("[sandbox] using the shared demo instead:", err instanceof Error ? err.message : err);
  }

  const options = { path: "/", sameSite: "lax" as const, httpOnly: true, secure };
  if (visitorClockEnabled()) response.cookies.set(VISITOR_CLOCK_COOKIE, String(arrival), { ...options, maxAge: VISITOR_CLOCK_MAX_AGE_SECONDS });
  if (schema) response.cookies.set(SANDBOX_COOKIE, signSandboxCookie(schema), { ...options, maxAge: SANDBOX_LIFETIME_MS / 1000 });
  else response.cookies.set(SANDBOX_COOKIE, SHARED_MARKER, { ...options, maxAge: SHARED_MARKER_MAX_AGE_SECONDS });
  return response;
}, { writes: false });
