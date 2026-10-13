import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** The code base carries no trace of the old product name, in any file (the word is built here so this file does not contain it). */
const WORD = new RegExp(["ip", "id"].join(""), "i");
const SKIP = new Set([".git", "node_modules", ".next", "test-results", "playwright-report", "blob-report", "coverage"]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name) || name.startsWith(".next-e2e-")) return [];
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("no trace of the old brand", () => {
  it("no tracked or untracked file in the working tree contains it, in its name or its text", () => {
    const hits = walk(".").filter((f) => {
      if (/\.(png|jpe?g|gif|ico|woff2?|pdf|tsbuildinfo)$/i.test(f)) return false;
      if (f === ".env" || f.startsWith(".env.") && f !== ".env.example") return false; // local, git-ignored secrets
      return WORD.test(f) || WORD.test(readFileSync(f, "utf-8"));
    });
    expect(hits).toEqual([]);
  });
});
