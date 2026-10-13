import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { unlinkIssueSchema } from "@/lib/validation/issues";
import { unlinkIssue } from "@/server/services/issue-partner";

// Brief 3.8.3, M23 AC14. Owner of the partner issue only.
export const POST = handle("issue.owner", async (req: Request, { params }: { params: Promise<{ linkId: string }> }) => {
  const { linkId } = await params;
  const user = await getCurrentUser();
  const input = parseBody(unlinkIssueSchema, await readJson(req));
  await unlinkIssue(user, linkId, input);
  return { ok: true };
});
