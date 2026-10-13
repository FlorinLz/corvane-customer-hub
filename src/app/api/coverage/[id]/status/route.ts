import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { changeCoverageStatusSchema } from "@/lib/validation/coverage";
import { changeCoverageStatus } from "@/server/services/coverage";
import { assertCan } from "@/server/permissions/guard";

// Brief 3.8.2 "Change coverage status", M5 AC7-AC9, AC12, AC14, AC15, AC17.
export const POST = handle("coverage.status", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getCurrentUser();
  assertCan(user, "partner.coverage.changeStatus");
  const input = parseBody(changeCoverageStatusSchema, await readJson(req));
  return changeCoverageStatus(user, id, input);
});
