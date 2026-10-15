import { NextResponse, type NextRequest } from "next/server";

import { clockStartMs } from "@/lib/dates";
import { SANDBOX_COOKIE, SHARED_MARKER } from "@/lib/sandbox";
import { sandboxesEnabled } from "@/server/sandbox-config";
import { parseArrival, VISITOR_CLOCK_COOKIE, VISITOR_CLOCK_MAX_AGE_SECONDS } from "@/lib/visitor-clock";

// The per-visitor demo clock (src/lib/visitor-clock.ts): a visitor's first request gets the `ch_arrival` cookie with the
// real arrival instant. The cookie is also put on the request itself, so the page rendered for that very first request
// already reads it. Only when the demo clock is on and DEMO_CLOCK_ANCHOR is not overriding it.
export function proxy(request: NextRequest) {
  const demoClock =
    process.env.DEMO_MODE === "true" && !process.env.DEMO_CLOCK_ANCHOR && clockStartMs({ DEMO_MODE: "true", DEMO_CLOCK_START: process.env.DEMO_CLOCK_START }) !== null;
  // With sandboxes on, the arrival is set together with ch_sandbox by /api/demo/sandbox (data and clock start together). Only a visitor on the shared
  // fallback gets the arrival from here, as before.
  const sandboxOwnsArrival = sandboxesEnabled() && request.cookies.get(SANDBOX_COOKIE)?.value !== SHARED_MARKER;
  if (!demoClock || sandboxOwnsArrival || parseArrival(request.cookies.get(VISITOR_CLOCK_COOKIE)?.value, Date.now()) !== undefined) return NextResponse.next();

  const arrival = String(Date.now());
  request.cookies.set(VISITOR_CLOCK_COOKIE, arrival);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(VISITOR_CLOCK_COOKIE, arrival, {
    maxAge: VISITOR_CLOCK_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/cron).*)"],
};
