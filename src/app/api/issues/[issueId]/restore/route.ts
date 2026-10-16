import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { restoreIssueSchema } from "@/lib/validation/issues";
import { recordServiceRestored } from "@/server/services/issue";

// The deadline model. Owner only: record when the service was restored, with a short note.
export const POST = handle("issue.restore", async (req: Request, { params }: { params: Promise<{ issueId: string }> }) => {
  const { issueId } = await params;
  const user = await getCurrentUser();
  const input = parseBody(restoreIssueSchema, await readJson(req));
  const issue = await recordServiceRestored(user, issueId, input);
  return { id: issue.id, version: issue.version, restoredAt: issue.restoredAt };
});
