import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { reassignIssueSchema } from "@/lib/validation/issues";
import { reassignIssue } from "@/server/services/issue";

// Brief 3.8.3, M21 AC8-AC10. Owner only, new owner within the owner team.
export const POST = handle("issue.reassign", async (req: Request, { params }: { params: Promise<{ issueId: string }> }) => {
  const { issueId } = await params;
  const user = await getCurrentUser();
  const input = parseBody(reassignIssueSchema, await readJson(req));
  const result = await reassignIssue(user, issueId, input);
  return { id: result.id, ownerId: result.ownerId, version: result.version, outsideHours: result.outsideHours, outsideHoursText: result.outsideHoursText };
});
