import { Suspense } from "react";
import Link from "next/link";

import { formatDate } from "@/lib/dates";
import { csToPickUp, csRenewals120Days, ownershipAssignedToYou } from "@/server/queries/worklist/mine";
import { SectionCard, SectionSkeleton } from "@/components/home/SectionCard";
import { OwnershipAssignedSection } from "@/components/home/OwnershipAssignedSection";
import { WorklistErrorBoundary } from "@/components/home/WorklistErrorBoundary";

function renewalChip(daysUntil: number): string {
  if (daysUntil < 0) return "Overdue";
  if (daysUntil <= 30) return "≤30 days";
  if (daysUntil <= 60) return "31-60 days";
  if (daysUntil <= 90) return "61-90 days";
  return "91-120 days";
}

/**
 * Brief 4.6.3, 7.6.5. Section order: Ownership assigned to you, To pick
 * up, Renewals in the next 120 days. Each section is its own async
 * component in its own Suspense + error boundary (brief 4.6.1).
 */
export function CsWorklist({ userId }: { userId: string }) {
  return (
    <>
      <Section fallback={<SectionSkeleton />}>
        <OwnershipAssigned userId={userId} />
      </Section>
      <Section fallback={<SectionSkeleton />}>
        <ToPickUp userId={userId} />
      </Section>
      <Section fallback={<SectionSkeleton />}>
        <Renewals userId={userId} />
      </Section>
    </>
  );
}

function Section({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  return (
    <WorklistErrorBoundary>
      <Suspense fallback={fallback}>{children}</Suspense>
    </WorklistErrorBoundary>
  );
}

async function OwnershipAssigned({ userId }: { userId: string }) {
  const rows = await ownershipAssignedToYou(userId);
  return (
    <SectionCard id="worklist-ownership-assigned" title="Ownership assigned to you" count={rows.length}>
      <OwnershipAssignedSection rows={rows} />
    </SectionCard>
  );
}

async function ToPickUp({ userId }: { userId: string }) {
  const rows = await csToPickUp(userId);
  return (
    <SectionCard id="worklist-to-pick-up" title="To pick up" count={rows.length}>
      <div className="flex flex-col">
        {rows.map((r) => (
          <div key={r.handoffId} className="flex flex-wrap items-center gap-2 border-t border-border py-2 first:border-t-0">
            <span className="text-body font-medium">{r.entityName}{r.entityCountry ? ` · ${r.entityCountry}` : ""}</span>
            <span className="text-meta text-text-secondary">from {r.sender} · {r.daysPending} days</span>
            <span className="flex-1" />
            <Link href={`/handoffs/${r.handoffId}`} className="text-meta text-link-text hover:underline">Open</Link>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

async function Renewals({ userId }: { userId: string }) {
  const rows = await csRenewals120Days(userId);
  return (
    <SectionCard id="worklist-renewals" title="Renewals in the next 120 days" count={rows.length}>
      <div className="flex flex-col">
        {rows.map((r) => (
          <div key={r.entityId} className="flex flex-wrap items-center gap-2 border-t border-border py-2 first:border-t-0">
            <span className="text-body font-medium">{r.entityName}</span>
            <span className="text-meta text-text-secondary">{r.passed ? `Renewal date passed (${formatDate(r.renewalDate)})` : `Renewal in ${r.daysUntil} days (${formatDate(r.renewalDate)})`} · {renewalChip(r.daysUntil)}</span>
            <span className="flex-1" />
            <Link href={`/entities/${r.entityId}/details`} className="text-meta text-link-text hover:underline">Open</Link>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
