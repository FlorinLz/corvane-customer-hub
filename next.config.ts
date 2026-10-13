import path from "node:path";
import type { NextConfig } from "next";

// demo-clock-writes bug fix: `next build` uses Turbopack by default (Next
// 16), and Turbopack doesn't inline the legacy `env` config key below into
// client bundles the way webpack's DefinePlugin did -- every "use client"
// call to now()/today() silently fell back to the browser's own real,
// unoffset clock no matter what DEMO_CLOCK_START said. NEXT_PUBLIC_-prefixed
// vars are the one inlining mechanism Next guarantees under either bundler,
// so derive them here, at build-time module load, from the existing
// (unrenamed) vars -- no Vercel env var changes, server code keeps reading
// the plain names unchanged. src/lib/dates.ts reads both, prefixed as a
// fallback.
if (process.env.DEMO_MODE) process.env.NEXT_PUBLIC_DEMO_MODE = process.env.DEMO_MODE;
if (process.env.DEMO_CLOCK_START) process.env.NEXT_PUBLIC_DEMO_CLOCK_START = process.env.DEMO_CLOCK_START;
if (process.env.DEMO_CLOCK_ANCHOR) process.env.NEXT_PUBLIC_DEMO_CLOCK_ANCHOR = process.env.DEMO_CLOCK_ANCHOR;

const nextConfig: NextConfig = {
  // Pins the workspace root to this repo, so Turbopack doesn't walk up to a
  // stray lockfile in a parent directory on this machine.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // E2E-5 (brief 7.3.2) runs a second `next dev` instance from this same
  // directory, on its own port, for its own DEMO_CLOCK_START. Next 16
  // refuses to run two `next dev` processes against the same `distDir`
  // (its own dev cache would corrupt between them) -- `dev:e2e-issues`
  // sets NEXT_DIST_DIR so that instance gets a separate build cache
  // instead of colliding with the main server's `.next`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
