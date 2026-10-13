import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { reactivateEntity } from "@/server/services/entity-lifecycle";

// Brief 3.8.2 "Reactivate", M16 AC13, AC15, resolution 57. Admin only.
// R1: a reused-LEI conflict blocks outright (guard 5) instead of the full
// R2 AC15 flow, so no reason is accepted or required here yet.
export const POST = handle("entity.reactivate", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getCurrentUser();
  const entity = await reactivateEntity(user, id);
  return { id: entity.id, deletedAt: entity.deletedAt };
});
