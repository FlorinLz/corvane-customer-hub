import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { changeStageSchema } from "@/lib/validation/stage";
import { changeStage } from "@/server/services/stage";
import { assertCan } from "@/server/permissions/guard";

// Brief 3.8.2 "Change stage", M6 AC4-AC6, AC9, AC11, AC12, AC16, AC17.
export const POST = handle("product.stage", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getCurrentUser();
  assertCan(user, "product.stage.change");
  const input = parseBody(changeStageSchema, await readJson(req));
  return changeStage(user, id, input);
});
