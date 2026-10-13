import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { reassignOwnerSchema } from "@/lib/validation/owner";
import { reassignOwner } from "@/server/services/owner";
import { assertCan } from "@/server/permissions/guard";

// Brief 3.8.2 "Reassign owner", M9 AC3-AC11, edge 1, edge 3, edge 4. CS.
export const POST = handle("entity.owner", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getCurrentUser();
  assertCan(user, "owner.reassign");
  const input = parseBody(reassignOwnerSchema, await readJson(req));
  return reassignOwner(user, id, input);
});
