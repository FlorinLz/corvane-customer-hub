import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { addContributorSchema } from "@/lib/validation/issues";
import { addContributor } from "@/server/services/issue";

// Brief 3.8.3, M21 AC6. Owner only.
export const POST = handle("issue.addContributor", async (req: Request, { params }: { params: Promise<{ issueId: string }> }) => {
  const { issueId } = await params;
  const user = await getCurrentUser();
  const input = parseBody(addContributorSchema, await readJson(req));
  const issue = await addContributor(user, issueId, input);
  return { id: issue.id };
});
