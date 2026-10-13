import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contributors reach an issue by exactly four paths: "Add contributor" (a person chooses), and three named rules.
 *   1. Type default (M18 AC8): on save and on a type change, the entity's named person in the type's contributor team (ISSUE_TYPE_ROUTING).
 *   2. Linked issue (M23 AC7): the linked customer's named Ops person.
 *   3. Root cause report (M27 AC4): the entity's named Compliance reviewer, when the report task is created.
 * Any other `issueContributor.create`, in the app code, is a path nobody asked for: this fails until it is named here.
 */
const ALLOWED: Record<string, number> = {
  "src/server/services/issue.ts": 3, // rule 1 (save), rule 1 (type change), Add contributor
  "src/server/services/issue-partner.ts": 1, // rule 2
  "src/server/services/root-cause-report.ts": 1, // rule 3
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
}

describe("contributor paths", () => {
  it("only the named paths create IssueContributor rows", () => {
    const found: Record<string, number> = {};
    for (const file of walk("src")) {
      const n = (readFileSync(file, "utf8").match(/issueContributor\.(create|createMany|upsert)\(/g) ?? []).length;
      if (n > 0) found[file] = n;
    }
    expect(found).toEqual(ALLOWED);
  });
});
