import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { db } from "@/server/db";

// New customer wizard step 2's contracting-entity picker: the selected
// group's existing members, plus the entity being created (added
// client-side — it has no id yet). GET isn't usable from apiRequest
// (POST/PUT/PATCH/DELETE only), so this is POST with no body, same as
// other read-only lookups in this milestone.
export const POST = handle("groups.members", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await getCurrentUser();
  const { id } = await params;
  return db.entity.findMany({
    where: { groupId: id, deletedAt: null },
    select: { id: true, legalName: true },
    orderBy: { legalName: "asc" },
  });
});
