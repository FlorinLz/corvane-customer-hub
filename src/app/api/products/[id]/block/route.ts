import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { setBlockSchema } from "@/lib/validation/block";
import { setBlock } from "@/server/services/block";
import { assertCan } from "@/server/permissions/guard";

// Brief 3.8.2 "Set or edit block", M6 AC7, AC8.
export const PUT = handle("product.block", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getCurrentUser();
  assertCan(user, "product.block.edit");
  const input = parseBody(setBlockSchema, await readJson(req));
  return setBlock(user, id, input);
});
