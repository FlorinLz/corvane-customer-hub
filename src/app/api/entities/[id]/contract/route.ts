import { z } from "zod";

import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { attachContractSchema } from "@/lib/validation/contract";
import { attachContract } from "@/server/services/contract";
import { assertCan } from "@/server/permissions/guard";

const bodySchema = attachContractSchema.and(z.object({ version: z.number().int() }));

// Brief 3.8.2 "Attach or replace contract", M4 AC9, AC10, AC13, AC14, D1.
export const PUT = handle("entity.contract.attach", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await getCurrentUser();
  assertCan(user, "entity.contract.attach");
  const input = parseBody(bodySchema, await readJson(req));
  const contract = await attachContract(user, id, input, input.version);
  return { id: contract.id, contractId: contract.contractId };
});
