import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { changeStatusSchema } from "@/lib/validation/issues";
import { changeIssueStatus } from "@/server/services/issue";

// Brief 3.8.3, M21 AC2, AC3, AC5. Owner only, acknowledged. "Resolved" has its own route.
export const POST = handle("issue.changeStatus", async (req: Request, { params }: { params: Promise<{ issueId: string }> }) => {
  const { issueId } = await params;
  const user = await getCurrentUser();
  const input = parseBody(changeStatusSchema, await readJson(req));
  const issue = await changeIssueStatus(user, issueId, input);
  return { id: issue.id, status: issue.status, version: issue.version };
});
