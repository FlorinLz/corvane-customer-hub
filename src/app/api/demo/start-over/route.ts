import { NextResponse } from "next/server";

import { visitorClockEnabled } from "@/lib/dates";
import { SANDBOX_COOKIE, SANDBOX_LIFETIME_MS } from "@/lib/sandbox";
import { VISITOR_CLOCK_COOKIE, VISITOR_CLOCK_MAX_AGE_SECONDS } from "@/lib/visitor-clock";
import { NotFoundError } from "@/server/errors";
import { handle } from "@/server/http";
import { restoreSandbox } from "@/server/sandbox";
import { currentSandboxSchema } from "@/server/sandbox-context";
import { signSandboxCookie } from "@/server/sandbox-cookie";

export const maxDuration = 300;

// "Start over" in the demo bar. Restores the visitor's own schema from the snapshot, bumps its DemoMeta.seedVersion (the scenario panel starts again), and
// gives them a new ch_arrival, so the clock is back at Monday 10:05 with their next 24 hours. The schema comes from the signed cookie: it can only ever be
// the visitor's own. Visitors on the shared demo have no sandbox, so for them it answers 404 (and the demo bar does not show the button).
export const POST = handle("demo.start-over", async (req: Request) => {
  const schema = currentSandboxSchema();
  if (!schema) throw new NotFoundError();
  const arrival = Date.now();
  const seedVersion = await restoreSandbox(schema, arrival);

  const response = NextResponse.json({ ok: true, data: { seedVersion } });
  const options = { path: "/", sameSite: "lax" as const, httpOnly: true, secure: new URL(req.url).protocol === "https:" };
  if (visitorClockEnabled()) response.cookies.set(VISITOR_CLOCK_COOKIE, String(arrival), { ...options, maxAge: VISITOR_CLOCK_MAX_AGE_SECONDS });
  response.cookies.set(SANDBOX_COOKIE, signSandboxCookie(schema), { ...options, maxAge: SANDBOX_LIFETIME_MS / 1000 });
  return response;
}, { writes: false });
