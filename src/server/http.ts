import { NextResponse } from "next/server";

import "@/server/request-clock"; // registers the per-visitor clock for now() on the server
import { recordDataWrite } from "@/server/demo-idle";

import {
  ConflictError,
  DeletedError,
  ForbiddenError,
  GleifUnavailableError,
  IssueForbiddenError,
  NotFoundError,
  UnauthenticatedError,
  ValidationError,
} from "@/server/errors";

// Brief 3.1.1 "http.ts: handle(name, fn): auth, error mapping, JSON
// responses" and 3.1.3's per-step failure response shapes.
//
// Idle restore: a POST, PUT, PATCH or DELETE that succeeds counts as a data write (DemoMeta.lastWriteAt, src/server/demo-idle.ts). A
// handler that only reads, or only sets a cookie, passes { writes: false }.
export function handle<Args extends unknown[]>(
  name: string,
  fn: (...args: Args) => Promise<unknown>,
  options: { writes?: boolean } = {},
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      const data = await fn(...args);
      const request = args[0];
      if (options.writes !== false && process.env.DEMO_MODE === "true" && request instanceof Request && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
        await recordDataWrite();
      }
      // A handler that already built its NextResponse (e.g. to set a
      // cookie) is returned as-is; anything else is wrapped.
      if (data instanceof NextResponse) return data;
      return NextResponse.json({ ok: true, data });
    } catch (err) {
      if (err instanceof ValidationError) {
        return NextResponse.json({ error: "validation", fieldErrors: err.fieldErrors }, { status: 400 });
      }
      if (err instanceof UnauthenticatedError) {
        return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
      }
      if (err instanceof ForbiddenError) {
        return NextResponse.json({ error: "forbidden", owner_team: err.ownerTeam }, { status: 403 });
      }
      if (err instanceof IssueForbiddenError) {
        return NextResponse.json({ error: "forbidden", code: err.code, message: err.message }, { status: 403 });
      }
      if (err instanceof NotFoundError) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      if (err instanceof ConflictError) {
        return NextResponse.json(
          { error: "conflict", message: err.message, ...(err.needsConfirmation ? { needsConfirmation: true } : {}) },
          { status: 409 },
        );
      }
      if (err instanceof DeletedError) {
        return NextResponse.json(
          { error: "deleted", message: "This record was deleted. Contact the admin to reactivate it." },
          { status: 410 },
        );
      }
      if (err instanceof GleifUnavailableError) {
        return NextResponse.json({ error: "gleif_unavailable" }, { status: 503 });
      }
      console.error(`[${name}]`, err);
      return NextResponse.json({ error: "server", message: "Something went wrong. Try again." }, { status: 500 });
    }
  };
}
