import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { recordCommunicationSchema } from "@/lib/validation/issues";
import { recordCommunication } from "@/server/services/issue-communication";

// Brief 3.8.3, M22 AC6, AC7, AC13, AC19. Effective communicator only.
export const POST = handle("issue.recordCommunication", async (req: Request, { params }: { params: Promise<{ issueId: string }> }) => {
  const { issueId } = await params;
  const user = await getCurrentUser();
  const input = parseBody(recordCommunicationSchema, await readJson(req));
  const communication = await recordCommunication(user, issueId, input);
  return { id: communication.id };
});
