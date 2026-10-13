import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { assertCan } from "@/server/permissions/guard";
import { PERMISSION_MATRIX } from "@/server/permissions/matrix";

// Brief 3.8.1 "GET /api/admin/permissions", M15 AC13. Compliance, admin; others 403.
export const GET = handle("admin.permissions.list", async () => {
  const user = await getCurrentUser();
  assertCan(user, "admin.permissions.read");
  return PERMISSION_MATRIX;
});
