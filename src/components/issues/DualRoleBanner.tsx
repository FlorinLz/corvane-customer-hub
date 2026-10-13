import Link from "next/link";

import { issueDisplayId } from "@/lib/labels";

/** Brief M23 AC9. "This entity is also the affected partner." */
export function DualRoleBanner({ parentId, parentNumber, lastPartnerCommunication }: { parentId: string; parentNumber: number; lastPartnerCommunication: string }) {
  return (
    <section className="flex flex-col gap-1 rounded-md border-l-4 border-l-due bg-tint p-3">
      <div className="flex items-center gap-2">
        <span className="font-medium text-body">This entity is also the affected partner</span>
        <Link href={`/issues/${parentId}`} className="text-meta text-link-text hover:underline">
          Open {issueDisplayId(parentNumber)}
        </Link>
      </div>
      <p className="text-meta text-text-secondary">{lastPartnerCommunication}</p>
    </section>
  );
}
