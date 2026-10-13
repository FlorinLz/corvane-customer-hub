import { notFound } from "next/navigation";

import { AccessMessage } from "@/components/shell/AccessMessage";
import { DeletedBanner } from "@/components/entity/DeletedBanner";
import { EntityHeader } from "@/components/entity/header/EntityHeader";
import { TabBar } from "@/components/entity/header/TabBar";
import { formatDate, toLocalDate } from "@/lib/dates";
import { effectiveTimeZone } from "@/lib/time-zones";
import { loadHeaderData } from "@/server/queries/header";
import { findLeiConflictMessage } from "@/server/queries/deleted-records";
import { loadMyUnacknowledgedAssignment, loadOwnerCandidates } from "@/server/queries/owner-assignment";
import { can } from "@/server/permissions/can";
import { getCurrentUser } from "@/server/session";
import { FileX } from "lucide-react";

// Brief 6.1; soft-deleted handling per M16 AC11: the admin sees the full
// record read-only under a red banner with Reactivate; every other team
// sees the short message, no entity data, no header, no tabs.
export default async function EntityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, user] = await Promise.all([loadHeaderData(id), getCurrentUser()]);

  if (!data) notFound();

  if (data.entity.deletedAt && !user.isAdmin) {
    return (
      <AccessMessage
        icon={FileX}
        message={`This record was deleted on ${formatDate(data.entity.deletedAt.toISOString().slice(0, 10))}. Contact the admin, Adrian Koh, if it should be restored.`}
        actions={[{ label: "Go to search", href: "/search", variant: "secondary" }]}
      />
    );
  }

  const showAudit = can(user, "audit.read", { entity: { deletedAt: data.entity.deletedAt } }).ok;
  const blockedMessage =
    data.entity.deletedAt && data.entity.lei ? await findLeiConflictMessage(data.entity.lei, id) : null;

  const canReassignOwner = can(user, "owner.reassign", { entity: { deletedAt: data.entity.deletedAt } }).ok;
  // M8 AC1: every Ops user sees the entry point when the entity has an active Customer role (the button itself handles the disabled/hidden states for eligibility and an open handoff).
  const canSendOpsToCs = user.team === "OPS" && !!data.entity.customerRole?.active && can(user, "handoff.opsCs", { entity: { deletedAt: data.entity.deletedAt } }).ok;
  const canRetryGleif =
    user.team === "OPS" && data.entity.leiStatus === "NOT_VERIFIED" && can(user, "entity.gleifRefresh", { entity: { deletedAt: data.entity.deletedAt } }).ok;
  const [ownerCandidates, myAssignment] = await Promise.all([
    canReassignOwner ? loadOwnerCandidates() : Promise.resolve([]),
    !data.entity.deletedAt ? loadMyUnacknowledgedAssignment(id, user.id) : Promise.resolve(null),
  ]);

  return (
    <div className="-mt-6 flex flex-col">
      {data.entity.deletedAt && data.entity.deletedBy && (
        <div className="mx-auto w-full max-w-[1440px] px-6 pt-4">
          <DeletedBanner
            entityId={id}
            legalName={data.entity.legalName}
            deletedByName={data.entity.deletedBy.name}
            deletedAt={data.entity.deletedAt}
            deleteReason={data.entity.deleteReason ?? ""}
            blockedMessage={blockedMessage}
          />
        </div>
      )}
      <EntityHeader
        data={data}
        isAdmin={user.isAdmin}
        canReassignOwner={canReassignOwner}
        canRetryGleif={canRetryGleif}
        canSendOpsToCs={canSendOpsToCs}
        ownerCandidates={ownerCandidates}
        myAssignment={
          myAssignment
            ? { id: myAssignment.id, assignedByName: myAssignment.assignedBy.name, reason: myAssignment.reason, assignedAt: toLocalDate(myAssignment.assignedAt) }
            : null
        }
        viewerZone={effectiveTimeZone(user)}
      />
      <div className="px-6">
        <TabBar
          entityId={id}
          hasCustomerRole={data.entity.customerRole?.active ?? false}
          hasPartnerRole={data.entity.partnerRole?.active ?? false}
          showAudit={showAudit}
        />
      </div>
      <div className="mx-auto w-full max-w-[1200px] px-6 py-6">{children}</div>
    </div>
  );
}
