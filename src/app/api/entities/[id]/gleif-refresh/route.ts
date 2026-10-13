import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { refreshGleif } from "@/server/services/gleif-refresh";

// Brief 3.8.2 "Retry or refresh GLEIF", M2 error state, M12 AC3, AC14.
export const POST = handle("entity.gleifRefresh", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getCurrentUser();
  return refreshGleif(user, id);
});
