import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { acknowledgeAssignment } from "@/server/services/owner";

// Brief 3.8.2 "Acknowledge assignment", M9 AC10. The assignee only.
export const POST = handle("ownerAssignments.acknowledge", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getCurrentUser();
  const assignment = await acknowledgeAssignment(user, id);
  return { id: assignment.id, acknowledgedAt: assignment.acknowledgedAt };
});
