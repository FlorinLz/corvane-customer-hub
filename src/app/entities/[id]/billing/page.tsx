import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Team } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { OwnedBy } from "@/components/entity/OwnedBy";
import { countryName } from "@/lib/countries";
import { daysBetween, toLocalDate, today } from "@/lib/dates";
import { CONTRACT_SCOPE_LABELS, ownedByLabel } from "@/lib/labels";
import { loadBillingData, type BillingData } from "@/server/queries/billing";

function ProfileField({ label, value, flag }: { label: string; value: string | null; flag: "missing" | "invalid" | null }) {
  return (
    <div className={`flex flex-col gap-0.5 ${flag ? "border-l-2 border-due pl-2" : ""}`}>
      <span className="text-meta text-text-secondary">{label}</span>
      <span className="text-body">{value ?? "—"}</span>
      {flag && <span className="text-meta text-due">{flag === "missing" ? "Missing" : "Invalid format"}</span>}
    </div>
  );
}

function IncompleteBanner({ data }: { data: BillingData }) {
  const { missingFields, invalidFields } = data.billingFlag;
  if (missingFields.length === 0 && invalidFields.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 rounded-md border border-due bg-tint px-4 py-3 text-due">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <p className="text-body">
            Incomplete for billing.
            {missingFields.length > 0 && ` Missing: ${missingFields.join(", ")}.`}
            {invalidFields.length > 0 && ` Invalid format: ${invalidFields.join(", ")}.`}
          </p>
          {missingFields.includes("Contract reference") && (
            <Link href={`/entities/${data.entity.id}/details`} className="text-meta text-link-text hover:underline">
              Ops attaches the contract on the Customer role
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function BillingProfileCard({ data }: { data: BillingData }) {
  const p = data.billingProfile;
  const { missingFields, invalidFields } = data.billingFlag;
  const flagFor = (label: string): "missing" | "invalid" | null =>
    missingFields.includes(label) ? "missing" : invalidFields.includes(label) ? "invalid" : null;

  if (!data.entity.customerRole?.active) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Billing profile</CardTitle>
          <span className="flex-1" />
          <OwnedBy label={ownedByLabel([Team.FINANCE])} />
        </CardHeader>
        <p className="text-text-secondary">Billing profile not required: partner role only</p>
      </Card>
    );
  }

  if (data.billingFlag.billedThrough) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Billing profile</CardTitle>
          <span className="flex-1" />
          <OwnedBy label={ownedByLabel([Team.FINANCE])} />
        </CardHeader>
        <p className="text-body">
          Billed through{" "}
          <Link href={`/entities/${data.contract?.invoicedEntityId}/billing`} className="text-link-text hover:underline">
            {data.billingFlag.billedThrough}
          </Link>
        </p>
      </Card>
    );
  }

  if (!p) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Billing profile</CardTitle>
          <span className="flex-1" />
          <OwnedBy label={ownedByLabel([Team.FINANCE])} />
        </CardHeader>
        <p className="text-text-secondary">No billing profile yet</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing profile</CardTitle>
        <span className="flex-1" />
        {!data.billingFlag.incomplete && <span className="text-meta text-success">Billing profile complete</span>}
        <OwnedBy label={ownedByLabel([Team.FINANCE])} />
      </CardHeader>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ProfileField label="Billing legal name" value={p.billingLegalName} flag={flagFor("Billing legal name")} />
        <ProfileField label="Street" value={p.street} flag={flagFor("Street")} />
        <ProfileField label="City" value={p.city} flag={flagFor("City")} />
        <ProfileField label="Postal code" value={p.postalCode} flag={flagFor("Postal code")} />
        <ProfileField label="Country" value={p.country ? `${p.country}, ${countryName(p.country)}` : null} flag={flagFor("Country")} />
        <ProfileField label="VAT / tax ID" value={p.vatId} flag={flagFor("VAT / tax ID")} />
        <ProfileField label="LEI" value={p.lei} flag={flagFor("LEI")} />
        <ProfileField label="Contracting Corvane entity" value={p.contractingEntity} flag={flagFor("Contracting Corvane entity")} />
      </div>
    </Card>
  );
}

function ContractReferenceCard({ data }: { data: BillingData }) {
  const c = data.contract;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contract reference</CardTitle>
        <span className="flex-1" />
        <OwnedBy label={ownedByLabel([Team.OPS])} />
      </CardHeader>
      {c ? (
        <div className="flex flex-col gap-1">
          <p className="font-medium">{c.contractId}</p>
          <p className="text-body">{c.title}</p>
          <p className="text-meta text-text-secondary">{CONTRACT_SCOPE_LABELS[c.scope]}</p>
          <p className="text-meta text-text-secondary">Invoiced entity: {c.invoicedEntity?.legalName ?? data.entity.legalName}</p>
          <a href={c.documentUrl} target="_blank" rel="noreferrer" className="text-meta text-link-text hover:underline">
            View document
          </a>
          <Link href={`/entities/${data.entity.id}/details`} className="text-meta text-link-text hover:underline">
            View on the Details tab
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <Badge variant="due-outline" className="w-fit">No contract attached</Badge>
          <Link href={`/entities/${data.entity.id}/details`} className="text-meta text-link-text hover:underline">
            Ops attaches the contract on the Customer role
          </Link>
        </div>
      )}
    </Card>
  );
}

function BillingContactsCard({ data }: { data: BillingData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing contacts</CardTitle>
        <span className="flex-1" />
        <Link href={`/entities/${data.entity.id}/contacts`} className="text-meta text-link-text hover:underline">
          Manage in Contacts
        </Link>
      </CardHeader>
      {data.billingContacts.length === 0 ? (
        <p className="text-text-secondary">No active billing contacts</p>
      ) : (
        <div className="flex flex-col gap-2">
          {data.billingContacts.map((c) => {
            const verifiedDaysAgo = c.lastVerifiedAt ? daysBetween(toLocalDate(c.lastVerifiedAt), today()) : null;
            return (
              <div key={c.id} className="border-t border-border pt-2 first:border-t-0 first:pt-0">
                <p className="text-body font-medium">{c.fullName}</p>
                <p className="text-meta text-text-secondary">
                  {c.email}
                  {c.phone && ` · ${c.phone}`}
                </p>
                {verifiedDaysAgo !== null && (
                  <p className="text-meta text-text-secondary">
                    Verified {verifiedDaysAgo === 0 ? "today" : `${verifiedDaysAgo} day${verifiedDaysAgo === 1 ? "" : "s"} ago`}
                    {c.lastVerifiedBy && ` by ${c.lastVerifiedBy.name}`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default async function BillingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadBillingData(id);
  if (!data) notFound();

  return (
    <div className="flex flex-col gap-4">
      {data.billingFlag.applies && <IncompleteBanner data={data} />}
      <BillingProfileCard data={data} />
      <ContractReferenceCard data={data} />
      <BillingContactsCard data={data} />
    </div>
  );
}
