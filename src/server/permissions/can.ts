import type { User } from "@prisma/client";

import { ConflictError, ForbiddenError } from "@/server/errors";
import { MATRIX_BY_AREA, type Cell, type DataArea } from "@/server/permissions/matrix";

export type SessionUser = Pick<User, "id" | "name" | "team" | "isAdmin" | "active">;

/**
 * One action per server write/read this milestone actually implements.
 * Extend this union as each later milestone's routes land — the matrix
 * above already carries every area, so a new action only needs an entry
 * here plus its ACTION_AREA row (or, for an action whose area depends on
 * the resource rather than a fixed table row, a `resource.area` passed by
 * the caller — see `Resource` below).
 */
export type Action =
  | "entity.read"
  | "audit.read"
  | "admin.permissions.read"
  | "admin.deleted.read"
  | "entity.softDelete"
  | "entity.reactivate"
  | "admin.demoReset"
  | "entity.roles.edit"
  | "entity.contract.attach"
  | "entity.group.edit"
  | "customer.renewalDate.edit"
  | "product.stage.change"
  | "product.block.edit"
  | "contact.add"
  | "contact.edit"
  | "contact.verify"
  | "partner.coverage.changeStatus"
  | "compliance.kyb.edit"
  | "compliance.obligations.edit"
  | "entity.gleifRefresh"
  | "owner.reassign"
  | "history.note.add"
  | "customer.create"
  | "issue.report"
  | "issue.owner"
  | "issue.communicator"
  | "issue.compliance"
  | "handoff.salesOps"
  | "handoff.opsCs";

export interface Resource {
  entity?: { deletedAt: Date | null };
  /**
   * Resource-dependent area override. Contacts don't have one fixed area:
   * the area comes from the contact's (context, role) via
   * `contactDataArea()` (brief 3.1.3 "for contacts the area comes from the
   * contact's ownerTeams"). The caller computes it and passes it here.
   */
  area?: DataArea;
}

export type Decision = { ok: true } | { ok: false; error: ForbiddenError | ConflictError };

const OK: Decision = { ok: true };

function forbidden(area: DataArea): Decision {
  return { ok: false, error: new ForbiddenError(MATRIX_BY_AREA[area].ownerLabel?.replace("Owned by ", "") ?? "Ops") };
}

/** entity.read has no entry: it has no team gate (every team reads every non-deleted entity), handled before this table is consulted. entity.gleifRefresh has no entry: it is a dual-team special case handled directly in can() (see below). */
const ACTION_AREA: Partial<Record<Action, DataArea>> = {
  "audit.read": "audit.read",
  "admin.permissions.read": "admin.permissions",
  "admin.deleted.read": "admin.usersAndDeleted",
  "entity.softDelete": "admin.softDelete",
  "entity.reactivate": "admin.softDelete",
  "admin.demoReset": "admin.demoReset",
  "entity.roles.edit": "entity.rolesAndLifecycle",
  "entity.contract.attach": "customer.contract",
  "entity.group.edit": "entity.group",
  "customer.renewalDate.edit": "customer.renewal",
  "product.stage.change": "product.stage",
  "product.block.edit": "product.stage",
  "partner.coverage.changeStatus": "partner.coverage",
  "compliance.kyb.edit": "compliance.kyb",
  "compliance.obligations.edit": "compliance.obligations",
  "owner.reassign": "owner.reassign",
  "history.note.add": "history.note",
  "customer.create": "customer.create",
  "issue.report": "issue.report",
  "issue.owner": "issue.owner",
  "issue.communicator": "issue.communicator",
  "handoff.salesOps": "handoff.salesOps",
  "handoff.opsCs": "handoff.opsCs",
  "issue.compliance": "issue.compliance",
};

const READ_ACTIONS = new Set<Action>(["entity.read", "audit.read", "admin.permissions.read", "admin.deleted.read"]);

/** Cells that satisfy a read: seeing the area's current value. */
function readOk(cell: Cell, isAdmin: boolean): boolean {
  return cell === "R" || cell === "E" || cell === "add" || (cell === "admin" && isAdmin) || (cell === "hidden" && isAdmin);
}

/** Cells that satisfy a write: "R" (read-only) never does, so a team with only read access can never pass a write check through this table. */
function writeOk(cell: Cell, isAdmin: boolean): boolean {
  return cell === "E" || cell === "add" || (cell === "admin" && isAdmin);
}

/** Brief 4.1.3 can(). Checked server-side on every read/write this milestone adds; UI calls the same function to decide what to render. */
export function can(user: SessionUser, action: Action, resource: Resource = {}): Decision {
  // Soft-deleted entity: only the admin reads it (M16 AC11). Every write
  // except the two admin record actions (delete, reactivate) is rejected
  // with 409 entity_deleted (brief 4.1.5, 4.8.1 line "returns 409
  // entity_deleted" — confirmed twice independently, overriding 3.8's
  // general preamble, which says 410 once); those two handle a deleted
  // entity themselves (reactivate's own logic; an already-deleted entity
  // being deleted again is a service-layer conflict, not this blanket rule).
  if (resource.entity?.deletedAt) {
    if (action === "entity.read" || action === "audit.read") {
      return user.isAdmin ? OK : forbidden("audit.read");
    }
    if (action !== "entity.reactivate" && action !== "entity.softDelete") {
      return { ok: false, error: new ConflictError("entity_deleted") };
    }
  }

  if (action === "entity.read") return OK; // every team reads every non-deleted entity (M1 AC16)

  // "Retry or refresh GLEIF" (3.8.2) spans two matrix areas: Ops triggers it
  // from the header retry (entity.core, "Owned by Ops") and Compliance from
  // the LEI KYB card (compliance.kyb, "Owned by Compliance"); the two teams
  // don't share one area, so this is a direct team check rather than a
  // table lookup. The service layer enforces Ops's extra precondition
  // (only when NOT_VERIFIED) — a business rule, not a permission.
  if (action === "entity.gleifRefresh") {
    return user.team === "OPS" || user.team === "COMPLIANCE" ? OK : forbidden("entity.core");
  }

  const area = resource.area ?? ACTION_AREA[action]!;
  const cell = MATRIX_BY_AREA[area].cells[user.team];
  const teamOk = READ_ACTIONS.has(action) ? readOk(cell, user.isAdmin) : writeOk(cell, user.isAdmin);

  if (!teamOk) return forbidden(area);
  return OK;
}
