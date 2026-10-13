import { Lock } from "lucide-react";

import { AccessMessage } from "@/components/shell/AccessMessage";
import { NewCustomerWizard } from "@/components/customer-wizard/NewCustomerWizard";
import { COUNTRIES, SEPA_COUNTRIES } from "@/server/config";
import { loadGroupOptions } from "@/server/queries/group";
import { loadOpsUsers } from "@/server/queries/users";
import { effectiveTimeZone } from "@/lib/time-zones";
import { can } from "@/server/permissions/can";
import { getCurrentUser } from "@/server/session";

/**
 * Brief 5.5 "New customer wizard", R1 (wizard steps 1-4). 4.1.2 S3: Sales
 * only, everyone else keeps the "Only Sales can create a customer
 * record" message built in milestone 1.
 */
export default async function NewCustomerPage() {
  const user = await getCurrentUser();

  if (!can(user, "customer.create").ok) {
    return (
      <AccessMessage
        icon={Lock}
        message="Only Sales can create a customer record"
        actions={[{ label: "Go to search", href: "/search", variant: "secondary" }]}
      />
    );
  }

  const [groups, opsUsers] = await Promise.all([loadGroupOptions(), loadOpsUsers()]);

  return (
    <NewCustomerWizard
      countries={COUNTRIES}
      sepaCountries={SEPA_COUNTRIES}
      groups={groups}
      opsUsers={opsUsers}
      isAdmin={user.isAdmin}
      zone={effectiveTimeZone(user)}
    />
  );
}
