import type { ContactContext, ContactRole } from "@prisma/client";

import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { addContactSchema } from "@/lib/validation/contact";
import { addContact } from "@/server/services/contact";
import { contactDataArea } from "@/server/derived/contact-ownership";
import { assertCan } from "@/server/permissions/guard";

// Brief 3.8.2 "Add contact", M7 AC1-AC4, AC12, AC14, AC15.
export const POST = handle("entity.contacts.add", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getCurrentUser();
  const raw = (await readJson(req)) as { context?: string; role?: string };
  // Permission check before full body validation (brief 3.1.3 step 3
  // before step 4): the contact's area comes from the requested
  // (context, role), read straight off the raw body — a forged caller's
  // request is never let through to validation just because it's
  // missing a conditionally-required field (e.g. an Incident contact's
  // phone), which would otherwise leak a 400 instead of the correct 403.
  assertCan(user, "contact.add", { area: contactDataArea(raw.context as ContactContext, raw.role as ContactRole) });
  const input = parseBody(addContactSchema, raw);
  const contact = await addContact(user, id, input);
  return { id: contact.id };
});
