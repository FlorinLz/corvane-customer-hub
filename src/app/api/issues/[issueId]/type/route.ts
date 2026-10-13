import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { changeTypeSchema } from "@/lib/validation/issues";
import { changeType } from "@/server/services/issue";

// Brief 3.8.x, M19 AC17-AC20. Owner only; no UI yet (milestone 6B builds the dialog).
export const POST = handle("issue.changeType", async (req: Request, { params }: { params: Promise<{ issueId: string }> }) => {
  const { issueId } = await params;
  const user = await getCurrentUser();
  const input = parseBody(changeTypeSchema, await readJson(req));
  const issue = await changeType(user, issueId, input);
  return { id: issue.id, number: issue.number, type: issue.type, severity: issue.severity, ownerId: issue.ownerId, ownerTeam: issue.ownerTeam };
});
