import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { acceptOpsToCs } from "@/server/services/handoff";

// Brief 3.8.2 "Accept", M8 AC11. The named CSM only.
export const POST = handle("handoffs.accept", async (_req: Request, { params }: { params: Promise<{ handoffId: string }> }) => {
  const { handoffId } = await params;
  const user = await getCurrentUser();
  const handoff = await acceptOpsToCs(user, handoffId);
  return { id: handoff.id, status: handoff.status };
});
