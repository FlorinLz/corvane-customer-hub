"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { RegulatoryRegime, SchemeAdherence } from "@prisma/client";

import { apiRequest } from "@/lib/api-client";
import { daysBetween, formatDate, today } from "@/lib/dates";
import { formatDateTime } from "@/lib/time-zones";
import { OBLIGATION_CARD_KIND_LABELS, ownedByLabel, REGULATORY_REGIME_LABELS, SCHEME_ADHERENCE_LABELS, TEAM_LABELS } from "@/lib/labels";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OwnedBy } from "@/components/entity/OwnedBy";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";

const REGULATORY_REGIME_OPTIONS: RegulatoryRegime[] = ["EU_DORA", "UK_FCA", "UNITED_STATES", "SINGAPORE_MAS", "UAE_CBUAE", "OTHER", "NONE"];

const SCHEME_ADHERENCE_VARIANT: Record<SchemeAdherence, NonNullable<BadgeProps["variant"]>> = {
  NOT_APPLICABLE: "neutral-outline",
  NOT_STARTED: "neutral",
  IN_PROGRESS: "due",
  ADHERED: "success",
  SUSPENDED: "danger",
  WITHDRAWN: "muted",
};

const EXPIRY_WARNING_DAYS = 90;
const ADHERENCE_OPTIONS: SchemeAdherence[] = ["NOT_APPLICABLE", "NOT_STARTED", "IN_PROGRESS", "ADHERED", "SUSPENDED", "WITHDRAWN"];

export interface ObligationsCardData {
  kind: "CUSTOMER_AGREEMENT" | "PARTNER_AGREEMENT";
  incidentNoticeHours: number | null;
  subprocessorNoticeDays: number | null;
  auditRight: boolean | null;
  availabilitySlaPct: number | null;
  euVopStatus: SchemeAdherence | null;
  ukCopStatus: SchemeAdherence | null;
  expiryDate: string | null;
  contractUrl: string | null;
  // Regulatory block (M26), Customer agreement cards only.
  regulatoryRegime: RegulatoryRegime | null;
  regimeName: string | null;
  regulatorDeadline: string | null;
  factsNeededHours: number | null;
  postIncidentReportDays: number | null;
  updatedByName: string | null;
  updatedByTeam: keyof typeof TEAM_LABELS | null;
  updatedAt: Date | null;
  version: number;
}

interface FormState {
  incidentNoticeHours: string;
  subprocessorNoticeDays: string;
  auditRight: "" | "Yes" | "No";
  availabilitySlaPct: string;
  euVopStatus: "" | SchemeAdherence;
  ukCopStatus: "" | SchemeAdherence;
  expiryDate: string;
  contractUrl: string;
  regulatoryRegime: "" | RegulatoryRegime;
  regimeName: string;
  regulatorDeadline: string;
  factsNeededHours: string;
  postIncidentReportDays: string;
}

/** M26 AC5: "<n> of 4 captured" (regime, regulator's deadline, facts hours, post-incident report days). */
function regulatoryCapturedCount(form: Pick<FormState, "regulatoryRegime" | "regulatorDeadline" | "factsNeededHours" | "postIncidentReportDays">): number {
  let n = 0;
  if (form.regulatoryRegime !== "") n++;
  if (form.regulatorDeadline !== "") n++;
  if (form.factsNeededHours !== "") n++;
  if (form.postIncidentReportDays !== "") n++;
  return n;
}

function toForm(data: ObligationsCardData): FormState {
  return {
    incidentNoticeHours: data.incidentNoticeHours?.toString() ?? "",
    subprocessorNoticeDays: data.subprocessorNoticeDays?.toString() ?? "",
    auditRight: data.auditRight === null ? "" : data.auditRight ? "Yes" : "No",
    availabilitySlaPct: data.availabilitySlaPct?.toString() ?? "",
    euVopStatus: data.euVopStatus ?? "",
    ukCopStatus: data.ukCopStatus ?? "",
    expiryDate: data.expiryDate ?? "",
    contractUrl: data.contractUrl ?? "",
    regulatoryRegime: data.regulatoryRegime ?? "",
    regimeName: data.regimeName ?? "",
    regulatorDeadline: data.regulatorDeadline ?? "",
    factsNeededHours: data.factsNeededHours?.toString() ?? "",
    postIncidentReportDays: data.postIncidentReportDays?.toString() ?? "",
  };
}

