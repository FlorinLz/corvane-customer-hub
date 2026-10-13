import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { linkEntitySchema } from "@/lib/validation/group-link";
import { linkEntityToGroup } from "@/server/services/group-link";
import { assertCan } from "@/server/permissions/guard";

// Brief 3.8.2 "Set group", M4 AC3, AC13, AC14. Ops; M5 R1 is link-only
// (groupId body shape) — {standalone:true} and confirmMove are R2.
export const PUT = handle("entity.group.link", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getCurrentUser();
  assertCan(user, "entity.group.edit");
  const input = parseBody(linkEntitySchema, await readJson(req));
  const entity = await linkEntityToGroup(user, id, input.groupId, input.version);
  return { id: entity.id, groupId: entity.groupId };
});
