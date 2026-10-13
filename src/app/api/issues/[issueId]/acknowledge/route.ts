import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { acknowledgeIssueSchema } from "@/lib/validation/issues";
import { acknowledgeIssue } from "@/server/services/issue";

// Brief 3.8.3, M21 AC1. Owner only, status New.
export const POST = handle("issue.acknowledge", async (req: Request, { params }: { params: Promise<{ issueId: string }> }) => {
  const { issueId } = await params;
  const user = await getCurrentUser();
  const input = parseBody(acknowledgeIssueSchema, await readJson(req));
  const issue = await acknowledgeIssue(user, issueId, input);
  return { id: issue.id, status: issue.status, version: issue.version, acknowledgedAt: issue.acknowledgedAt };
});
