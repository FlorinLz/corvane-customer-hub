import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { recordReportSentSchema } from "@/lib/validation/issues";
import { recordReportSent } from "@/server/services/root-cause-report";

// M27 AC5. Issue owner only (403 for anyone else).
export const POST = handle("issue.rootCauseReport", async (req: Request, { params }: { params: Promise<{ issueId: string }> }) => {
  const { issueId } = await params;
  const user = await getCurrentUser();
  const input = parseBody(recordReportSentSchema, await readJson(req));
  const issue = await recordReportSent(user, issueId, input);
  return { id: issue.id, version: issue.version };
});
