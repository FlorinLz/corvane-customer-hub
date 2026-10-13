import Link from "next/link";

import { complianceKybAndReviewExpiries, type ComplianceBucket } from "@/server/queries/worklist/mine";
import { SectionCard } from "@/components/home/SectionCard";

const BUCKET_LABELS: Record<ComplianceBucket, string> = { OVERDUE: "Overdue", WITHIN_30: "≤30 days", WITHIN_60: "31-60 days", WITHIN_90: "61-90 days" };
const BUCKET_ORDER: ComplianceBucket[] = ["OVERDUE", "WITHIN_30", "WITHIN_60", "WITHIN_90"];

/** Brief 4.6.4, 7.6.5. One section, "KYB and review expiries", 4 bucket sub-headers. All institutions. */
export async function ComplianceWorklist() {
  const rows = await complianceKybAndReviewExpiries();

  return (
    <SectionCard id="worklist-kyb-expiries" title="KYB and review expiries" count={rows.length}>
      <div className="flex flex-col gap-3">
        {BUCKET_ORDER.map((bucket) => {
          const bucketRows = rows.filter((r) => r.bucket === bucket);
          if (bucketRows.length === 0) return null;
          return (
            <div key={bucket} className="flex flex-col gap-1">
              <h3 className="text-meta font-medium text-text-secondary">{BUCKET_LABELS[bucket]}</h3>
              {bucketRows.map((r, i) => (
                <div key={`${r.entityId}-${r.kind}-${i}`} className="flex flex-wrap items-center gap-2 border-t border-border py-1.5 first:border-t-0">
                  <span className="text-body font-medium">{r.entityName}</span>
                  <span className="text-meta text-text-secondary">{r.label}</span>
                  <span className="flex-1" />
                  <Link href={`/entities/${r.entityId}/compliance`} className="text-meta text-link-text hover:underline">Open</Link>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
