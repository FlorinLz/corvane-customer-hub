import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { LicenceVerificationDialog } from "@/components/entity/compliance/LicenceVerificationDialog";
import { ObligationsCard } from "@/components/entity/compliance/ObligationsCard";
import { RefreshGleifButton } from "@/components/entity/compliance/RefreshGleifButton";
import { daysBetween, formatDate, toLocalDate, today } from "@/lib/dates";
import { effectiveTimeZone, formatDateTime } from "@/lib/time-zones";
import { SANCTIONS_RESULT_LABELS } from "@/lib/labels";
import { computeKybStatus } from "@/server/derived/kyb-status";
import { computeReviewStatus } from "@/server/derived/review-status";
import { kybChipLabel, kybChipVariant, leiStatusLabel, reviewStatusLabel, reviewStatusVariant } from "@/lib/ui/status";
import { can } from "@/server/permissions/can";
import { loadComplianceData, type ComplianceData } from "@/server/queries/compliance";
import { getCurrentUser } from "@/server/session";

const EXPIRY_WARNING_DAYS = 90;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-text-secondary">{children}</h3>;
}

function ExpiryLine({ expiry }: { expiry: string | null }) {
  if (!expiry) return null;
  const n = daysBetween(today(), expiry);
  const isExpired = n < 0;
  const isExpiring = !isExpired && n <= EXPIRY_WARNING_DAYS;
  return (
    <p className={`text-meta ${isExpired ? "text-danger" : isExpiring ? "text-due" : "text-text-secondary"}`}>
      Expires on {formatDate(expiry)} ({n >= 0 ? `in ${n} day${n === 1 ? "" : "s"}` : `${-n} day${-n === 1 ? "" : "s"} ago`})
    </p>
  );
}

function EvidenceLink({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-meta text-link-text hover:underline">
      Evidence <ExternalLink className="size-3" aria-hidden="true" />
    </a>
  );
}

function KybCardShell({ title, status, children }: { title: string; status: ReturnType<typeof computeKybStatus>; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <span className="flex-1" />
        <Badge variant={kybChipVariant(status)}>{kybChipLabel(status)}</Badge>
      </CardHeader>
      <div className="flex flex-col gap-1.5">{children}</div>
    </Card>
  );
}

function LicenceCard({ data, canEdit, currentUserName }: { data: ComplianceData; canEdit: boolean; currentUserName: string }) {
  const k = data.kybByType.LICENCE;
  const status = computeKybStatus({
    type: "LICENCE",
    verifiedOn: k?.verifiedOn ? toLocalDate(k.verifiedOn) : null,
    expiryDate: k?.expiryDate ? toLocalDate(k.expiryDate) : null,
    noExpiry: k?.noExpiry ?? false,
    today: today(),
  });
  return (
    <KybCardShell title="Licence" status={status}>
      {k?.verifiedOn ? (
        <>
          <p className="text-body">{k.licenceNumber ?? "Not captured"}</p>
          <p className="text-meta text-text-secondary">{k.issuingAuthority ?? "Not captured"}</p>
          {k.noExpiry ? <p className="text-meta text-text-secondary">No expiry date</p> : <ExpiryLine expiry={k.expiryDate ? toLocalDate(k.expiryDate) : null} />}
          <p className="text-meta text-text-secondary">Verified by {k.verifiedBy?.name ?? "—"} on {formatDate(toLocalDate(k.verifiedOn))}</p>
          <EvidenceLink url={k.evidenceUrl} />
        </>
      ) : (
        <p className="text-text-secondary">Not verified yet</p>
      )}
      {canEdit && (
        <div className="mt-2 flex justify-end">
          <LicenceVerificationDialog
            entityId={data.entity.id}
            version={k?.version ?? 0}
            currentUserName={currentUserName}
            initial={
              k?.verifiedOn
                ? {
                    licenceNumber: k.licenceNumber ?? "",
                    issuingAuthority: k.issuingAuthority ?? "",
                    expiryDate: k.expiryDate ? toLocalDate(k.expiryDate) : null,
                    noExpiry: k.noExpiry,
                    evidenceUrl: k.evidenceUrl ?? "",
                  }
                : undefined
            }
          />
        </div>
      )}
    </KybCardShell>
  );
}

