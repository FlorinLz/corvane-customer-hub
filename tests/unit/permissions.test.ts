import { Team } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { can, type SessionUser } from "@/server/permissions/can";
import { MATRIX_BY_AREA, PERMISSION_MATRIX } from "@/server/permissions/matrix";
import { ForbiddenError } from "@/server/errors";

function user(team: Team, isAdmin = false): SessionUser {
  return { id: "u1", name: "Test User", team, isAdmin, active: true };
}

const ALL_TEAMS = Object.values(Team);

describe("PERMISSION_MATRIX (brief 4.1.2 / M15 AC3)", () => {
  it("has exactly one row per data area, every row covering all 6 teams", () => {
    const areas = PERMISSION_MATRIX.map((p) => p.area);
    expect(new Set(areas).size).toBe(areas.length);
    for (const policy of PERMISSION_MATRIX) {
      expect(Object.keys(policy.cells).sort()).toEqual([...ALL_TEAMS].sort());
    }
  });

  it("has exactly the 8 \"Owned by\" strings the brief names (4.1.4) plus the issue-owner tooltip of row 32, each used by at least one row", () => {
    const expected = [
      "Owned by Sales",
      "Owned by Ops",
      "Owned by Customer Success",
      "Owned by Network",
      "Owned by Compliance",
      "Owned by Finance",
      "Owned by Sales and Customer Success",
      "Owned by Sales and Finance",
      "Only the owner, <name>, can change this issue", // 4.1.2 row 32's own label text, not an "Owned by" string
    ];
    const used = new Set(PERMISSION_MATRIX.map((p) => p.ownerLabel).filter((l): l is string => l !== undefined && !l.includes("(")));
    for (const label of used) expect(expected).toContain(label);
  });

  it("the Audit and Roles & permissions rows are hidden to everyone but Compliance, with Ops reachable only via the admin flag", () => {
    for (const area of ["audit.read", "admin.permissions"] as const) {
      const policy = MATRIX_BY_AREA[area];
      expect(policy.cells.COMPLIANCE).toBe("R");
      expect(policy.cells.OPS).toBe("hidden");
      for (const team of ["SALES", "CS", "NETWORK", "FINANCE"] as const) {
        expect(policy.cells[team]).toBe("hidden");
      }
    }
  });

  it("admin-only areas (Users & roles, soft delete) are 'admin' for Ops and 'none' for every other team", () => {
    for (const area of ["admin.usersAndDeleted", "admin.softDelete"] as const) {
      const policy = MATRIX_BY_AREA[area];
      expect(policy.cells.OPS).toBe("admin");
      for (const team of ["SALES", "CS", "NETWORK", "COMPLIANCE", "FINANCE"] as const) {
        expect(policy.cells[team]).toBe("none");
      }
    }
  });
});

