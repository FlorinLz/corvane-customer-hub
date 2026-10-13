import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { confirmPickup } from "@/server/services/handoff";

// Brief 3.8.2 "Confirm pickup", M3 AC12. The named Onboarding Manager only.
export const POST = handle("handoffs.confirmPickup", async (_req: Request, { params }: { params: Promise<{ handoffId: string }> }) => {
  const { handoffId } = await params;
  const user = await getCurrentUser();
  const handoff = await confirmPickup(user, handoffId);
  return { id: handoff.id, status: handoff.status };
});
