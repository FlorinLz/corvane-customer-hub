import { NextResponse } from "next/server";

import { cronAuthorized, runRestore } from "@/server/demo-idle";
import { ConflictError } from "@/server/errors";
import { cleanupSandboxes } from "@/server/sandbox";
import { sandboxesEnabled } from "@/server/sandbox-config";

// Same limit as the other restores: explicit so a restore on a database a network hop away is never cut short.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// The daily backstop (vercel.json: once a day, 03:00 UTC). Runs the same restore as the idle rule, unconditionally, on the public schema (the shared
// demo). With sandboxes on it also drops expired sandboxes, spares made from an old DDL or snapshot, and orphan schemas. Vercel Cron calls it
// with GET and `Authorization: Bearer $CRON_SECRET`; without the secret, or with CRON_SECRET unset, the answer is 401 and nothing runs.
export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get("authorization"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (process.env.DEMO_MODE !== "true") return NextResponse.json({ error: "not_found" }, { status: 404 });
  let sandboxes: Awaited<ReturnType<typeof cleanupSandboxes>> | { error: string } | undefined;
  if (sandboxesEnabled()) {
    try {
      sandboxes = await cleanupSandboxes();
    } catch (err) {
      console.error("[cron.demo-restore] sandbox cleanup", err);
      sandboxes = { error: "server" };
    }
  }
  try {
    const { seedVersion, mode } = await runRestore();
    return NextResponse.json({ ok: true, seedVersion, mode, ...(sandboxes ? { sandboxes } : {}) });
  } catch (err) {
    if (err instanceof ConflictError) return NextResponse.json({ ok: true, skipped: "a restore is already running", ...(sandboxes ? { sandboxes } : {}) });
    console.error("[cron.demo-restore]", err);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
