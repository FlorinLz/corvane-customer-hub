import { REGULATORY_REGIME_LABELS } from "@/lib/labels";
import type { RegulatoryRegime } from "@prisma/client";

/** Brief 4.9.9, M26 AC8. Read-only on every customer issue. */
export function CustomerObligationsPanel({
  card,
}: {
  card: { incidentNoticeHours: number | null; regulatoryRegime: RegulatoryRegime | null; regimeName: string | null; regulatorDeadline: string | null; factsNeededHours: number | null; postIncidentReportDays: number | null } | null;
}) {
  const regime = card?.regulatoryRegime
    ? card.regulatoryRegime === "OTHER"
      ? `Other: ${card.regimeName ?? ""}`
      : REGULATORY_REGIME_LABELS[card.regulatoryRegime]
    : null;

  return (
    <div data-onboarding="customer-obligations" className="flex flex-col gap-2 rounded-md border border-border p-4">
      <h3 className="text-subsection">Customer obligations</h3>
      <dl className="grid grid-cols-[1fr_1fr] gap-1.5 text-body">
        <dt className="text-meta text-text-secondary">Incident notification time</dt>
        <dd>{card?.incidentNoticeHours != null ? `${card.incidentNoticeHours} h` : "Not captured"}</dd>
        <dt className="text-meta text-text-secondary">Regulatory regime</dt>
        <dd>{regime ?? "Not captured"}</dd>
        <dt className="text-meta text-text-secondary">Regulator&apos;s deadline</dt>
        <dd>{card?.regulatorDeadline || "Not captured"}</dd>
        <dt className="text-meta text-text-secondary">Facts needed within</dt>
        <dd>{card?.factsNeededHours != null ? `${card.factsNeededHours} h` : "Not captured"}</dd>
        <dt className="text-meta text-text-secondary">Post-incident report due</dt>
        <dd>{card?.postIncidentReportDays != null ? `${card.postIncidentReportDays} days after resolution` : "Not captured"}</dd>
      </dl>
    </div>
  );
}
