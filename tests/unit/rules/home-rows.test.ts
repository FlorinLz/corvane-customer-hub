import "dotenv/config";

import { describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { isIssuesEmpty, loadWorklistIssues } from "@/server/queries/worklist/issues";

// Role actions PR: the Home issue row's data (view) on the real seed, under the frozen demo clock
// (DEMO_CLOCK_START=2026-10-02T09:00:00+03:00, scripts/test-all.sh). Same fixtures as issues.test.ts.

async function load(name: string, scope: "mine" | "team") {
  const user = await db.user.findFirstOrThrow({ where: { name } });
  return loadWorklistIssues(user, scope);
}

describe("Home rows, scope Mine", () => {
  it("Kevin Lim: his own actions lead line 1, and the time block is the issue's nearest deadline, his or somebody else's", async () => {
    const { main, viewerZone, serverNow } = await load("Kevin Lim", "mine");
    expect(main.map((r) => r.number).sort()).toEqual([1038, 1042]);
    for (const row of main) {
      expect(row.view.scope).toBe("mine");
      expect(row.view.hasAction).toBe(true);
      expect(row.view.line1.kind).toBe("own");
      expect(row.view.time).not.toBeNull(); // every issue has a running clock: no dash
    }
    // ISS-1038: Kevin's step is Investigate (a wrong match has no service to restore), and the nearest deadline is Adrian's next customer update.
    const iss1038 = main.find((r) => r.number === 1038)!;
    expect(iss1038.view.line1).toEqual({ kind: "own", label: "Investigate" });
    expect(iss1038.view.time).toMatchObject({ own: false, person: "Adrian Koh", label: "Update" });
    expect(iss1038.view.timePerson).toBe("Adrian Koh");
    // ISS-1042: the service is restored, so the nearest deadline is the update, which is Kevin's own until the hand-over at the start of Emma's day.
    expect(main.find((r) => r.number === 1042)!.view.time).toMatchObject({ label: "Update", paused: null });
    expect(viewerZone).toBe("Asia/Kuala_Lumpur");
    expect(new Date(serverNow).toISOString()).toBe(serverNow); // the demo clock, an ISO instant
  });

  it("Adrian Koh on ISS-1038: his step is the customer update, with its own deadline", async () => {
    const { main } = await load("Adrian Koh", "mine");
    const row = main.find((r) => r.number === 1038)!;
    expect(row.view.hasAction).toBe(true);
    expect(row.view.timeDueAt).not.toBeNull();
    expect(row.view.time).toMatchObject({ own: true, person: "Adrian Koh", label: "Update" });
    expect(row.view.timePerson).toBeNull();
    expect(row.view.line1).toEqual({ kind: "own", label: "Send update to Revolut Ltd" });
    expect(row.view.productLine).toBe("UK CoP / GB");
    expect(row.view.linkedTo).toBeNull();
  });

  it("Lukas Brenner is a contributor on ISS-1038: a Contributing row in the same shape, waiting on the communicator's update", async () => {
    const { contributing } = await load("Lukas Brenner", "mine");
    const row = contributing.find((r) => r.number === 1038)!;
    expect(row.view.line1).toMatchObject({ kind: "waiting", role: "Communicator", person: "Adrian Koh" });
    expect(row.view.hasAction).toBe(false);
    expect(row.view.time).toMatchObject({ own: false, person: "Adrian Koh", label: "Update" });
  });
});

describe("Home rows, scope My team", () => {
  it("Adrian Koh sees each team issue once, the time block led by its most urgent open action and its person", async () => {
    const { main } = await load("Adrian Koh", "team");
    const numbers = main.map((r) => r.number);
    expect(new Set(numbers).size).toBe(numbers.length);
    const original = main.filter((r) => r.number === 1042 || r.number === 1038);
    expect(original.map((r) => r.number)).toEqual([1042, 1038]); // by deadline: MPS's update is due before Revolut's
    expect(original.every((r) => r.view.line1.kind === "person")).toBe(true);
    // The team scope has no "own": each row shows the issue's nearest deadline with its person.
    expect(original.map((r) => r.view.timePerson)).toEqual(["Kevin Lim", "Adrian Koh"]);
  });
});

describe("The Issues summary chip", () => {
  it("counts the rows of Issues plus Contributing, never 'Reported by me'", async () => {
    for (const name of ["Adrian Koh", "Kevin Lim", "Lukas Brenner", "Emma Wilson", "Rachel Wong", "Mei Chen"]) {
      const r = await load(name, "mine");
      expect(r.count, name).toBe(r.main.length + r.contributing.length);
    }
    // Lukas owns four partner issues and contributes on ISS-1038 and ISS-1023: the chip says 6.
    const lukas = await load("Lukas Brenner", "mine");
    expect(lukas.main.map((r) => r.number).sort()).toEqual([1020, 1026, 1027, 1030]);
    expect(lukas.contributing.map((r) => r.number).sort()).toEqual([1023, 1038]);
    expect(lukas.count).toBe(6);
  }, 30_000); // seven Home loads against a real database

  it("a row carries what the table shows: type, first line of the description, customer, partner flag", async () => {
    const { main } = await load("Kevin Lim", "mine");
    const row = main.find((r) => r.number === 1042)!;
    expect(row.view.typeLabel).toBe("Service unavailable or latency");
    expect(row.view.descriptionLine.length).toBeGreaterThan(10);
    expect(row.view.descriptionLine).not.toContain("\n");
    expect(row.view.entityName).toBe("Banca Monte dei Paschi di Siena S.p.A.");
    expect(row.view.isPartner).toBe(false);
  });
});

describe('Home\'s "Your worklist is clear" card', () => {
  it("shows only when Issues, Contributing, Reported by me and the Resolved group are all empty", async () => {
    // Lukas Brenner (Network) owns four partner issues and contributes on ISS-1038 and ISS-1023, so Home is not clear.
    expect(isIssuesEmpty(await load("Lukas Brenner", "mine"))).toBe(false);
    // Rachel Wong (Finance) owns ISS-1031 and three more billing issues: Issues (4).
    expect(isIssuesEmpty(await load("Rachel Wong", "mine"))).toBe(false);
    // Nora Lee (Network, on call) has nothing anywhere: clear.
    expect(isIssuesEmpty(await load("Nora Lee", "mine"))).toBe(true);
  });

  it("is not clear for a viewer whose only rows are in the Resolved group, or only Reported by me", () => {
    const empty = { main: [], contributing: [], reported: [], resolvedWaiting: [] };
    expect(isIssuesEmpty(empty)).toBe(true);
    expect(isIssuesEmpty({ ...empty, resolvedWaiting: [{} as never] })).toBe(false);
    expect(isIssuesEmpty({ ...empty, reported: [{} as never] })).toBe(false);
  });
});
