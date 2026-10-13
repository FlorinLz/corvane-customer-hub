"use client";

import { Scheme } from "@prisma/client";

import { formatDate } from "@/lib/dates";
import { CONTACT_ROLE_LABELS, ENTITY_TYPE_LABELS, SCHEME_LABELS } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Banner } from "@/components/customer-wizard/Banner";
import type { ContactsState, EntityState, FieldErrors, HandoffState, ProductsState } from "@/components/customer-wizard/types";
import { FieldError } from "@/components/ui/field-error";

const SCHEME_BADGE_VARIANT: Record<Scheme, "scheme-eu" | "scheme-uk" | "neutral-outline"> = {
  EU_VOP: "scheme-eu",
  UK_COP: "scheme-uk",
  GLOBAL_VALIDATION: "neutral-outline",
};

function SummaryCard({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <Card aria-label={title}>
      <div className="mb-3 flex min-h-8 items-center gap-2">
        <h2 className="text-section flex-1">{title}</h2>
        <button type="button" onClick={onEdit} className="text-meta font-medium text-link underline">
          Edit
        </button>
      </div>
      {children}
    </Card>
  );
}

function Kv({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 border-t border-border py-2 first:border-t-0">
      <dt className="text-meta text-text-secondary">{label}</dt>
      <dd className="text-body text-text">{children}</dd>
    </div>
  );
}

