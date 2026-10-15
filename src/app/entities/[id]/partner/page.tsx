import { notFound } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { CoverageStatus, Scheme, Team } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { OwnedBy } from "@/components/entity/OwnedBy";
import { ChangeCoverageStatusDialog } from "@/components/entity/partner/ChangeCoverageStatusDialog";
import { countryName } from "@/lib/countries";
import { daysBetween, formatDate, toLocalDate, today } from "@/lib/dates";
import { CONNECTION_METHOD_LABELS, ownedByLabel, SCHEME_LABELS } from "@/lib/labels";
import { coverageStatusLabel, coverageStatusVariant } from "@/lib/ui/status";
import { can } from "@/server/permissions/can";
import { CoverageCustomers, type CoverageCustomerRow } from "@/components/entity/partner/CoverageCustomers";
import { STAGE_ORDER } from "@/lib/labels";
import { loadLiveCoverageCustomers } from "@/server/queries/coverage-customers";
import { loadPartnerData, type PartnerData } from "@/server/queries/partner";
import { getCurrentUser } from "@/server/session";

type CoverageRow = PartnerData["coverageRows"][number];

function ConnectionMethodCard({ data }: { data: PartnerData }) {
  const pr = data.partnerRole;
  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-section">Connection method</h3>
        <span className="flex-1" />
        <OwnedBy label={ownedByLabel([Team.NETWORK])} />
      </div>
      {pr?.connectionMethod ? (
        <p className="text-body">
          {CONNECTION_METHOD_LABELS[pr.connectionMethod]}
          {pr.connectionMethod === "VIA_ROUTING_PROVIDER" && pr.providerName && ` · ${pr.providerName}`}
        </p>
      ) : (
        <p className="text-text-secondary">No connection method recorded</p>
      )}
    </Card>
  );
}

function CoverageTableRow({ row, canEdit, customers }: { row: CoverageRow; canEdit: boolean; customers?: CoverageCustomerRow[] }) {
  const since = row.current ? toLocalDate(row.current.effectiveDate) : null;
  const daysInStatus = since ? daysBetween(since, today()) : null;
  return (
    <div className="border-t border-border py-2.5 first:border-t-0">
      <details>
        <summary className="flex flex-wrap items-center gap-3 [&::-webkit-details-marker]:hidden">
          <ChevronDown className="size-3.5 shrink-0 text-text-secondary" aria-hidden="true" />
          <span className="w-36 shrink-0">
            {row.country} {countryName(row.country)}
          </span>
          {row.current ? (
            <Badge variant={coverageStatusVariant(row.current.status)}>{coverageStatusLabel(row.current.status)}</Badge>
          ) : (
            <span className="text-text-secondary">No current status</span>
          )}
          {row.scheduled && (
            <Badge variant="neutral-outline">Scheduled from {formatDate(toLocalDate(row.scheduled.effectiveDate))}</Badge>
          )}
          {since && <span className="text-meta text-text-secondary">since {formatDate(since)}</span>}
          {daysInStatus !== null && <span className="text-meta text-text-secondary">{daysInStatus} day{daysInStatus === 1 ? "" : "s"} in status</span>}
          {row.current?.reason && <span className="text-meta text-text-secondary">{row.current.reason}</span>}
          <span className="flex-1" />
          {canEdit && (
            <ChangeCoverageStatusDialog
              coverageId={row.id}
              version={row.version}
              country={row.country}
              schemeLabel={SCHEME_LABELS[row.scheme]}
              currentStatus={row.current?.status ?? null}
              currentEffectiveDate={since}
            />
          )}
        </summary>
        <div className="ml-6 mt-2 flex flex-col gap-1">
          {row.statusChanges.map((c) => (
            <p key={c.id} className="text-meta text-text-secondary">
              {coverageStatusLabel(c.status)} · effective {formatDate(toLocalDate(c.effectiveDate))} · {c.reason} · {c.user.name}
            </p>
          ))}
        </div>
      </details>
      {customers && <CoverageCustomers customers={customers} />}
    </div>
  );
}

function SchemeGroup({ scheme, rows, canEdit, customers }: { scheme: Scheme; rows: CoverageRow[]; canEdit: boolean; customers: Record<string, CoverageCustomerRow[]> }) {
  if (rows.length === 0) return null;
  return (
    // The guided scenario's impact step looks at the UK CoP coverage (data-onboarding anchor).
    <Card data-onboarding={scheme === "UK_COP" ? "partner-customers" : undefined}>
      <div className="mb-2 flex items-center gap-2">
        <Badge variant={scheme === "EU_VOP" ? "scheme-eu" : scheme === "UK_COP" ? "scheme-uk" : "neutral-outline"}>{SCHEME_LABELS[scheme]}</Badge>
        <span className="text-meta text-text-secondary">{rows.length}</span>
      </div>
      <div>
        {rows.map((r) => (
          <CoverageTableRow key={r.id} row={r} canEdit={canEdit} customers={customers[r.id]} />
        ))}
      </div>
    </Card>
  );
}

export default async function PartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, user] = await Promise.all([loadPartnerData(id), getCurrentUser()]);
  if (!data) notFound();

  const canEdit = can(user, "partner.coverage.changeStatus").ok;
  const schemes: Scheme[] = [Scheme.EU_VOP, Scheme.UK_COP, Scheme.GLOBAL_VALIDATION];
  const active = data.coverageRows.filter((r) => r.current?.status !== "RETIRED");
  const retired = data.coverageRows.filter((r) => r.current?.status === "RETIRED");
  // Customers on each active coverage: the same rule as "Affected customers" on a partner issue (coverage-customers.ts).
  const customers: Record<string, CoverageCustomerRow[]> = {};
  await Promise.all(
    active.map(async (r) => {
      const live = await loadLiveCoverageCustomers(r.scheme, r.country);
      customers[r.id] = live.map((c) => ({ entityId: c.entityId, entityName: c.entityName, stage: c.lines.map((l) => l.stage).sort((a, b) => STAGE_ORDER.indexOf(b) - STAGE_ORDER.indexOf(a))[0] }));
    }),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="text-section">Partner</h2>
        <span className="flex-1" />
        {!canEdit && <OwnedBy label={ownedByLabel([Team.NETWORK])} />}
      </div>
      <p className="text-meta text-text-secondary">
        {Object.entries(data.counts).length > 0
          ? Object.entries(data.counts)
              .map(([s, n]) => `${coverageStatusLabel(s as CoverageStatus)} ${n}`)
              .join(", ")
          : "No coverage recorded yet."}
      </p>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-1 basis-[300px] flex-col gap-4">
          <ConnectionMethodCard data={data} />
        </div>
        <div className="flex min-w-0 flex-1 basis-[560px] flex-col gap-4">
          {active.length === 0 ? (
            <p className="text-meta text-text-secondary">No coverage recorded yet.</p>
          ) : (
            schemes.map((s) => <SchemeGroup key={s} scheme={s} rows={active.filter((r) => r.scheme === s)} canEdit={canEdit} customers={customers} />)
          )}

          {retired.length > 0 && (
            <details>
              <summary className="cursor-pointer text-meta text-text-secondary">Retired coverage ({retired.length})</summary>
              <Card className="mt-2">
                {retired.map((r) => (
                  <CoverageTableRow key={r.id} row={r} canEdit={canEdit} />
                ))}
              </Card>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
