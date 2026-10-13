import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { shareDraftSchema } from "@/lib/validation/issues";
import { shareDraft } from "@/server/services/root-cause-report";

// Root cause report: the owner shares a draft (owner only).
export const POST = handle("issue.shareReportDraft", async (req: Request, { params }: { params: Promise<{ issueId: string }> }) => {
  const { issueId } = await params;
  const user = await getCurrentUser();
  const input = parseBody(shareDraftSchema, await readJson(req));
  const issue = await shareDraft(user, issueId, input);
  return { id: issue.id };
});
