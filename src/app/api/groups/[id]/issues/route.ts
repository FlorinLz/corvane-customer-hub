import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { reportGroupIssueSchema } from "@/lib/validation/issues";
import { createGroupIssues } from "@/server/services/issue";
import { issueDisplayId } from "@/lib/labels";

// Brief M17 AC4, 4.9.2 rule 8. No UI yet (milestone 6B).
export const POST = handle("issue.report.group", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getCurrentUser();
  const input = parseBody(reportGroupIssueSchema, await readJson(req));
  const issues = await createGroupIssues(user, id, input);
  return issues.map((issue) => ({ id: issue.id, number: issue.number, displayId: issueDisplayId(issue.number) }));
});
