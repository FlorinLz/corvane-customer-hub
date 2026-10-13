import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { addIssueNoteSchema } from "@/lib/validation/issues";
import { addIssueNote } from "@/server/services/issue";

// Brief 3.8.3, M21 AC7. Any active user of the 6 teams.
export const POST = handle("issue.addNote", async (req: Request, { params }: { params: Promise<{ issueId: string }> }) => {
  const { issueId } = await params;
  const user = await getCurrentUser();
  const input = parseBody(addIssueNoteSchema, await readJson(req));
  const issue = await addIssueNote(user, issueId, input);
  return { id: issue.id };
});
