import "dotenv/config";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/server/db";
import { UnauthenticatedError } from "@/server/errors";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) })); // no ch_user cookie

import { getCurrentUser } from "@/server/session";

/**
 * Default user fallback (DEMO_MODE, no cookie): the user named by DEMO_DEFAULT_USER_EMAIL, else the first active Admin, so the app
 * still loads (and the app stays reachable) while the database holds users the env var does not name. Real seed data; the
 * tests that flip `active` restore it in `finally`.
 */

const saved = { mode: process.env.DEMO_MODE, email: process.env.DEMO_DEFAULT_USER_EMAIL };

beforeEach(() => {
  process.env.DEMO_MODE = "true";
});

afterEach(() => {
  for (const [key, value] of [["DEMO_MODE", saved.mode], ["DEMO_DEFAULT_USER_EMAIL", saved.email]] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

async function firstActiveAdmin() {
  const admins = await db.user.findMany({ where: { isAdmin: true, active: true } });
  return admins.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.email.localeCompare(b.email))[0];
}

describe("getCurrentUser default user", () => {
  it("is the user named by DEMO_DEFAULT_USER_EMAIL when it exists", async () => {
    const emma = await db.user.findFirstOrThrow({ where: { isAdmin: false, active: true } });
    process.env.DEMO_DEFAULT_USER_EMAIL = emma.email;
    expect((await getCurrentUser()).id).toBe(emma.id);
  });

  it("falls back to the first active Admin when that user does not exist", async () => {
    process.env.DEMO_DEFAULT_USER_EMAIL = "former.user@legacy.example"; // a user the database does not hold (for example the old users before a reset)
    const user = await getCurrentUser();
    const expected = await firstActiveAdmin();
    expect(user.isAdmin).toBe(true);
    expect(user.active).toBe(true);
    expect(user.id).toBe(expected.id);
  });

  it("falls back to the first active Admin when DEMO_DEFAULT_USER_EMAIL is not set", async () => {
    delete process.env.DEMO_DEFAULT_USER_EMAIL;
    expect((await getCurrentUser()).id).toBe((await firstActiveAdmin()).id);
  });

  it("falls back when the named user is inactive", async () => {
    const emma = await db.user.findFirstOrThrow({ where: { isAdmin: false, active: true } });
    process.env.DEMO_DEFAULT_USER_EMAIL = emma.email;
    await db.user.update({ where: { id: emma.id }, data: { active: false } });
    try {
      const user = await getCurrentUser();
      expect(user.id).not.toBe(emma.id);
      expect(user.isAdmin).toBe(true);
    } finally {
      await db.user.update({ where: { id: emma.id }, data: { active: true } });
    }
  });

  it("still fails when there is no active Admin to fall back to", async () => {
    process.env.DEMO_DEFAULT_USER_EMAIL = "nobody@corvane.example";
    const admins = await db.user.findMany({ where: { isAdmin: true, active: true }, select: { id: true } });
    const ids = admins.map((a) => a.id);
    await db.user.updateMany({ where: { id: { in: ids } }, data: { active: false } });
    try {
      await expect(getCurrentUser()).rejects.toBeInstanceOf(UnauthenticatedError);
    } finally {
      await db.user.updateMany({ where: { id: { in: ids } }, data: { active: true } });
    }
  });

  it("does not fall back outside demo mode", async () => {
    process.env.DEMO_MODE = "false";
    process.env.DEMO_DEFAULT_USER_EMAIL = "nobody@corvane.example";
    await expect(getCurrentUser()).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});
