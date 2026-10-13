import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { correctTimesSchema } from "@/lib/validation/issues";
import { correctIssueTimes } from "@/server/services/issue-times";

// Times rule 5, "Correct times". Owner only; linked issues take their times from the partner issue.
export const POST = handle("issue.correctTimes", async (req: Request, { params }: { params: Promise<{ issueId: string }> }) => {
  const { issueId } = await params;
  const user = await getCurrentUser();
  const input = parseBody(correctTimesSchema, await readJson(req));
  return correctIssueTimes(user, issueId, input);
});
