import { Lock } from "lucide-react";

import { AccessMessage } from "@/components/shell/AccessMessage";

/**
 * Brief 5.2 "No access to Admin" [403]: triggered when a non-admin opens
 * /admin/users or /admin/deleted-records, or a team other than Compliance
 * (and not the admin) opens /admin/roles-permissions.
 */
export function AdminAccessDenied() {
  return (
    <AccessMessage
      icon={Lock}
      message="You don't have access to Admin. Ask Adrian Koh (Ops)."
      actions={[{ label: "Go to Home", href: "/", variant: "secondary" }]}
    />
  );
}
