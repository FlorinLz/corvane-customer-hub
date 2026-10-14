import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { GleifRecord } from "./client";
// The default cache is imported, not read from disk, so the bundler puts it inside every function that uses it.
// Reading data/gleif-cache.json with fs failed on Vercel (ENOENT /var/task/data/gleif-cache.json): the file
// is not part of the serverless output unless something imports it.
import bundledCache from "../../../data/gleif-cache.json";

interface GleifCacheFile {
  capturedAt: string;
  source: string;
  records: Record<string, GleifRecord>;
}

let cached: GleifCacheFile | null = null;

// The env override exists for tests only (swapping in tests/e2e/fixtures/gleif-cache.json, brief 7.3.2). Resolving a
// dynamic path here would make Turbopack trace and bundle the whole project for deployment; turbopackIgnore keeps
// that static. Unset, the bundled file above is used.
function overridePath(): string | null {
  const p = process.env.GLEIF_CACHE_PATH;
  // .env.example sets GLEIF_CACHE_PATH to the default location; that one is the bundled file too.
  if (!p || p === "data/gleif-cache.json") return null;
  return resolve(/* turbopackIgnore: true */ process.cwd(), p);
}

/** Lazily loaded and memoised; `reloadGleifCache()` clears it for tests that swap GLEIF_CACHE_PATH. */
export function loadGleifCache(): GleifCacheFile {
  if (!cached) {
    const path = overridePath();
    cached = path ? (JSON.parse(readFileSync(/* turbopackIgnore: true */ path, "utf-8")) as GleifCacheFile) : (bundledCache as unknown as GleifCacheFile);
  }
  return cached;
}

export function reloadGleifCache(): void {
  cached = null;
}

export function getCachedRecord(lei: string): GleifRecord | null {
  return loadGleifCache().records[lei] ?? null;
}

export function getCacheCapturedAt(): string {
  return loadGleifCache().capturedAt;
}
