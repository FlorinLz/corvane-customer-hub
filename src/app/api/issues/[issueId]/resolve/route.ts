import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { resolveIssueSchema } from "@/lib/validation/issues";
import { resolveIssue } from "@/server/services/issue";

// Brief 3.8.3, M21 AC4. Owner only.
export const POST = handle("issue.resolve", async (req: Request, { params }: { params: Promise<{ issueId: string }> }) => {
  const { issueId } = await params;
  const user = await getCurrentUser();
  const input = parseBody(resolveIssueSchema, await readJson(req));
  const issue = await resolveIssue(user, issueId, input);
  return { id: issue.id, status: issue.status, version: issue.version, resolvedAt: issue.resolvedAt };
});
