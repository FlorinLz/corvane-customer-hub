import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { assertCan } from "@/server/permissions/guard";
import { readJson } from "@/server/validate";
import { now } from "@/lib/dates";
import { normaliseLei, isValidLei } from "@/lib/validation/lei";
import { lookupLei } from "@/server/gleif/client";
import { mapGleifToEntityFields, gleifParentForGroup } from "@/server/gleif/map";
import { db } from "@/server/db";
import { ValidationError } from "@/server/errors";

// New customer wizard step 1, brief 3.5.2/3.5.3/3.5.4 plus the group
// suggestion rule (ultimateParent.lei, falling back to directParent.lei,
// against Group.parentLei — brief ~line 1667). No existing entity yet, so
// this is a standalone lookup endpoint distinct from
// /api/entities/{id}/gleif-refresh.
export const POST = handle("gleif.lookup", async (req: Request) => {
  const user = await getCurrentUser();
  assertCan(user, "customer.create");
  const { lei: rawLei } = (await readJson(req)) as { lei: string };
  const lei = normaliseLei(rawLei ?? "");
  if (!isValidLei(lei)) {
    throw new ValidationError({ lei: ["LEI must be 20 letters or digits and pass the ISO 17442 check"] });
  }

  const lookup = await lookupLei(lei);
  const checkedAt = now();
  const fields = mapGleifToEntityFields(lookup, checkedAt);
  const parentFields = gleifParentForGroup(lookup, checkedAt);

  let groupSuggestion: { id: string; name: string } | null = null;
  if (parentFields.parentLei) {
    const group = await db.group.findFirst({ where: { parentLei: parentFields.parentLei }, select: { id: true, name: true } });
    if (group) groupSuggestion = group;
  }

  return {
    kind: lookup.kind,
    source: lookup.kind === "found" ? lookup.source : null,
    fetchedAt: lookup.kind === "found" ? lookup.fetchedAt : null,
    record: lookup.kind === "found" ? lookup.record : null,
    fields,
    groupSuggestion,
    parentLegalName: parentFields.parentLegalName,
  };
}, { writes: false });
