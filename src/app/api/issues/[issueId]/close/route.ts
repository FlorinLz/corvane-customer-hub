import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { closeIssueSchema } from "@/lib/validation/issues";
import { closeIssue } from "@/server/services/issue-communication";

// Brief 3.8.3, M22 AC11, AC12. Communicator only, status Resolved.
export const POST = handle("issue.close", async (req: Request, { params }: { params: Promise<{ issueId: string }> }) => {
  const { issueId } = await params;
  const user = await getCurrentUser();
  const input = parseBody(closeIssueSchema, await readJson(req));
  const issue = await closeIssue(user, issueId, input);
  return { id: issue.id, status: issue.status, version: issue.version, closedAt: issue.closedAt };
});
