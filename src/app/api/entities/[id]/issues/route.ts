import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { reportIssueSchema } from "@/lib/validation/issues";
import { createIssue } from "@/server/services/issue";
import { issueDisplayId } from "@/lib/labels";

// Brief 3.8.3, M17. Any active user of the 6 teams; no UI yet (milestone 6B
// builds the report form/panel).
export const POST = handle("issue.report", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getCurrentUser();
  const input = parseBody(reportIssueSchema, await readJson(req));
  const issue = await createIssue(user, id, input);
  return { id: issue.id, number: issue.number, displayId: issueDisplayId(issue.number), ownerId: issue.ownerId, ownerTeam: issue.ownerTeam };
});
