import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { changeSeveritySchema } from "@/lib/validation/issues";
import { changeSeverity } from "@/server/services/issue";

// Brief 3.8.x, M19 AC13-AC15, AC19, AC20. Owner only; no UI yet (milestone 6B builds the dialog).
export const POST = handle("issue.changeSeverity", async (req: Request, { params }: { params: Promise<{ issueId: string }> }) => {
  const { issueId } = await params;
  const user = await getCurrentUser();
  const input = parseBody(changeSeveritySchema, await readJson(req));
  const issue = await changeSeverity(user, issueId, input);
  return { id: issue.id, number: issue.number, severity: issue.severity, reviewSeverityNote: issue.reviewSeverityNote, linkedIssues: issue.linkedIssues };
});
