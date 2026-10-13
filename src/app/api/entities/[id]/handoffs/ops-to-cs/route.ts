import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { sendOpsToCsSchema } from "@/lib/validation/handoff";
import { sendOpsToCs } from "@/server/services/handoff";

// Brief 3.8.2 "Hand over to Customer Success", M8 AC1-AC9. Any active Ops user.
export const POST = handle("entities.handoffs.opsToCs", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getCurrentUser();
  const input = parseBody(sendOpsToCsSchema, await readJson(req));
  return sendOpsToCs(user, id, input);
});
