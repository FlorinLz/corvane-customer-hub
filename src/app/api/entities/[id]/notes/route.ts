import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { addNoteSchema } from "@/lib/validation/note";
import { addNote } from "@/server/services/note";

// Brief 3.8.2 "Add note", M10 AC1-AC4, M16 AC1. All teams.
export const POST = handle("entity.notes.add", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getCurrentUser();
  const input = parseBody(addNoteSchema, await readJson(req));
  const note = await addNote(user, id, input);
  return { id: note.id };
});
