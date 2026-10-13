import { handle } from "@/server/http";
import { NotFoundError } from "@/server/errors";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { verifyContactSchema } from "@/lib/validation/contact";
import { verifyContact } from "@/server/services/contact";
import { contactDataArea } from "@/server/derived/contact-ownership";
import { assertCan } from "@/server/permissions/guard";
import { db } from "@/server/db";

// Brief 3.8.2 "Mark as verified", M7 AC5, AC15.
export const POST = handle("contacts.verify", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getCurrentUser();
  const existing = await db.contact.findUnique({ where: { id }, select: { context: true, role: true } });
  if (!existing) throw new NotFoundError();
  assertCan(user, "contact.verify", { area: contactDataArea(existing.context, existing.role) });
  const input = parseBody(verifyContactSchema, await readJson(req));
  return verifyContact(user, id, input);
});
