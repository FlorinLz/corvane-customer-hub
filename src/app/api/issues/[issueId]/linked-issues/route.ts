import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { createLinkedIssuesSchema } from "@/lib/validation/issues";
import { createLinkedIssues } from "@/server/services/issue-partner";

// Brief 3.8.3, M23 AC7, AC8. Owner of the partner issue only.
export const POST = handle("issue.owner", async (req: Request, { params }: { params: Promise<{ issueId: string }> }) => {
  const { issueId } = await params;
  const user = await getCurrentUser();
  const input = parseBody(createLinkedIssuesSchema, await readJson(req));
  const created = await createLinkedIssues(user, issueId, input);
  return { created };
});
