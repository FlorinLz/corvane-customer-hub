import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { GleifRecord } from "./client";

interface GleifCacheFile {
  capturedAt: string;
  source: string;
  records: Record<string, GleifRecord>;
}

let cached: GleifCacheFile | null = null;

function cachePath(): string {
  // The env override exists for tests only (swapping in
  // tests/e2e/fixtures/gleif-cache.json, brief 7.3.2). Resolving a
  // dynamic path here would make Turbopack trace and bundle the whole
  // project for deployment; turbopackIgnore keeps that static.
  return resolve(/* turbopackIgnore: true */ process.cwd(), process.env.GLEIF_CACHE_PATH || "data/gleif-cache.json");
}

/** Lazily loaded and memoised; `reloadGleifCache()` clears it for tests that swap GLEIF_CACHE_PATH. */
export function loadGleifCache(): GleifCacheFile {
  if (!cached) {
    const raw = readFileSync(cachePath(), "utf-8");
    cached = JSON.parse(raw) as GleifCacheFile;
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
