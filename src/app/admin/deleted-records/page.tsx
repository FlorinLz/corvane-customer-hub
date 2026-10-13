import Link from "next/link";

import { AdminAccessDenied } from "@/components/shell/AdminAccessDenied";
import { Badge } from "@/components/ui/badge";
import { ReactivateAction } from "@/components/entity/ReactivateAction";
import { formatDate } from "@/lib/dates";
import { loadDeletedRecords } from "@/server/queries/deleted-records";
import { can } from "@/server/permissions/can";
import { getCurrentUser } from "@/server/session";

// Brief 6.12.2, M16 AC12. R1: list + Reactivate (blocked by guard 5); R2
// adds the reused-LEI dialog and search.
export default async function DeletedRecordsPage() {
  const user = await getCurrentUser();
  if (!can(user, "admin.deleted.read").ok) return <AdminAccessDenied />;

  const records = await loadDeletedRecords();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-page">Deleted records</h1>

      {records.length === 0 ? (
        <p className="text-meta text-text-secondary">No deleted records.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full min-w-[900px] text-left text-meta">
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th className="px-3 py-2">Entity name</th>
                <th className="px-3 py-2">LEI</th>
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2">Roles</th>
                <th className="px-3 py-2">Deleted by</th>
                <th className="px-3 py-2">Deleted at</th>
                <th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {records.map((e) => (
                <tr key={e.id} className="border-b border-border align-top last:border-b-0">
                  <td className="px-3 py-2">
                    <Link href={`/entities/${e.id}/overview`} className="font-medium text-link-text hover:underline">
                      {e.legalName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono">{e.lei ?? "—"}</td>
                  <td className="px-3 py-2">{e.country ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {e.customerRole?.active && <Badge variant="selected">Customer</Badge>}
                      {e.partnerRole?.active && <Badge variant="selected">Network partner</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-2">{e.deletedBy?.name ?? "—"}</td>
                  <td className="px-3 py-2">{e.deletedAt ? formatDate(e.deletedAt.toISOString().slice(0, 10)) : "—"}</td>
                  <td className="max-w-[260px] px-3 py-2">{e.deleteReason ?? "—"}</td>
                  <td className="px-3 py-2">
                    <ReactivateAction entityId={e.id} legalName={e.legalName} blockedMessage={e.reactivateBlockedMessage} triggerVariant="secondary" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
