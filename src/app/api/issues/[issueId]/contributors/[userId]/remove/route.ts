import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { removeContributorSchema } from "@/lib/validation/issues";
import { removeContributor } from "@/server/services/issue";

// Brief 3.8.3, M21 AC6. Owner only.
export const POST = handle("issue.removeContributor", async (req: Request, { params }: { params: Promise<{ issueId: string; userId: string }> }) => {
  const { issueId, userId } = await params;
  const user = await getCurrentUser();
  const input = parseBody(removeContributorSchema, await readJson(req));
  const issue = await removeContributor(user, issueId, userId, input);
  return { id: issue.id };
});
