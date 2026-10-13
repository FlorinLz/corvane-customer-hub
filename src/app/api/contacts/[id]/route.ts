import { handle } from "@/server/http";
import { NotFoundError } from "@/server/errors";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { editContactSchema } from "@/lib/validation/contact";
import { editContact } from "@/server/services/contact";
import { contactDataArea } from "@/server/derived/contact-ownership";
import { assertCan } from "@/server/permissions/guard";
import { db } from "@/server/db";

// Brief 3.8.2 "Edit contact", M7 AC3, AC14, AC15, edge case 6.
export const PATCH = handle("contacts.edit", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getCurrentUser();
  // Permission check before body validation (brief 3.1.3 step 3 before
  // step 4) — the contact's CURRENT (context, role) gates the edit.
  const existing = await db.contact.findUnique({ where: { id }, select: { context: true, role: true } });
  if (!existing) throw new NotFoundError();
  assertCan(user, "contact.edit", { area: contactDataArea(existing.context, existing.role) });
  const input = parseBody(editContactSchema, await readJson(req));
  return editContact(user, id, input);
});
