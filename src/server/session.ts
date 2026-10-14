import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { User } from "@prisma/client";

import { db } from "@/server/db";
import { UnauthenticatedError } from "@/server/errors";

export const SESSION_COOKIE = "ch_user";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

function sign(userId: string): string {
  const mac = createHmac("sha256", secret()).update(userId).digest("hex");
  return `${userId}.${mac}`;
}

/** Brief 3.1.3 step 1: the ch_user cookie value, HMAC-SHA256 with SESSION_SECRET. */
export function signUserCookie(userId: string): string {
  return sign(userId);
}

function verify(value: string): string | null {
  const dot = value.lastIndexOf(".");
  if (dot === -1) return null;
  const userId = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  const expected = createHmac("sha256", secret()).update(userId).digest("hex");
  const macBuf = Buffer.from(mac, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (macBuf.length !== expectedBuf.length || !timingSafeEqual(macBuf, expectedBuf)) return null;
  return userId;
}

/**
 * Brief 3.1.3 step 1, 7.2.2. Loads the User row fresh on every request (so
 * a team change applies to the user's next request, M15 AC5/AC10). With
 * DEMO_MODE=true and no cookie, signs in as DEMO_DEFAULT_USER_EMAIL
 * (decision B8, Adrian Koh); if that user does not exist (for example right
 * after a rebrand, while the database still holds the old users) or is
 * inactive, it falls back to the first active Admin so the app still loads and
 * the app stays reachable. With DEMO_MODE=false and no cookie, the
 * request fails (company SSO is out of scope, resolution 60).
 */
export async function getCurrentUser(): Promise<User> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  const userId = raw ? verify(raw) : null;

  if (userId) {
    const user = await db.user.findUnique({ where: { id: userId, active: true } });
    if (user) return user;
  }

  if (process.env.DEMO_MODE === "true") {
    const email = process.env.DEMO_DEFAULT_USER_EMAIL;
    if (email) {
      const user = await db.user.findUnique({ where: { email, active: true } });
      if (user) return user;
    }
    const admin = await db.user.findFirst({
      where: { isAdmin: true, active: true },
      orderBy: [{ createdAt: "asc" }, { email: "asc" }],
    });
    if (admin) return admin;
  }

  throw new UnauthenticatedError();
}

/** Same as getCurrentUser(), but returns null instead of throwing (page-level reads that render their own access state). */
export async function getCurrentUserOrNull(): Promise<User | null> {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}
