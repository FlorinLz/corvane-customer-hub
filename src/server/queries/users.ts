import { cache } from "react";

import { db } from "@/server/db";

/** Brief 3.4.2 "Note / Participants": active users (any team), for the note drawer's "Colleagues" picker and action-item owners. */
export const loadActiveUsers = cache(async () => {
  return db.user.findMany({ where: { active: true }, select: { id: true, name: true, team: true }, orderBy: { name: "asc" } });
});

/** Brief 5.5 step 4 "Onboarding Manager": active Ops users for the New customer wizard's picker. */
export const loadOpsUsers = cache(async () => {
  return db.user.findMany({ where: { active: true, team: "OPS" }, select: { id: true, name: true }, orderBy: { name: "asc" } });
});