/** Brief M26. Lives inside the Customer agreement card only. */
function RegulatoryBlock({ data, canEdit, onAdd }: { data: ObligationsCardData; canEdit: boolean; onAdd: () => void }) {
  const regime = data.regulatoryRegime;
  const capturedCount = [regime, data.regulatorDeadline, data.factsNeededHours, data.postIncidentReportDays].filter((v) => v !== null && v !== undefined).length;
  const regimeText = regime ? (regime === "OTHER" ? `Other: ${data.regimeName}` : REGULATORY_REGIME_LABELS[regime]) : null;
  const nothingCaptured = capturedCount === 0;

  return (
    <div className="mt-3 flex flex-col gap-1.5 border-t border-border-strong pt-3">
      <div className="flex items-center gap-2">
        <h4 className="text-subsection flex-1">Regulatory</h4>
        {!canEdit && <OwnedBy label={ownedByLabel(["COMPLIANCE"])} />}
        {!nothingCaptured && <span className="text-meta text-text-secondary">{capturedCount} of 4 captured</span>}
      </div>
      {nothingCaptured ? (
        <>
          <span className="text-meta text-text-secondary">Regulatory: not captured</span>
          {canEdit && (
            <Button variant="secondary" size="md" className="mt-1 self-start" onClick={onAdd}>
              Add regulatory details
            </Button>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between border-t border-border py-1.5 first:border-t-0">
            <span className="text-text-secondary">Regulatory regime</span>
            <span className="max-w-[58%] text-right">{regimeText ?? "Not captured"}</span>
          </div>
          {regime !== "NONE" && (
            <>
              <div className="flex items-center justify-between border-t border-border py-1.5">
                <span className="text-text-secondary">Regulator&apos;s deadline (information only)</span>
                <span className="max-w-[58%] text-right">{data.regulatorDeadline ?? "Not captured"}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border py-1.5">
                <span className="text-text-secondary">Facts needed within (hours)</span>
                <span className="text-right">{data.factsNeededHours !== null ? data.factsNeededHours : "Not captured"}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border py-1.5">
                <span className="text-text-secondary">Post-incident report due (days)</span>
                <span className="text-right">{data.postIncidentReportDays !== null ? data.postIncidentReportDays : "Not captured"}</span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Obligations edit is inline (card becomes a form), not a dialog. */
export function ObligationsCard({ entityId, data, canEdit, zone }: { entityId: string; data: ObligationsCardData | null; canEdit: boolean; zone: string }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(data ? toForm(data) : toForm({} as ObligationsCardData));
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [pending, setPending] = React.useState(false);

  const kind = data?.kind ?? "CUSTOMER_AGREEMENT";
  const title = kind === "CUSTOMER_AGREEMENT" ? "Customer agreement" : "Partner agreement";
  const ownerLabel = ownedByLabel(["COMPLIANCE"] as const);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setPending(true);
    setErrors({});
    try {
      const result = await apiRequest(`/api/entities/${entityId}/obligations/${kind}`, "PUT", {
        incidentNoticeHours: form.incidentNoticeHours === "" ? null : Number(form.incidentNoticeHours),
        subprocessorNoticeDays: form.subprocessorNoticeDays === "" ? null : Number(form.subprocessorNoticeDays),
        auditRight: form.auditRight === "" ? null : form.auditRight === "Yes",
        availabilitySlaPct: form.availabilitySlaPct === "" ? null : Number(form.availabilitySlaPct),
        euVopStatus: form.euVopStatus || null,
        ukCopStatus: form.ukCopStatus || null,
        expiryDate: form.expiryDate || null,
        contractUrl: form.contractUrl || null,
        regulatoryRegime: form.regulatoryRegime || null,
        regimeName: form.regulatoryRegime === "OTHER" ? form.regimeName || null : null,
        regulatorDeadline: form.regulatorDeadline || null,
        factsNeededHours: form.regulatoryRegime === "NONE" || form.factsNeededHours === "" ? null : Number(form.factsNeededHours),
        postIncidentReportDays: form.regulatoryRegime === "NONE" || form.postIncidentReportDays === "" ? null : Number(form.postIncidentReportDays),
        version: data?.version ?? 0,
      });
      if (!result.ok) {
        if (result.kind === "validation") setErrors(result.fieldErrors);
        else toast.error(result.kind === "conflict" ? result.message : "Obligations not saved. Try again.");
        return;
      }
      setEditing(false);
      toast.success("Obligations saved");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (editing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="obligations-incident-notice-hours" className="text-meta text-text-secondary">Incident notification time (hours)</label>
            <Input id="obligations-incident-notice-hours" type="number" value={form.incidentNoticeHours} onChange={(e) => set("incidentNoticeHours", e.target.value)} aria-invalid={!!errors.incidentNoticeHours} />
            {errors.incidentNoticeHours && <FieldError>{errors.incidentNoticeHours[0]}</FieldError>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="obligations-subprocessor-notice-days" className="text-meta text-text-secondary">Subprocessor change notice (days)</label>
            <Input id="obligations-subprocessor-notice-days" type="number" value={form.subprocessorNoticeDays} onChange={(e) => set("subprocessorNoticeDays", e.target.value)} aria-invalid={!!errors.subprocessorNoticeDays} />
            {errors.subprocessorNoticeDays && <FieldError>{errors.subprocessorNoticeDays[0]}</FieldError>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="obligations-audit-right" className="text-meta text-text-secondary">Audit right</label>
            <Select value={form.auditRight || "none"} onValueChange={(v) => set("auditRight", v === "none" ? "" : (v as "Yes" | "No"))}>
              <SelectTrigger id="obligations-audit-right">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not captured</SelectItem>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="obligations-availability-sla" className="text-meta text-text-secondary">Availability SLA (%)</label>
            <Input id="obligations-availability-sla" type="number" step="0.01" value={form.availabilitySlaPct} onChange={(e) => set("availabilitySlaPct", e.target.value)} aria-invalid={!!errors.availabilitySlaPct} />
            {errors.availabilitySlaPct && <FieldError>{errors.availabilitySlaPct[0]}</FieldError>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="obligations-euvop-status" className="text-meta text-text-secondary">EU VoP status</label>
            <Select value={form.euVopStatus || "none"} onValueChange={(v) => set("euVopStatus", v === "none" ? "" : (v as SchemeAdherence))}>
              <SelectTrigger id="obligations-euvop-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not captured</SelectItem>
                {ADHERENCE_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {SCHEME_ADHERENCE_LABELS[o]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="obligations-ukcop-status" className="text-meta text-text-secondary">UK CoP status</label>
            <Select value={form.ukCopStatus || "none"} onValueChange={(v) => set("ukCopStatus", v === "none" ? "" : (v as SchemeAdherence))}>
              <SelectTrigger id="obligations-ukcop-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not captured</SelectItem>
                {ADHERENCE_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {SCHEME_ADHERENCE_LABELS[o]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="obligations-expiry-date" className="text-meta text-text-secondary">Agreement expiry date</label>
            <Input id="obligations-expiry-date" type="date" value={form.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} aria-invalid={!!errors.expiryDate} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="obligations-contract-url" className="text-meta text-text-secondary">Contract PDF link</label>
            <Input id="obligations-contract-url" value={form.contractUrl} onChange={(e) => set("contractUrl", e.target.value)} placeholder="https://" aria-invalid={!!errors.contractUrl} />
            {errors.contractUrl && <FieldError>{errors.contractUrl[0]}</FieldError>}
          </div>
        </div>
        {kind === "CUSTOMER_AGREEMENT" && (
          <div className="mt-2 flex flex-col gap-3 border-t border-border-strong pt-3">
            <div className="flex items-center gap-2">
              <h4 className="text-subsection flex-1">Regulatory</h4>
              <span className="text-meta text-text-secondary">{regulatoryCapturedCount(form)} of 4 captured</span>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="obligations-regulatory-regime" className="text-meta text-text-secondary">Regulatory regime</label>
              <Select value={form.regulatoryRegime || "none"} onValueChange={(v) => set("regulatoryRegime", v === "none" ? "" : (v as RegulatoryRegime))}>
                <SelectTrigger id="obligations-regulatory-regime">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not captured</SelectItem>
                  {REGULATORY_REGIME_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {REGULATORY_REGIME_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.regulatoryRegime === "OTHER" && (
              <div className="flex flex-col gap-1">
                <label htmlFor="obligations-regime-name" className="text-meta text-text-secondary">Regime name</label>
                <Input id="obligations-regime-name" value={form.regimeName} onChange={(e) => set("regimeName", e.target.value)} aria-invalid={!!errors.regimeName} />
                {errors.regimeName && <FieldError>{errors.regimeName[0]}</FieldError>}
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label htmlFor="obligations-regulator-deadline" className="text-meta text-text-secondary">Regulator&apos;s deadline (information only)</label>
              <Textarea
                id="obligations-regulator-deadline"
                value={form.regulatorDeadline}
                onChange={(e) => set("regulatorDeadline", e.target.value)}
                maxLength={300}
              />
              <span className="text-meta text-text-secondary">Customer Hub does not calculate any deadline from this field.</span>
              <span className="self-end text-meta text-text-secondary">{form.regulatorDeadline.length} / 300</span>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="obligations-facts-needed-hours" className="text-meta text-text-secondary">Facts needed within (hours)</label>
              <Input
                id="obligations-facts-needed-hours"
                type="number"
                value={form.factsNeededHours}
                onChange={(e) => set("factsNeededHours", e.target.value)}
                aria-invalid={!!errors.factsNeededHours}
                disabled={form.regulatoryRegime === "NONE"}
              />
              <span className="text-meta text-text-secondary">Hours within which this customer needs Corvane&apos;s facts to report to its regulator, as agreed in the contract.</span>
              {errors.factsNeededHours && <FieldError>{errors.factsNeededHours[0]}</FieldError>}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="obligations-post-incident-report-days" className="text-meta text-text-secondary">Post-incident report due (days)</label>
              <Input
                id="obligations-post-incident-report-days"
                type="number"
                value={form.postIncidentReportDays}
                onChange={(e) => set("postIncidentReportDays", e.target.value)}
                aria-invalid={!!errors.postIncidentReportDays}
                disabled={form.regulatoryRegime === "NONE"}
              />
              <span className="text-meta text-text-secondary">Calendar days after resolution within which this customer needs Corvane&apos;s root cause report, as agreed in the contract.</span>
              {errors.postIncidentReportDays && <FieldError>{errors.postIncidentReportDays[0]}</FieldError>}
            </div>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="secondary" onClick={() => setEditing(false)} disabled={pending}>
            Cancel
          </Button>
          <Button loading={pending} onClick={() => void save()}>
            Save
          </Button>
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{OBLIGATION_CARD_KIND_LABELS[kind]}</CardTitle>
          <span className="flex-1" />
          {canEdit ? (
            <Button variant="text" size="md" className="h-auto p-0 text-meta" onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : (
            <OwnedBy label={ownerLabel} />
          )}
        </CardHeader>
        <p className="text-text-secondary">No obligations captured yet</p>
      </Card>
    );
  }

  const fields: Array<[string, unknown]> = [
    ["incidentNoticeHours", data.incidentNoticeHours],
    ["subprocessorNoticeDays", data.subprocessorNoticeDays],
    ["auditRight", data.auditRight],
    ["availabilitySlaPct", data.availabilitySlaPct],
    ["euVopStatus", data.euVopStatus],
    ["ukCopStatus", data.ukCopStatus],
    ["expiryDate", data.expiryDate],
    ["contractUrl", data.contractUrl],
  ];
  const capturedCount = fields.filter(([, v]) => v !== null && v !== undefined).length;
  const expiryDays = data.expiryDate ? daysBetween(today(), data.expiryDate) : null;
  const showExpiryBadge = expiryDays !== null && expiryDays <= EXPIRY_WARNING_DAYS;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <span className="text-meta text-text-secondary">{capturedCount} of 8 captured</span>
        <span className="flex-1" />
        {showExpiryBadge && <Badge variant={expiryDays! < 0 ? "danger" : "due-outline"}>{expiryDays! < 0 ? "Expired" : `Expires in ${expiryDays} days`}</Badge>}
        {canEdit ? (
          <Button variant="text" size="md" className="h-auto p-0 text-meta" onClick={() => setEditing(true)}>
            Edit
          </Button>
        ) : (
          <OwnedBy label={ownerLabel} />
        )}
      </CardHeader>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between border-t border-border py-1.5 first:border-t-0">
          <span className="text-text-secondary">Incident notification time</span>
          <span>{data.incidentNoticeHours !== null ? `${data.incidentNoticeHours} hour${data.incidentNoticeHours === 1 ? "" : "s"}` : "Not captured"}</span>
        </div>
        <div className="flex items-center justify-between border-t border-border py-1.5">
          <span className="text-text-secondary">Subprocessor change notice</span>
          <span>{data.subprocessorNoticeDays !== null ? (data.subprocessorNoticeDays === 0 ? "No advance notice required" : `${data.subprocessorNoticeDays} days`) : "Not captured"}</span>
        </div>
        <div className="flex items-center justify-between border-t border-border py-1.5">
          <span className="text-text-secondary">Audit right</span>
          <span>{data.auditRight !== null ? (data.auditRight ? "Yes" : "No") : "Not captured"}</span>
        </div>
        <div className="flex items-center justify-between border-t border-border py-1.5">
          <span className="text-text-secondary">Availability SLA</span>
          <span>{data.availabilitySlaPct !== null ? `${Number(data.availabilitySlaPct)}%` : "Not captured"}</span>
        </div>
        <div className="flex items-center justify-between border-t border-border py-1.5">
          <span className="text-text-secondary">EU VoP status</span>
          {data.euVopStatus ? <Badge variant={SCHEME_ADHERENCE_VARIANT[data.euVopStatus]}>{SCHEME_ADHERENCE_LABELS[data.euVopStatus]}</Badge> : <span>Not captured</span>}
        </div>
        <div className="flex items-center justify-between border-t border-border py-1.5">
          <span className="text-text-secondary">UK CoP status</span>
          {data.ukCopStatus ? <Badge variant={SCHEME_ADHERENCE_VARIANT[data.ukCopStatus]}>{SCHEME_ADHERENCE_LABELS[data.ukCopStatus]}</Badge> : <span>Not captured</span>}
        </div>
        <div className="flex items-center justify-between border-t border-border py-1.5">
          <span className="text-text-secondary">Agreement expiry date</span>
          <span>{data.expiryDate ? formatDate(data.expiryDate) : "Not captured"}</span>
        </div>
        <div className="flex items-center justify-between border-t border-border py-1.5">
          <span className="text-text-secondary">Contract PDF</span>
          {data.contractUrl ? (
            <a href={data.contractUrl} target="_blank" rel="noreferrer" className="text-link-text hover:underline">
              View PDF
            </a>
          ) : (
            <span>Not captured</span>
          )}
        </div>
      </div>
      {kind === "CUSTOMER_AGREEMENT" && <RegulatoryBlock data={data} canEdit={canEdit} onAdd={() => setEditing(true)} />}
      {data.updatedByName && data.updatedByTeam && data.updatedAt && (
        <p className="mt-3 border-t border-border pt-3 text-meta text-text-secondary">
          Last updated by {data.updatedByName} ({TEAM_LABELS[data.updatedByTeam]}), {formatDateTime(data.updatedAt, zone)}
        </p>
      )}
    </Card>
  );
}
