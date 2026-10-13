import { AlertTriangle } from "lucide-react";

import { ReactivateAction } from "@/components/entity/ReactivateAction";
import { formatDate } from "@/lib/dates";

// Brief 4.8.1, M16 AC11: admin view of a soft-deleted record — red banner
// + Reactivate.
export function DeletedBanner({
  entityId,
  legalName,
  deletedByName,
  deletedAt,
  deleteReason,
  blockedMessage,
}: {
  entityId: string;
  legalName: string;
  deletedByName: string;
  deletedAt: Date;
  deleteReason: string;
  blockedMessage?: string | null;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border-2 border-danger bg-white px-4 py-3 text-danger">
      <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
      <span className="flex-1 text-body">
        Deleted by {deletedByName} on {formatDate(deletedAt.toISOString().slice(0, 10))}. Reason: {deleteReason}
      </span>
      <ReactivateAction entityId={entityId} legalName={legalName} blockedMessage={blockedMessage} />
    </div>
  );
}
