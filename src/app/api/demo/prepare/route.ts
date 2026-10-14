import { NextResponse } from "next/server";

import { handle } from "@/server/http";
import { NotFoundError } from "@/server/errors";
import { idleRestoreEnabled, prepareDemo } from "@/server/demo-idle";
import { VISITOR_CLOCK_COOKIE, VISITOR_CLOCK_MAX_AGE_SECONDS } from "@/lib/visitor-clock";
import { visitorClockEnabled } from "@/lib/dates";

export const maxDuration = 300;

// Called by the "Preparing a fresh demo..." screen. Waits for a running restore, or runs one when the idle rule holds (changes since the
// last restore, nobody wrote for 20 minutes); does nothing otherwise, so it is no way to reset the demo on demand. Then gives the visitor a new
// ch_arrival, so their clock starts together with the data. Open to every visitor: it takes no input.
export const POST = handle("demo.prepare", async (req: Request) => {
  if (!idleRestoreEnabled()) throw new NotFoundError();
  const { lastRestoreAtMs } = await prepareDemo();

  const response = NextResponse.json({ ok: true, data: {} });
  if (visitorClockEnabled()) {
    // Never before the restore, even when this instance's clock runs a little behind the database's (the page would ask again).
    const arrival = Math.max(Date.now(), lastRestoreAtMs ?? 0);
    response.cookies.set(VISITOR_CLOCK_COOKIE, String(arrival), {
      maxAge: VISITOR_CLOCK_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: new URL(req.url).protocol === "https:",
    });
  }
  return response;
}, { writes: false });
