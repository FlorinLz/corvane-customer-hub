import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { test } from "@playwright/test";

import { SERVER_ENV_BY_PORT } from "./server-env";

const run = promisify(execFile);

/**
 * Restores the demo data for the running test's web server: `npm run demo:reset-data`, with the clock and GLEIF settings that server was
 * started with. The app has no public reset (/api/demo/reset answers 404), so the specs reset the local Docker database directly.
 * The argument is the old signature's request context, ignored.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function resetDemoData(_request?: unknown): Promise<void> {
  const port = new URL(test.info().project.use.baseURL ?? "http://localhost:3000").port;
  const serverEnv = SERVER_ENV_BY_PORT[port];
  if (!serverEnv) throw new Error(`No e2e server environment for port ${port}`);
  const root = resolve(__dirname, "../../..");
  await run(resolve(root, "node_modules/.bin/tsx"), ["scripts/demo-reset-data.ts"], {
    cwd: root,
    env: { ...process.env, ...serverEnv },
    maxBuffer: 10 * 1024 * 1024,
    timeout: 240_000,
  });
}
