import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { handle } from "@/server/http";
import { NotFoundError, ValidationError } from "@/server/errors";
import { signUserCookie, SESSION_COOKIE } from "@/server/session";
import { DEMO_USERS } from "@/lib/demo-users";

// Brief 7.2.2, M15 AC11. 404 when DEMO_MODE is off.
export const POST = handle("demo.view-as", async (req: Request) => {
  if (process.env.DEMO_MODE !== "true") throw new NotFoundError();

  const body = (await req.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email;
  // Milestone 8: keyed by email (several users can share a team), restricted
  // to the demo roster so this endpoint can't be used to sign in as an
  // arbitrary active user.
  if (!email || !DEMO_USERS.some((u) => u.email === email)) {
    throw new ValidationError({ email: ["Select a user"] });
  }

  const user = await db.user.findUniqueOrThrow({ where: { email, active: true } });

  const response = NextResponse.json({ ok: true, data: { name: user.name, team: user.team } });
  response.cookies.set(SESSION_COOKIE, signUserCookie(user.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return response;
});
