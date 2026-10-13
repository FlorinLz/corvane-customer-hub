import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { unlinkEntitySchema } from "@/lib/validation/group-link";
import { unlinkEntityFromGroup } from "@/server/services/group-link";
import { assertCan } from "@/server/permissions/guard";

// Brief 3.8.2 "Unlink entity", M4 AC5, AC13. Ops.
export const DELETE = handle(
  "group.members.unlink",
  async (req: Request, { params }: { params: Promise<{ id: string; entityId: string }> }) => {
    const { id, entityId } = await params;
    const user = await getCurrentUser();
    assertCan(user, "entity.group.edit");
    const input = parseBody(unlinkEntitySchema, await readJson(req));
    const entity = await unlinkEntityFromGroup(user, id, entityId, input.version);
    return { id: entity.id };
  },
);
