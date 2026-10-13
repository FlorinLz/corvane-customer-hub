import { Suspense } from "react";
import Link from "next/link";

import { formatDate } from "@/lib/dates";
import { BLOCKED_BY_LABELS, STAGE_LABELS } from "@/lib/labels";
import {
  opsToPickUp,
  opsAwaitingAcceptance,
  opsBlocked,
  opsGoLives14Days,
  opsTooLongInStage,
  opsRequiredFieldsEmpty,
  ownershipAssignedToYou,
} from "@/server/queries/worklist/mine";
import { SectionCard, SectionSkeleton } from "@/components/home/SectionCard";
import { OwnershipAssignedSection } from "@/components/home/OwnershipAssignedSection";
import { WorklistErrorBoundary } from "@/components/home/WorklistErrorBoundary";

/**
 * Brief 4.6.2, 7.6.5. Section order: To pick up, Awaiting acceptance,
 * Blocked, Go-lives in the next 14 days, Too long in current stage,
 * Required fields empty, Ownership assigned to you. "Handoff declined"
 * is R2 (needs Decline). Each section is its own async component in its
 * own Suspense + error boundary (brief 4.6.1): one slow or failing
 * query must not delay or blank the others.
 */
export function OpsWorklist({ userId }: { userId: string }) {
  return (
    <>
      <Section fallback={<SectionSkeleton />}>
        <ToPickUp userId={userId} />
      </Section>
      <Section fallback={<SectionSkeleton />}>
        <AwaitingAcceptance userId={userId} />
      </Section>
      <Section fallback={<SectionSkeleton />}>
        <Blocked userId={userId} />
      </Section>
      <Section fallback={<SectionSkeleton />}>
        <GoLives userId={userId} />
      </Section>
      <Section fallback={<SectionSkeleton />}>
        <TooLongInStage userId={userId} />
      </Section>
      <Section fallback={<SectionSkeleton />}>
        <RequiredFieldsEmpty userId={userId} />
      </Section>
      <Section fallback={<SectionSkeleton />}>
        <OwnershipAssigned userId={userId} />
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

async function ToPickUp({ userId }: { userId: string }) {
  const rows = await opsToPickUp(userId);
  return (
    <SectionCard id="worklist-to-pick-up" title="To pick up" count={rows.length}>
      <div className="flex flex-col">
        {rows.map((r) => (
          <div key={r.handoffId} className="flex flex-wrap items-center gap-2 border-t border-border py-2 first:border-t-0">
            <span className="text-body font-medium">{r.entityName}{r.entityCountry ? ` · ${r.entityCountry}` : ""}</span>
            <span className="text-meta text-text-secondary">{r.products.join(", ")}{r.earliestGoLive ? `, earliest go-live ${formatDate(r.earliestGoLive)}` : ""} · from {r.sender} · {r.daysWaiting} days</span>
            <span className="flex-1" />
            <Link href={`/handoffs/${r.handoffId}`} className="text-meta text-link-text hover:underline">Open</Link>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

async function AwaitingAcceptance({ userId }: { userId: string }) {
  const rows = await opsAwaitingAcceptance(userId);
  return (
    <SectionCard id="worklist-awaiting-acceptance" title="Awaiting acceptance" count={rows.length}>
      <div className="flex flex-col">
        {rows.map((r) => (
          <div key={r.handoffId} className="flex flex-wrap items-center gap-2 border-t border-border py-2 first:border-t-0">
            <span className="text-body font-medium">{r.entityName}{r.entityCountry ? ` · ${r.entityCountry}` : ""}</span>
            <span className="text-meta text-text-secondary">{r.recipientStillCs ? r.recipient : "Recipient no longer in Customer Success"} · {r.daysPending} days</span>
            <span className="flex-1" />
            <Link href={`/handoffs/${r.handoffId}`} className="text-meta text-link-text hover:underline">Open</Link>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

async function Blocked({ userId }: { userId: string }) {
  const rows = await opsBlocked(userId);
  return (
    <SectionCard id="worklist-blocked" title="Blocked" count={rows.length}>
      <div className="flex flex-col">
        {rows.map((r) => (
          <div key={r.productId} className="flex flex-wrap items-center gap-2 border-t border-border py-2 first:border-t-0">
            <span className="text-body font-medium">{r.entityName}</span>
            <span className="text-meta text-text-secondary">{r.label} blocked by {BLOCKED_BY_LABELS[r.blockedBy as keyof typeof BLOCKED_BY_LABELS]} for {r.daysBlocked} days{r.reason ? `: ${r.reason}` : ""}</span>
            <span className="flex-1" />
            <Link href={`/entities/${r.entityId}/products`} className="text-meta text-link-text hover:underline">Open</Link>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

async function GoLives({ userId }: { userId: string }) {
  const rows = await opsGoLives14Days(userId);
  return (
    <SectionCard id="worklist-go-lives" title="Go-lives in the next 14 days" count={rows.length}>
      <div className="flex flex-col">
        {rows.map((r) => (
          <div key={r.productId} className="flex flex-wrap items-center gap-2 border-t border-border py-2 first:border-t-0">
            <span className="text-body font-medium">{r.entityName}</span>
            <span className="text-meta text-text-secondary">{r.label}: target go-live in {r.daysUntil} days ({formatDate(r.targetGoLive)}), {STAGE_LABELS[r.stage as keyof typeof STAGE_LABELS]}</span>
            <span className="flex-1" />
            <Link href={`/entities/${r.entityId}/products`} className="text-meta text-link-text hover:underline">Open</Link>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

async function TooLongInStage({ userId }: { userId: string }) {
  const rows = await opsTooLongInStage(userId);
  return (
    <SectionCard id="worklist-too-long" title="Too long in current stage" count={rows.length} hint="Limit 21 days (56 for Live & hypercare)">
      <div className="flex flex-col">
        {rows.map((r) => (
          <div key={r.productId} className="flex flex-wrap items-center gap-2 border-t border-border py-2 first:border-t-0">
            <span className="text-body font-medium">{r.entityName}</span>
            <span className="text-meta text-text-secondary">{r.label}: {r.daysInStage} days in {STAGE_LABELS[r.stage as keyof typeof STAGE_LABELS]} (limit {r.limitDays} days)</span>
            <span className="flex-1" />
            <Link href={`/entities/${r.entityId}/products`} className="text-meta text-link-text hover:underline">Open</Link>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

async function RequiredFieldsEmpty({ userId }: { userId: string }) {
  const rows = await opsRequiredFieldsEmpty(userId);
  return (
    <SectionCard id="worklist-required-fields" title="Required fields empty" count={rows.length}>
      <div className="flex flex-col">
        {rows.map((r) => (
          <div key={r.entityId} className="flex flex-wrap items-center gap-2 border-t border-border py-2 first:border-t-0">
            <span className="text-body font-medium">{r.entityName}</span>
            <span className="text-meta text-text-secondary">Missing: {r.missing.join(", ")}</span>
            <span className="flex-1" />
            <Link href={`/entities/${r.entityId}/details`} className="text-meta text-link-text hover:underline">Open</Link>
          </div>
        ))}
      </div>
    </SectionCard>
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