export function Step4Handoff({
  entity,
  products,
  contacts,
  handoff,
  setHandoff,
  groupName,
  contractingEntityNames,
  opsUsers,
  onEditStep,
  onBack,
  errors,
  submitting,
  submitError,
  onSubmit,
  onRetry,
}: {
  entity: EntityState;
  products: ProductsState;
  contacts: ContactsState;
  handoff: HandoffState;
  setHandoff: (updater: (prev: HandoffState) => HandoffState) => void;
  groupName: string | null;
  contractingEntityNames: Map<string, string>;
  opsUsers: { id: string; name: string }[];
  onEditStep: (step: number) => void;
  onBack: () => void;
  errors: FieldErrors;
  submitting: boolean;
  submitError: string | null;
  onSubmit: () => void;
  onRetry: () => void;
}) {
  const noOpsUsers = opsUsers.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <SummaryCard title="Entity" onEdit={() => onEditStep(1)}>
        <dl>
          <Kv label="Legal name">{entity.legalName}</Kv>
          <Kv label="LEI">
            <span className="font-mono">{entity.lei}</span>
          </Kv>
          <Kv label="Type">{entity.type ? ENTITY_TYPE_LABELS[entity.type] : "—"}</Kv>
          <Kv label="Country">{entity.country}</Kv>
          <Kv label="Group">{groupName ?? "Standalone"}</Kv>
          <Kv label="BICs">{entity.bics.length > 0 ? entity.bics.join(", ") : <span className="text-meta text-text-secondary">None</span>}</Kv>
          <Kv label="Aliases">{entity.aliases.length > 0 ? entity.aliases.join(", ") : <span className="text-meta text-text-secondary">None</span>}</Kv>
          {entity.duplicateReason && <Kv label="Overrides">Duplicate warning acknowledged: {entity.duplicateReason}</Kv>}
        </dl>
      </SummaryCard>

      <SummaryCard title="Products" onEdit={() => onEditStep(2)}>
        <table className="w-full border-collapse text-body">
          <thead>
            <tr className="border-b border-border text-left text-meta text-text-secondary">
              <th className="py-2">Product or scheme</th>
              <th className="py-2">Country</th>
              <th className="py-2">Contracting entity</th>
              <th className="py-2">Target go-live</th>
            </tr>
          </thead>
          <tbody>
            {products.productLines.map((line, i) => (
              <tr key={i} className="border-b border-border last:border-b-0">
                <td className="py-2">{line.product && <Badge variant={SCHEME_BADGE_VARIANT[line.product]}>{SCHEME_LABELS[line.product]}</Badge>}</td>
                <td className="py-2">{line.country}</td>
                <td className="py-2">{contractingEntityNames.get(line.contractingEntityId) ?? ""}</td>
                <td className="py-2">{line.targetGoLive ? formatDate(line.targetGoLive) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SummaryCard>

      <SummaryCard title="Commercial terms and SLAs" onEdit={() => onEditStep(2)}>
        <dl>
          <Kv label="Currency">{products.currency}</Kv>
          <Kv label="Price per verification">
            {products.currency} {products.pricePerVerification !== "" ? Number(products.pricePerVerification).toFixed(4) : ""}
          </Kv>
          <Kv label="Volume tiers">
            {products.volumeTiers.map((t, i) => (
              <span key={i} className="block">
                {t.toVolume === null ? `From ${t.fromVolume.toLocaleString("en-GB")}` : `${t.fromVolume.toLocaleString("en-GB")} to ${t.toVolume.toLocaleString("en-GB")}`} at{" "}
                {t.pricePerVerification !== "" ? Number(t.pricePerVerification).toFixed(4) : ""}
              </span>
            ))}
          </Kv>
          <Kv label="Monthly minimum">{products.monthlyMinimum !== "" ? `${products.currency} ${Number(products.monthlyMinimum).toLocaleString("en-GB")}` : "—"}</Kv>
          <Kv label="Payment term">{products.paymentTermDays} days</Kv>
          <Kv label="Availability">{products.availabilityPct !== "" ? `${products.availabilityPct}%` : "—"}</Kv>
          <Kv label="Maximum response time">{products.maxResponseMs !== "" ? `${products.maxResponseMs} ms` : "—"}</Kv>
        </dl>
      </SummaryCard>

      <SummaryCard title="Initial contacts" onEdit={() => onEditStep(3)}>
        <div className="flex flex-col gap-2">
          {contacts.contacts.map((c, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="font-medium text-text">{c.fullName}</span>
                <Badge variant="selected">{CONTACT_ROLE_LABELS[c.role]}</Badge>
                <Badge variant="success">Active</Badge>
              </div>
              {c.jobTitle && <span>{c.jobTitle}</span>}
              <span className="text-meta text-text-secondary">
                {[c.email, c.phone, c.timeZone, c.available24x7 ? "24/7" : `${c.start} to ${c.end}`].filter(Boolean).join(" · ")}
              </span>
            </div>
          ))}
        </div>
      </SummaryCard>

      <Card>
        <div className="mb-3 flex min-h-8 items-center">
          <h2 className="text-section">Handoff</h2>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="wz-notes" className="text-meta text-text-secondary">Notes for Onboarding</label>
          <Textarea
            id="wz-notes"
            value={handoff.notesForOnboarding}
            onChange={(e) => setHandoff((prev) => ({ ...prev, notesForOnboarding: e.target.value }))}
            className="min-h-[88px]"
            maxLength={2000}
          />
          <div className="flex justify-end">
            <span className="text-meta text-text-secondary">{handoff.notesForOnboarding.length} / 2,000</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="wz-om" className="text-meta text-text-secondary">Onboarding Manager *</label>
          <Select value={handoff.onboardingManagerId} onValueChange={(v) => setHandoff((prev) => ({ ...prev, onboardingManagerId: v }))}>
            <SelectTrigger id="wz-om">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {opsUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name} (Ops)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors["handoff.onboardingManagerId"] && <FieldError>{errors["handoff.onboardingManagerId"][0]}</FieldError>}
        </div>
      </Card>

      {submitError && (
        <Banner variant="danger">
          <div className="flex w-full items-center justify-between gap-3">
            <span>{submitError}</span>
            <Button type="button" variant="secondary" onClick={onRetry}>
              Try again
            </Button>
          </div>
        </Banner>
      )}

      <div className="flex items-center gap-2 border-t border-border pt-4">
        <Button type="button" variant="secondary" onClick={onBack} disabled={submitting}>
          Back
        </Button>
        <span className="flex-1" />
        <Button
          type="button"
          size="lg"
          disabled={noOpsUsers || submitting}
          loading={submitting}
          title={noOpsUsers ? "No active Ops users are available to receive this handoff" : undefined}
          onClick={onSubmit}
        >
          {submitting ? "Creating customer..." : "Create customer and hand over"}
        </Button>
      </div>
    </div>
  );
}
