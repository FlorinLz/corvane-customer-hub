import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { requestChangesSchema } from "@/lib/validation/issues";
import { requestChanges } from "@/server/services/root-cause-report";

// Root cause report: Compliance asks for changes (any Compliance-team user, 403 for everyone else).
export const POST = handle("issue.requestReportChanges", async (req: Request, { params }: { params: Promise<{ issueId: string }> }) => {
  const { issueId } = await params;
  const user = await getCurrentUser();
  const input = parseBody(requestChangesSchema, await readJson(req));
  const issue = await requestChanges(user, issueId, input);
  return { id: issue.id };
});
