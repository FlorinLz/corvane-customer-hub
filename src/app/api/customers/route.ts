import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { parseBody, readJson } from "@/server/validate";
import { COUNTRIES, SEPA_COUNTRIES } from "@/server/config";
import { createCustomerSchema } from "@/lib/validation/customer-wizard";
import { createCustomer } from "@/server/services/customer";

const validBicCountryCodes = new Set(COUNTRIES.map((c) => c.code));

// Brief 3.8.2 "Create customer", POST /api/customers. Sales.
export const POST = handle("customers.create", async (req: Request) => {
  const user = await getCurrentUser();
  const schema = createCustomerSchema({ validBicCountryCodes, sepaCountries: SEPA_COUNTRIES });
  const input = parseBody(schema, await readJson(req));
  return createCustomer(user, input);
});
