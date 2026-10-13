import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { editDescriptionSchema } from "@/lib/validation/issues";
import { editIssueDescription } from "@/server/services/issue";

// Brief 3.8.3, M17 AC11-AC13. Reporter only, while New.
export const PATCH = handle("issue.editDescription", async (req: Request, { params }: { params: Promise<{ issueId: string }> }) => {
  const { issueId } = await params;
  const user = await getCurrentUser();
  const input = parseBody(editDescriptionSchema, await readJson(req));
  const issue = await editIssueDescription(user, issueId, input);
  return { id: issue.id, description: issue.description, version: issue.version };
});
