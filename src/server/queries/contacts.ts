import { cache } from "react";

import { db } from "@/server/db";
import { loadEntityCore } from "@/server/queries/entity-core";

export const loadContactsData = cache(async (id: string) => {
  const entity = await loadEntityCore(id);
  if (!entity) return null;

  const contacts = await db.contact.findMany({
    where: { entityId: id },
    include: { lastVerifiedBy: { select: { name: true } } },
    orderBy: [{ isPrimary: "desc" }, { lastVerifiedAt: "desc" }],
  });

  return { entity, contacts };
});

export type ContactsData = NonNullable<Awaited<ReturnType<typeof loadContactsData>>>;

/** Brief 3.4.2 "Note / Participants": active contacts of this entity, for the note drawer's "Contacts" picker. */
export const loadActiveContactNames = cache(async (entityId: string) => {
  return db.contact.findMany({ where: { entityId, status: "ACTIVE" }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } });
});
