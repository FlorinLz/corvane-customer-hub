import { afterEach, describe, expect, it, vi } from "vitest";

import { cronAuthorized } from "@/server/demo-idle";
import * as resetRoute from "@/app/api/demo/reset/route";
import { GET as cronRestore } from "@/app/api/cron/demo-restore/route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/api/demo/reset: there is no public reset", () => {
  it("answers 404 to every method, signed in as the admin or not", async () => {
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"] as const) {
      const handler = resetRoute[method];
      expect(handler, method).toBeTypeOf("function");
      const res = await (handler as () => Response | Promise<Response>)();
      expect(res.status, method).toBe(404);
    }
  });
});

describe("/api/cron/demo-restore: the daily backstop", () => {
  const request = (headers: Record<string, string> = {}) => new Request("http://localhost/api/cron/demo-restore", { headers });

  it("401 without the secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret-value");
    expect((await cronRestore(request())).status).toBe(401);
  });

  it("401 with a wrong secret or the wrong scheme", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret-value");
    expect((await cronRestore(request({ authorization: "Bearer nope" }))).status).toBe(401);
    expect((await cronRestore(request({ authorization: "s3cret-value" }))).status).toBe(401);
  });

  it("401 when CRON_SECRET is not set at all, even for a request that guesses the header", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await cronRestore(request({ authorization: "Bearer " }))).status).toBe(401);
    expect((await cronRestore(request({ authorization: "Bearer undefined" }))).status).toBe(401);
  });

  it("accepts exactly 'Bearer <CRON_SECRET>', the header Vercel Cron sends", () => {
    expect(cronAuthorized("Bearer s3cret-value", "s3cret-value")).toBe(true);
    expect(cronAuthorized("Bearer s3cret-valuf", "s3cret-value")).toBe(false);
    expect(cronAuthorized(null, "s3cret-value")).toBe(false);
    expect(cronAuthorized("Bearer ", "")).toBe(false);
  });
});
