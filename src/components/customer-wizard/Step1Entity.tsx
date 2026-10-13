"use client";

import * as React from "react";
import { EntityType } from "@prisma/client";

import { apiRequest } from "@/lib/api-client";
import { formatDate } from "@/lib/dates";
import { formatDateTime } from "@/lib/time-zones";
import { ENTITY_TYPE_LABELS } from "@/lib/labels";
import { leiStatusLabel, leiStatusVariant } from "@/lib/ui/status";
import { normaliseLei } from "@/lib/validation/lei";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Banner } from "@/components/customer-wizard/Banner";
import { DuplicatePanel } from "@/components/customer-wizard/DuplicatePanel";
import type { DuplicateMatch, EntityState, FieldErrors, GleifLookupResponse } from "@/components/customer-wizard/types";
import { FieldError } from "@/components/ui/field-error";

const BLOCKING_STATUSES = new Set(["RETIRED", "MERGED", "ANNULLED", "DUPLICATE"]);

function GtagCache({ source, fetchedAt, zone }: { source: "LIVE" | "CACHE" | null; fetchedAt: string | null; zone: string }) {
  if (!fetchedAt) return null;
  if (source === "CACHE") {
    return <span className="text-meta text-text-secondary">From GLEIF (cached copy, {formatDateTime(new Date(fetchedAt), zone)})</span>;
  }
  return <span className="text-meta text-text-secondary">From GLEIF, {formatDateTime(new Date(fetchedAt), zone)}</span>;
}

