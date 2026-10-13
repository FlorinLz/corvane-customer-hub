import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { addReportToExistingSchema } from "@/lib/validation/issues";
import { addReportToExistingIssue } from "@/server/services/issue";
import { issueDisplayId } from "@/lib/labels";

// Brief 3.8.3, M17 AC6. Any active user; "Add to existing issue".
export const POST = handle("issue.addReport", async (req: Request, { params }: { params: Promise<{ issueId: string }> }) => {
  const { issueId } = await params;
  const user = await getCurrentUser();
  const input = parseBody(addReportToExistingSchema, await readJson(req));
  const issue = await addReportToExistingIssue(user, issueId, input);
  return { id: issue.id, number: issue.number, displayId: issueDisplayId(issue.number) };
});
