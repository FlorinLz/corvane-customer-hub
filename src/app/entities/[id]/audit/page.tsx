import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";

import { AccessMessage } from "@/components/shell/AccessMessage";
import { effectiveTimeZone, formatDateTime } from "@/lib/time-zones";
import { TEAM_LABELS } from "@/lib/labels";
import { loadEntityCore } from "@/server/queries/entity-core";
import { loadAuditPage } from "@/server/queries/audit";
import { can } from "@/server/permissions/can";
import { getCurrentUser } from "@/server/session";

export default async function AuditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const [entity, user] = await Promise.all([loadEntityCore(id), getCurrentUser()]);
  if (!entity) notFound();

  const decision = can(user, "audit.read", { entity: { deletedAt: entity.deletedAt } });
  if (!decision.ok) {
    return (
      <AccessMessage
        icon={Lock}
        message="The audit log is visible to Compliance and the admin."
        actions={[{ label: "Open the Overview", href: `/entities/${id}/overview`, variant: "secondary" }]}
      />
    );
  }

  const { entries, hasMore } = await loadAuditPage(id, page);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-page">Audit</h2>
        <span className="text-meta text-text-secondary">Immutable log of every field change. Read-only.</span>
      </div>

      {entries.length === 0 ? (
        <p className="text-meta text-text-secondary">No changes recorded yet.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="w-full min-w-[900px] text-left text-meta">
              <thead>
                <tr className="border-b border-border text-text-secondary">
                  <th className="px-2.5 py-2">Timestamp</th>
                  <th className="px-2.5 py-2">Object</th>
                  <th className="px-2.5 py-2">Field</th>
                  <th className="px-2.5 py-2">Old value</th>
                  <th className="px-2.5 py-2">New value</th>
                  <th className="px-2.5 py-2">User</th>
                  <th className="px-2.5 py-2">Team</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id.toString()} className="border-b border-border align-top last:border-b-0">
                    <td className="whitespace-nowrap px-2.5 py-2">{formatDateTime(e.createdAt, effectiveTimeZone(user))}</td>
                    <td className="px-2.5 py-2">
                      {e.objectLabel}
                      {e.objectLabel === "Record status" && e.reason && <p className="text-text-secondary">{e.reason}</p>}
                    </td>
                    <td className="px-2.5 py-2">{e.field}</td>
                    <td className="max-w-[240px] truncate px-2.5 py-2">{e.oldValue ?? "(none)"}</td>
                    <td className="max-w-[240px] truncate px-2.5 py-2">{e.newValue ?? "(removed)"}</td>
                    <td className="px-2.5 py-2">{e.source === "SYSTEM_GLEIF" ? `System (GLEIF), requested by ${e.userName}` : (e.user?.name ?? e.userName)}</td>
                    <td className="px-2.5 py-2">{e.userTeam ? TEAM_LABELS[e.userTeam] : "(system)"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <Link href={`?page=${page + 1}`} className="self-start text-meta text-link-text hover:underline">
              Load more
            </Link>
          )}
        </>
      )}
    </div>
  );
}
