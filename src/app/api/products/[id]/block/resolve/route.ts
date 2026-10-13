import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { resolveBlockSchema } from "@/lib/validation/block";
import { resolveBlock } from "@/server/services/block";
import { assertCan } from "@/server/permissions/guard";

// Brief 3.8.2 "Resolve block", M6 AC8.
export const POST = handle("product.block.resolve", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getCurrentUser();
  assertCan(user, "product.block.edit");
  const input = parseBody(resolveBlockSchema, await readJson(req));
  return resolveBlock(user, id, input);
});