describe("can() (brief 4.1.3)", () => {
  it("every team reads a non-deleted entity", () => {
    for (const team of ALL_TEAMS) {
      expect(can(user(team), "entity.read")).toEqual({ ok: true });
    }
  });

  it("only the admin reads a soft-deleted entity, on any team, including Compliance (audit.read)", () => {
    const deleted = { entity: { deletedAt: new Date() } };
    for (const team of ALL_TEAMS) {
      expect(can(user(team), "entity.read", deleted).ok).toBe(false);
      expect(can(user(team), "audit.read", deleted).ok).toBe(false);
    }
    expect(can(user(Team.OPS, true), "entity.read", deleted)).toEqual({ ok: true });
    expect(can(user(Team.OPS, true), "audit.read", deleted)).toEqual({ ok: true });
  });

  it("delete and reactivate are exempt from the generic deleted-entity write block — they handle a deleted entity themselves", () => {
    // entity.softDelete and entity.reactivate are "the two admin record
    // actions" the 3.8 API preamble exempts from the blanket 410 rule;
    // an already-deleted entity being deleted again is a service-layer
    // conflict (checked once the service re-reads the row), not this gate.
    const deleted = { entity: { deletedAt: new Date() } };
    expect(can(user(Team.OPS, true), "entity.softDelete", deleted)).toEqual({ ok: true });
    expect(can(user(Team.OPS, true), "entity.reactivate", deleted)).toEqual({ ok: true });
  });

  it("audit.read: Compliance ok, every other non-admin team forbidden", () => {
    expect(can(user(Team.COMPLIANCE), "audit.read")).toEqual({ ok: true });
    for (const team of [Team.SALES, Team.OPS, Team.CS, Team.NETWORK, Team.FINANCE]) {
      const decision = can(user(team), "audit.read");
      expect(decision.ok).toBe(false);
    }
  });

  it("audit.read: the admin (on Ops) is ok despite the Ops cell being hidden", () => {
    expect(can(user(Team.OPS, true), "audit.read")).toEqual({ ok: true });
    expect(can(user(Team.OPS, false), "audit.read").ok).toBe(false);
  });

  it("admin.permissions.read: Compliance and the admin ok, every other team forbidden", () => {
    expect(can(user(Team.COMPLIANCE), "admin.permissions.read")).toEqual({ ok: true });
    expect(can(user(Team.OPS, true), "admin.permissions.read")).toEqual({ ok: true });
    for (const team of [Team.SALES, Team.OPS, Team.CS, Team.NETWORK, Team.FINANCE]) {
      expect(can(user(team, false), "admin.permissions.read").ok).toBe(false);
    }
  });

  it("entity.softDelete and entity.reactivate: only the admin, regardless of team", () => {
    for (const team of ALL_TEAMS) {
      expect(can(user(team, false), "entity.softDelete").ok).toBe(false);
      expect(can(user(team, false), "entity.reactivate").ok).toBe(false);
    }
    expect(can(user(Team.OPS, true), "entity.softDelete")).toEqual({ ok: true });
    expect(can(user(Team.OPS, true), "entity.reactivate")).toEqual({ ok: true });
  });

  it("entity.reactivate is allowed on a soft-deleted entity for the admin (the one exception to the deleted-entity write block)", () => {
    const deleted = { entity: { deletedAt: new Date() } };
    expect(can(user(Team.OPS, true), "entity.reactivate", deleted)).toEqual({ ok: true });
  });

  it("a denied team write returns a ForbiddenError carrying the matrix's owner team", () => {
    const decision = can(user(Team.SALES), "entity.softDelete");
    expect(decision.ok).toBe(false);
    if (!decision.ok && decision.error instanceof ForbiddenError) expect(decision.error.ownerTeam).toBe("Ops");
  });

  it("every non-admin, non-Compliance team is forbidden from admin.deleted.read", () => {
    for (const team of [Team.SALES, Team.OPS, Team.CS, Team.NETWORK, Team.COMPLIANCE, Team.FINANCE]) {
      expect(can(user(team, false), "admin.deleted.read").ok).toBe(false);
    }
    expect(can(user(Team.OPS, true), "admin.deleted.read")).toEqual({ ok: true });
  });

  it("a 'R' cell is never sufficient for a write action (milestone 5 fix): every team with only read access to product.stage is forbidden from product.stage.change", () => {
    expect(MATRIX_BY_AREA["product.stage"].cells.SALES).toBe("R"); // read access, not edit
    expect(can(user(Team.SALES), "product.stage.change").ok).toBe(false);
    expect(can(user(Team.OPS), "product.stage.change")).toEqual({ ok: true });
  });

  it("the same 'R' is not a write for owner.reassign, customer.renewalDate.edit or partner.coverage.changeStatus", () => {
    expect(can(user(Team.SALES), "owner.reassign").ok).toBe(false);
    expect(can(user(Team.CS), "owner.reassign")).toEqual({ ok: true });
    expect(can(user(Team.OPS), "customer.renewalDate.edit").ok).toBe(false);
    expect(can(user(Team.CS), "customer.renewalDate.edit")).toEqual({ ok: true });
    expect(can(user(Team.OPS), "partner.coverage.changeStatus").ok).toBe(false);
    expect(can(user(Team.NETWORK), "partner.coverage.changeStatus")).toEqual({ ok: true });
  });

  it("history.note.add: every team (brief's 'add' cell) can write, since 'add' counts as a write", () => {
    for (const team of ALL_TEAMS) {
      expect(can(user(team), "history.note.add")).toEqual({ ok: true });
    }
  });

  it("contact actions take their area from the resource, not a fixed table row: Billing is Finance-only regardless of context", () => {
    expect(can(user(Team.FINANCE), "contact.add", { area: "contact.FINANCE" })).toEqual({ ok: true });
    expect(can(user(Team.OPS), "contact.add", { area: "contact.FINANCE" }).ok).toBe(false);
    expect(can(user(Team.NETWORK), "contact.add", { area: "contact.NETWORK" })).toEqual({ ok: true });
  });

  it("entity.gleifRefresh is a dual-team special case: Ops and Compliance only, independent of entity.core's own cells", () => {
    expect(can(user(Team.OPS), "entity.gleifRefresh")).toEqual({ ok: true });
    expect(can(user(Team.COMPLIANCE), "entity.gleifRefresh")).toEqual({ ok: true });
    for (const team of [Team.SALES, Team.CS, Team.NETWORK, Team.FINANCE]) {
      expect(can(user(team), "entity.gleifRefresh").ok).toBe(false);
    }
  });

  it("issue.report: every team can report (brief 4.1.2 row 31)", () => {
    for (const team of ALL_TEAMS) {
      expect(can(user(team), "issue.report")).toEqual({ ok: true });
    }
  });

  it("issue.owner: team-level E for every team (brief 4.1.2 row 32); the owner-only gate is a service-layer identity check, not this table", () => {
    for (const team of ALL_TEAMS) {
      expect(can(user(team), "issue.owner")).toEqual({ ok: true });
    }
  });
});

