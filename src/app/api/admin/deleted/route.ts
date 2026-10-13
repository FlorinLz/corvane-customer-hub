import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { assertCan } from "@/server/permissions/guard";
import { loadDeletedRecords } from "@/server/queries/deleted-records";

// Brief 3.8.1 "GET /api/admin/deleted?q=", M16 AC12. Admin only; others 403.
// R1: no `q` search filter yet (6.12.2 lists it, but the page itself has
// no search box this milestone).
export const GET = handle("admin.deleted.list", async () => {
  const user = await getCurrentUser();
  assertCan(user, "admin.deleted.read");
  return loadDeletedRecords();
});