function LeiCard({ data, canRefresh, zone }: { data: ComplianceData; canRefresh: boolean; zone: string }) {
  const { entity } = data;
  const k = data.kybByType.LEI;
  const status = computeKybStatus({
    type: "LEI",
    verifiedOn: k?.verifiedOn ? toLocalDate(k.verifiedOn) : null,
    expiryDate: null,
    noExpiry: false,
    entityLeiStatus: entity.leiStatus,
    entityGleifRawStatus: entity.gleifRawStatus,
    entityLeiNextRenewalDate: entity.leiNextRenewalDate ? toLocalDate(entity.leiNextRenewalDate) : null,
    today: today(),
  });
  return (
    <KybCardShell title="LEI" status={status}>
      {entity.lei ? (
        <>
          <p className="font-mono text-body">{entity.lei}</p>
          <p className="text-meta text-text-secondary">Owned by Ops · Edit on Details tab</p>
          {entity.leiStatus && <p className="text-meta text-text-secondary">GLEIF status: {leiStatusLabel(entity.leiStatus)}</p>}
          {entity.leiNextRenewalDate && <ExpiryLine expiry={toLocalDate(entity.leiNextRenewalDate)} />}
          {entity.gleifCheckedAt && <p className="text-meta text-text-secondary">From GLEIF · fetched {formatDateTime(entity.gleifCheckedAt, zone)}</p>}
          {k?.verifiedOn && <p className="text-meta text-text-secondary">Verified by {k.verifiedBy?.name ?? "—"} on {formatDate(toLocalDate(k.verifiedOn))}</p>}
        </>
      ) : (
        <p className="text-text-secondary">No LEI on this entity</p>
      )}
      {canRefresh && entity.lei && (
        <div className="mt-2 flex justify-end">
          <RefreshGleifButton entityId={entity.id} />
        </div>
      )}
    </KybCardShell>
  );
}

function OwnershipCard({ data }: { data: ComplianceData }) {
  const k = data.kybByType.OWNERSHIP_STRUCTURE;
  const status = computeKybStatus({ type: "OWNERSHIP_STRUCTURE", verifiedOn: k?.verifiedOn ? toLocalDate(k.verifiedOn) : null, expiryDate: null, noExpiry: false, today: today() });
  return (
    <KybCardShell title="Ownership structure" status={status}>
      {k?.verifiedOn ? (
        <>
          <p className="text-body">{k.ownershipSummary ?? "Not captured"}</p>
          <p className="text-meta text-text-secondary">Parent: {k.parentEntityName ?? "Not captured"}</p>
          <p className="text-meta text-text-secondary">No expiry. Re-verified at the periodic review.</p>
          <p className="text-meta text-text-secondary">Verified by {k.verifiedBy?.name ?? "—"} on {formatDate(toLocalDate(k.verifiedOn))}</p>
          <EvidenceLink url={k.evidenceUrl} />
        </>
      ) : (
        <p className="text-text-secondary">Not verified yet</p>
      )}
    </KybCardShell>
  );
}

function SanctionsCard({ data }: { data: ComplianceData }) {
  const k = data.kybByType.SANCTIONS_SCREENING;
  const status = computeKybStatus({ type: "SANCTIONS_SCREENING", verifiedOn: k?.verifiedOn ? toLocalDate(k.verifiedOn) : null, expiryDate: null, noExpiry: false, today: today() });
  return (
    <KybCardShell title="Sanctions screening" status={status}>
      {k?.verifiedOn ? (
        <>
          <p className="text-body">{k.sanctionsResult ? SANCTIONS_RESULT_LABELS[k.sanctionsResult] : "Not captured"}</p>
          <p className="text-meta text-text-secondary">{k.sanctionsLists ?? "Not captured"}</p>
          <p className="text-meta text-text-secondary">No expiry. Re-verified at the periodic review.</p>
          <p className="text-meta text-text-secondary">Verified by {k.verifiedBy?.name ?? "—"} on {formatDate(toLocalDate(k.verifiedOn))}</p>
          <EvidenceLink url={k.evidenceUrl} />
        </>
      ) : (
        <p className="text-text-secondary">Not verified yet</p>
      )}
    </KybCardShell>
  );
}

