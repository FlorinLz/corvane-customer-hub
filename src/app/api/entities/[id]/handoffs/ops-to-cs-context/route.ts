import { NotFoundError } from "@/server/errors";
import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { loadOpsToCsContext } from "@/server/queries/handoff-ops-to-cs-context";

// On-demand context for the Ops -> CS send drawer (S6 View B), fetched
// only when it opens -- same precedent as 6B's issue-context route.
export const GET = handle("entities.handoffs.opsToCsContext", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await getCurrentUser();
  const { id } = await params;
  const context = await loadOpsToCsContext(id);
  if (!context) throw new NotFoundError();
  return context;
});
