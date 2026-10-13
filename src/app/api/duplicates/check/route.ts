import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { assertCan } from "@/server/permissions/guard";
import { readJson } from "@/server/validate";
import { checkDuplicates, type DuplicateCheckInput } from "@/server/duplicates";

// Brief 3.6 "Duplicate check", POST /api/duplicates/check. Triggered from
// the New customer wizard step 1 (M2 AC9). The Details-tab trigger when
// Ops edits LEI/BICs/legal name/aliases (resolution 54) is out of this
// milestone's scope; the customer.create gate below will need loosening
// when that's built (see DECISIONS.md).
export const POST = handle("duplicates.check", async (req: Request) => {
  const user = await getCurrentUser();
  assertCan(user, "customer.create");
  const body = (await readJson(req)) as DuplicateCheckInput;
  return checkDuplicates(body);
});
