import { db } from "@/server/db";
import { handle } from "@/server/http";
import { NotFoundError } from "@/server/errors";
import { getCurrentUser } from "@/server/session";
import { assertCan } from "@/server/permissions/guard";
import { loadAuditPage } from "@/server/queries/audit";

// Brief 3.8.1 "GET /api/entities/{id}/audit", M16 AC4. Compliance and the
// admin only; on a soft-deleted entity, the admin only. R1: cursor via
// `page`, no Field/User/Date filters yet (R2).
export const GET = handle("entity.audit.list", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getCurrentUser();
  const entity = await db.entity.findUnique({ where: { id }, select: { deletedAt: true } });
  if (!entity) throw new NotFoundError();
  assertCan(user, "audit.read", { entity: { deletedAt: entity.deletedAt } });

  const page = Number(new URL(req.url).searchParams.get("page")) || 1;
  const result = await loadAuditPage(id, page);
  // AuditEntry.id is a BigInt (autoincrement PK); JSON.stringify can't
  // serialize it, so stringify it for the wire the same way the Audit
  // tab page already does for its React keys.
  return { ...result, entries: result.entries.map((e) => ({ ...e, id: e.id.toString() })) };
});