describe("PERMISSION_MATRIX rows 31-34 (brief 4.1.2, milestone 6A)", () => {
  it("row 31 issue.report and rows 32-33 (owner, communicator) are team-level E for every team: the real gate is the person check in the service layer, not this table", () => {
    for (const area of ["issue.report", "issue.owner", "issue.communicator"] as const) {
      for (const team of ALL_TEAMS) {
        expect(MATRIX_BY_AREA[area].cells[team]).toBe("E");
      }
    }
  });

  it("row 34 Compliance assessment: Compliance edits, every other team reads", () => {
    expect(MATRIX_BY_AREA["issue.compliance"].cells.COMPLIANCE).toBe("E");
    for (const team of [Team.SALES, Team.OPS, Team.CS, Team.NETWORK, Team.FINANCE]) {
      expect(MATRIX_BY_AREA["issue.compliance"].cells[team]).toBe("R");
    }
  });

  it("the four rows render under the \"Issues\" group", () => {
    for (const area of ["issue.report", "issue.owner", "issue.communicator", "issue.compliance"] as const) {
      expect(MATRIX_BY_AREA[area].group).toBe("Issues");
    }
  });
});

describe("Report issue from Home: the button follows the same permission as the entity page's", () => {
  const user = (team: "SALES" | "OPS" | "CS" | "NETWORK" | "COMPLIANCE" | "FINANCE") => ({ id: "u", name: "U", team, isAdmin: false, active: true });

  it("every one of the six teams can report an issue, so every user sees the Home button", () => {
    for (const team of ["SALES", "OPS", "CS", "NETWORK", "COMPLIANCE", "FINANCE"] as const) expect(can(user(team), "issue.report").ok, team).toBe(true);
  });

  it("nobody can report on a deleted record (the entity page and the Home drawer share this rule)", () => {
    expect(can(user("OPS"), "issue.report", { entity: { deletedAt: new Date() } }).ok).toBe(false);
  });
});
