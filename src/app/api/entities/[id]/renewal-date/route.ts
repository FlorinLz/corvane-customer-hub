import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { renewalDateSchema } from "@/lib/validation/renewal-date";
import { setRenewalDate } from "@/server/services/renewal-date";
import { assertCan } from "@/server/permissions/guard";

// Brief 3.8.2 "Renewal date", S4.9, M15 AC3, M11 AC11. CS.
export const PUT = handle("entity.renewalDate", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getCurrentUser();
  assertCan(user, "customer.renewalDate.edit");
  const input = parseBody(renewalDateSchema, await readJson(req));
  const role = await setRenewalDate(user, id, input);
  return { renewalDate: role.renewalDate };
});