function ChipInput({
  values,
  onChange,
  placeholder,
  uppercase,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  uppercase?: boolean;
}) {
  const [draft, setDraft] = React.useState("");
  function commit() {
    const v = uppercase ? draft.trim().toUpperCase() : draft.trim();
    if (!v) return;
    onChange([...values, v]);
    setDraft("");
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-sm border border-border-strong bg-white px-2 py-1.5">
      {values.map((v, i) => (
        <Badge key={`${v}-${i}`} variant="neutral-outline">
          {v}
          <button type="button" aria-label="Remove" onClick={() => onChange(values.filter((_, j) => j !== i))}>
            ×
          </button>
        </Badge>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        placeholder={values.length === 0 ? placeholder : ""}
        className="min-w-[100px] flex-1 border-0 text-body outline-none placeholder:text-text-disabled"
      />
    </div>
  );
}

export function Step1Entity({
  entity,
  setEntity,
  groups,
  errors,
  duplicates,
  duplicatesLoading,
  isAdmin,
  zone,
}: {
  entity: EntityState;
  setEntity: (updater: (prev: EntityState) => EntityState) => void;
  groups: { id: string; name: string }[];
  errors: FieldErrors;
  duplicates: DuplicateMatch[];
  duplicatesLoading: boolean;
  isAdmin: boolean;
  zone: string;
}) {
  const [leiDraft, setLeiDraft] = React.useState(entity.lei);
  const [looking, setLooking] = React.useState(false);
  const [lookupError, setLookupError] = React.useState<string | null>(null);

  async function lookup() {
    const lei = normaliseLei(leiDraft);
    setLooking(true);
    setLookupError(null);
    try {
      const result = await apiRequest<GleifLookupResponse>("/api/gleif/lookup", "POST", { lei });
      if (!result.ok) {
        if (result.kind === "validation") setLookupError(result.fieldErrors.lei?.[0] ?? "Enter a valid LEI");
        else setLookupError("Could not look up this LEI. Try again.");
        return;
      }
      const data = result.data;
      setEntity((prev) => ({
        ...prev,
        lei,
        legalName: data.fields.gleifLegalName ?? prev.legalName,
        country: data.fields.gleifCountry ?? prev.country,
        groupId: data.groupSuggestion?.id ?? prev.groupId,
        groupSuggested: Boolean(data.groupSuggestion),
        gleif: data.fields,
        gleifLookup: data,
      }));
    } finally {
      setLooking(false);
    }
  }

  const gleif = entity.gleif;
  const lookupResponse = entity.gleifLookup;
  const record = lookupResponse?.record ?? null;
  const status = gleif?.leiStatus ?? null;
  const notFound = gleif?.gleifRawStatus === "NOT_FOUND";
  const unavailable = gleif?.gleifSource === "MANUAL";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Legal entity</CardTitle>
          </CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="wz-lei" className="text-meta text-text-secondary">LEI *</label>
              <div className="flex gap-2">
                <Input
                  id="wz-lei"
                  className="font-mono uppercase"
                  value={leiDraft}
                  onChange={(e) => setLeiDraft(e.target.value)}
                  aria-invalid={!!(lookupError || errors.lei)}
                />
                <Button type="button" variant="secondary" onClick={() => void lookup()} loading={looking}>
                  Look up
                </Button>
              </div>
              {(lookupError || errors.lei) && <FieldError>{lookupError ?? errors.lei?.[0]}</FieldError>}
              {status && (
                <div className="flex min-h-[22px] items-center gap-2">
                  <Badge variant={leiStatusVariant(status)}>{leiStatusLabel(status)}</Badge>
                </div>
              )}
            </div>

            {notFound && <Banner variant="danger">No GLEIF record for {entity.lei}. Check the LEI with the customer.</Banner>}
            {unavailable && (
              <div className="flex flex-col gap-1">
                <Badge variant="neutral">Not verified with GLEIF</Badge>
                <span className="text-meta text-text-secondary">The record saves with this label.</span>
              </div>
            )}
            {status === "LAPSED" && gleif?.leiNextRenewalDate && (
              <Banner variant="warning">LEI lapsed on {formatDate(gleif.leiNextRenewalDate)}</Banner>
            )}
            {(status === "PENDING_TRANSFER" || status === "PENDING_ARCHIVAL") && (
              <Banner variant="warning">LEI status: {leiStatusLabel(status)}</Banner>
            )}
            {status && BLOCKING_STATUSES.has(status) && (
              <Banner variant="danger">This LEI is no longer valid for this entity. Status: {leiStatusLabel(status)}</Banner>
            )}

            {gleif && !unavailable && !notFound && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <label className="text-meta text-text-secondary">Legal name *</label>
                  <GtagCache source={entity.gleifLookup?.source ?? null} fetchedAt={entity.gleifLookup?.fetchedAt ?? null} zone={zone} />
                </div>
                <div className="flex h-9 items-center rounded-sm border border-border-strong bg-tint px-3 text-body text-text">{entity.legalName}</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              {gleif && !unavailable && !notFound ? (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <label className="text-meta text-text-secondary">Country *</label>
                    <GtagCache source={entity.gleifLookup?.source ?? null} fetchedAt={entity.gleifLookup?.fetchedAt ?? null} zone={zone} />
                  </div>
                  <div className="flex h-9 items-center rounded-sm border border-border-strong bg-tint px-3 text-body text-text">{entity.country}</div>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <label className="text-meta text-text-secondary">Country *</label>
                  <div className="flex h-9 items-center rounded-sm border border-border-strong bg-tint px-3 text-body text-text-disabled">—</div>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-meta text-text-secondary">Type *</label>
                <div className="flex overflow-hidden rounded-sm border border-border-strong">
                  {Object.values(EntityType).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEntity((prev) => ({ ...prev, type: t }))}
                      className={`h-9 flex-1 text-body ${entity.type === t ? "bg-selected font-medium text-primary" : "bg-white text-text-secondary"}`}
                    >
                      {ENTITY_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
                {errors.type && <FieldError>{errors.type[0]}</FieldError>}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <label htmlFor="wz-group" className="text-meta text-text-secondary">Group</label>
                {entity.groupSuggested && <span className="text-meta text-text-secondary">Suggested from GLEIF parent</span>}
              </div>
              <Select value={entity.groupId ?? "__none__"} onValueChange={(v) => setEntity((prev) => ({ ...prev, groupId: v === "__none__" ? null : v, groupSuggested: false }))}>
                <SelectTrigger id="wz-group">
                  <SelectValue placeholder="No group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No group</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-meta text-text-secondary">BICs</label>
                <ChipInput values={entity.bics} onChange={(v) => setEntity((prev) => ({ ...prev, bics: v }))} placeholder="e.g. ABBYGB2L" uppercase />
                <span className="text-meta text-text-secondary">Press Enter to add each BIC</span>
                {errors["bics.0"] && <FieldError>{errors["bics.0"][0]}</FieldError>}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-meta text-text-secondary">Aliases</label>
                <ChipInput values={entity.aliases} onChange={(v) => setEntity((prev) => ({ ...prev, aliases: v }))} placeholder="SCB Austria" />
                <span className="text-meta text-text-secondary">100 characters or fewer</span>
              </div>
            </div>
          </div>
        </Card>

        {gleif && lookupResponse && record && (
          <Card>
            <CardHeader>
              <CardTitle>GLEIF record</CardTitle>
              <span className="flex-1" />
              <span className="text-meta text-text-secondary">Read-only</span>
            </CardHeader>
            <dl className="flex flex-col gap-2">
              {([
                ["Legal name", record.legalName],
                ["Legal address country", record.legalAddressCountry],
                ["LEI registration status", <Badge key="s" variant={leiStatusVariant(gleif.leiStatus)}>{leiStatusLabel(gleif.leiStatus)}</Badge>],
                ["Next renewal date", record.nextRenewalDate ? formatDate(record.nextRenewalDate) : "—"],
                ["Direct parent", record.directParent ? `${record.directParent.legalName} · ${record.directParent.lei}` : "None"],
                ["Ultimate parent", record.ultimateParent ? `${record.ultimateParent.legalName} · ${record.ultimateParent.lei}` : "None"],
                ["Lookup time", lookupResponse.fetchedAt ? formatDateTime(new Date(lookupResponse.fetchedAt), zone) : "—"],
              ] as const).map(([label, value]) => (
                <div key={label} className="grid grid-cols-[160px_1fr] gap-3 border-t border-border py-2 first:border-t-0">
                  <dt className="text-meta text-text-secondary">{label}</dt>
                  <dd className="flex flex-wrap items-center gap-2 text-body text-text">
                    {value}
                    <span className="text-meta text-text-secondary">
                      {lookupResponse.source === "CACHE"
                        ? `From GLEIF (cached copy, ${lookupResponse.fetchedAt ? formatDateTime(new Date(lookupResponse.fetchedAt), zone) : ""})`
                        : "From GLEIF"}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        )}
      </div>

      <DuplicatePanel
        matches={duplicates}
        loading={duplicatesLoading}
        isAdmin={isAdmin}
        confirmDuplicate={entity.confirmDuplicate}
        onConfirmChange={(v) => setEntity((prev) => ({ ...prev, confirmDuplicate: v }))}
        duplicateReason={entity.duplicateReason}
        onReasonChange={(v) => setEntity((prev) => ({ ...prev, duplicateReason: v }))}
        errors={errors}
      />
    </div>
  );
}

export function step1Blocked(entity: EntityState, hasDuplicates: boolean): boolean {
  const gleif = entity.gleif;
  if (!gleif) return true;
  if (BLOCKING_STATUSES.has(gleif.leiStatus)) return true;
  if (gleif.gleifRawStatus === "NOT_FOUND") return true;
  if (gleif.gleifSource === "MANUAL") return true;
  if (!entity.type) return true;
  if (hasDuplicates && (!entity.confirmDuplicate || entity.duplicateReason.trim().length < 10)) return true;
  return false;
}
