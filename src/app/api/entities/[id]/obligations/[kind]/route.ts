import { ObligationCardKind } from "@prisma/client";

import { handle } from "@/server/http";
import { NotFoundError } from "@/server/errors";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { obligationsSchema } from "@/lib/validation/obligations";
import { saveObligations } from "@/server/services/obligations";
import { assertCan } from "@/server/permissions/guard";

// Brief 3.8.2 "Save obligations", M13 AC2-AC6, AC14. Compliance.
export const PUT = handle(
  "entity.obligations",
  async (req: Request, { params }: { params: Promise<{ id: string; kind: string }> }) => {
    const { id, kind } = await params;
    if (!Object.values(ObligationCardKind).includes(kind as ObligationCardKind)) throw new NotFoundError();
    const user = await getCurrentUser();
    assertCan(user, "compliance.obligations.edit");
    const input = parseBody(obligationsSchema, await readJson(req));
    const card = await saveObligations(user, id, kind as ObligationCardKind, input);
    return { id: card.id };
  },
);