function PeriodicReviewCard({ data }: { data: ComplianceData }) {
  const review = data.periodicReview;
  if (!review) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Periodic review</CardTitle>
        </CardHeader>
        <p className="text-text-secondary">No review scheduled</p>
      </Card>
    );
  }
  const status = computeReviewStatus({ storedStatus: review.status, nextReviewDate: toLocalDate(review.nextReviewDate), today: today() });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Periodic review</CardTitle>
        <span className="flex-1" />
        <Badge variant={reviewStatusVariant(status)}>{reviewStatusLabel(status)}</Badge>
        {review.pastDue && <Badge variant="due-outline">Past due</Badge>}
      </CardHeader>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-meta text-text-secondary">
        {review.lastReviewDate && <span>Last review date {formatDate(toLocalDate(review.lastReviewDate))}</span>}
        <span>Next review date {formatDate(toLocalDate(review.nextReviewDate))}</span>
      </div>
    </Card>
  );
}

export default async function CompliancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, user] = await Promise.all([loadComplianceData(id), getCurrentUser()]);
  if (!data) notFound();

  const canEditKyb = can(user, "compliance.kyb.edit").ok;
  const canEditObligations = can(user, "compliance.obligations.edit").ok;
  const canRefreshGleif = can(user, "entity.gleifRefresh", { entity: { deletedAt: data.entity.deletedAt } }).ok;
  const o = data.customerAgreement;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-page">Compliance</h2>

      <section className="flex flex-col gap-3">
        <SectionLabel>KYB checks</SectionLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <LicenceCard data={data} canEdit={canEditKyb} currentUserName={user.name} />
          <LeiCard data={data} canRefresh={canRefreshGleif} zone={effectiveTimeZone(user)} />
          <OwnershipCard data={data} />
          <SanctionsCard data={data} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionLabel>Periodic review</SectionLabel>
        <PeriodicReviewCard data={data} />
      </section>

      {data.entity.customerRole?.active && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <SectionLabel>Contractual obligations</SectionLabel>
            <span className="flex-1" />
            <Link href={`/search?view=obligations`} className="text-meta text-link-text hover:underline">
              See all agreements in Obligations view
            </Link>
          </div>
          <ObligationsCard
            entityId={data.entity.id}
            zone={effectiveTimeZone(user)}
            canEdit={canEditObligations}
            data={
              o
                ? {
                    kind: "CUSTOMER_AGREEMENT",
                    incidentNoticeHours: o.incidentNoticeHours,
                    subprocessorNoticeDays: o.subprocessorNoticeDays,
                    auditRight: o.auditRight,
                    availabilitySlaPct: o.availabilitySlaPct !== null ? Number(o.availabilitySlaPct) : null,
                    euVopStatus: o.euVopStatus,
                    ukCopStatus: o.ukCopStatus,
                    expiryDate: o.expiryDate ? toLocalDate(o.expiryDate) : null,
                    contractUrl: o.contractUrl,
                    regulatoryRegime: o.regulatoryRegime,
                    regimeName: o.regimeName,
                    regulatorDeadline: o.regulatorDeadline,
                    factsNeededHours: o.factsNeededHours,
                    postIncidentReportDays: o.postIncidentReportDays,
                    updatedByName: o.updatedBy?.name ?? null,
                    updatedByTeam: o.updatedBy?.team ?? null,
                    updatedAt: o.updatedAt,
                    version: o.version,
                  }
                : null
            }
          />
        </section>
      )}
    </div>
  );
}
