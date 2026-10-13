import { handle } from "@/server/http";
import { NotFoundError } from "@/server/errors";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { verifyLicenceSchema } from "@/lib/validation/kyb";
import { verifyLicence } from "@/server/services/kyb";
import { assertCan } from "@/server/permissions/guard";

// Brief 3.8.2 "Save KYB check", M12 AC2-AC10, AC13, AC14. Compliance.
// M5 R1 implements the Licence check only; Ownership/Sanctions are R2.
export const PUT = handle(
  "entity.kyb",
  async (req: Request, { params }: { params: Promise<{ id: string; type: string }> }) => {
    const { id, type } = await params;
    if (type !== "LICENCE") throw new NotFoundError();
    const user = await getCurrentUser();
    assertCan(user, "compliance.kyb.edit");
    const input = parseBody(verifyLicenceSchema, await readJson(req));
    const check = await verifyLicence(user, id, input);
    return { id: check.id };
  },
);
