import { handle } from "@/server/http";
import { ValidationError } from "@/server/errors";
import { getCurrentUser } from "@/server/session";
import { softDeleteEntity } from "@/server/services/entity-lifecycle";

// Brief 3.8.2 "Delete record", M16 AC8-AC10. Admin only.
export const POST = handle("entity.delete", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getCurrentUser();
  const body = (await req.json().catch(() => null)) as { reason?: string } | null;
  if (!body?.reason) throw new ValidationError({ reason: ["Enter a reason of 10 to 500 characters"] });
  const entity = await softDeleteEntity(user, id, body.reason);
  return { id: entity.id, deletedAt: entity.deletedAt };
});
