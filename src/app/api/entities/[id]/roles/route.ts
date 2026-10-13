import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { setRolesSchema } from "@/lib/validation/roles";
import { setRoles } from "@/server/services/roles";
import { assertCan } from "@/server/permissions/guard";

// Brief 3.8.2 "Set roles", M4 AC7 (part), AC14. Ops; R1 is add-only.
export const PUT = handle("entity.roles", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getCurrentUser();
  assertCan(user, "entity.roles.edit"); // brief 3.1.3 step 3 before step 4: permission before body validation
  const input = parseBody(setRolesSchema, await readJson(req));
  const entity = await setRoles(user, id, input);
  return { id: entity.id };
});
