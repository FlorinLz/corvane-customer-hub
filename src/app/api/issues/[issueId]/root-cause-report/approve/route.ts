import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { approveReportSchema } from "@/lib/validation/issues";
import { approveReport } from "@/server/services/root-cause-report";

// Compliance approves the root cause report before the owner sends it. Any Compliance-team user (403 for everyone else).
export const POST = handle("issue.approveRootCauseReport", async (req: Request, { params }: { params: Promise<{ issueId: string }> }) => {
  const { issueId } = await params;
  const user = await getCurrentUser();
  const input = parseBody(approveReportSchema, await readJson(req));
  const issue = await approveReport(user, issueId, input);
  return { id: issue.id };
});
