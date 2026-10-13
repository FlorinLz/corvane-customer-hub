import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { OwnedBy } from "@/components/entity/OwnedBy";
import { ReportIssueDrawer } from "@/components/issues/ReportIssueDrawer";
import { countryName } from "@/lib/countries";
import { ownedByLabel, SCHEME_LABELS, STAGE_LABELS } from "@/lib/labels";
import { Team } from "@prisma/client";
import { leiStatusLabel, leiStatusVariant } from "@/lib/ui/status";
import { effectiveTimeZone } from "@/lib/time-zones";
import { loadGroupData, type GroupData } from "@/server/queries/group";
import { getCurrentUser } from "@/server/session";

function ExposureTile({ label, children, warn }: { label: string; children: React.ReactNode; warn?: boolean }) {
  return (
    <div className={`flex flex-1 basis-[180px] flex-col gap-1 rounded-md border p-3 ${warn ? "border-due bg-tint" : "border-border bg-surface"}`}>
      <span className="text-meta text-text-secondary">{label}</span>
      <span className={`text-body ${warn ? "text-due font-medium" : ""}`}>{children}</span>
    </div>
  );
}

function ContractsPanel({ data }: { data: GroupData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contracts</CardTitle>
      </CardHeader>
      {data.contracts.length === 0 ? (
        <p className="text-text-secondary">No group contracts recorded</p>
      ) : (
        <div className="flex flex-col gap-2">
          {data.contracts.map((c) => (
            <div key={c.id} className="border-t border-border pt-2 text-meta text-text-secondary first:border-t-0 first:pt-0">
              <span className="font-medium text-text">{c.contractId}</span> · {c.title} · {c.scope === "GROUP_MASTER_AGREEMENT" ? "Group master agreement" : "Entity contract"} · Applies to{" "}
              {c.customerRoles.length} entities: {c.customerRoles.map((cr) => cr.entity.legalName).join(", ")} · Invoiced: {c.invoicedEntity?.legalName ?? "—"}{" "}
              <a href={c.documentUrl} target="_blank" rel="noreferrer" className="text-link-text hover:underline">
                View document
              </a>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function MemberTable({ data }: { data: GroupData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Member entities</CardTitle>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-meta">
          <thead>
            <tr className="border-b border-border text-text-secondary">
              <th className="py-2 pr-3">Legal name</th>
              <th className="py-2 pr-3">Country</th>
              <th className="py-2 pr-3">LEI</th>
              <th className="py-2 pr-3">BICs</th>
              <th className="py-2 pr-3">Roles</th>
              <th className="py-2 pr-3">Applicable contract</th>
              <th className="py-2 pr-3">Invoiced entity</th>
              <th className="py-2 pr-3">Products and stages</th>
            </tr>
          </thead>
          <tbody>
            {data.entities.map((e) => (
              <tr key={e.id} className="border-b border-border align-top">
                <td className="py-2 pr-3">
                  <Link href={`/entities/${e.id}/overview`} className="text-link-text hover:underline">
                    {e.legalName}
                  </Link>
                </td>
                <td className="py-2 pr-3">{e.country ?? "—"}</td>
                <td className="py-2 pr-3">
                  {e.lei ? (
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono">{e.lei}</span>
                      {e.leiStatus && <Badge variant={leiStatusVariant(e.leiStatus)}>{leiStatusLabel(e.leiStatus)}</Badge>}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2 pr-3">{e.bics.length > 0 ? e.bics.map((b) => b.bic).join(", ") : "—"}</td>
                <td className="py-2 pr-3">
                  <div className="flex gap-1">
                    {e.customerRole?.active && <Badge variant="selected">Customer</Badge>}
                    {e.partnerRole?.active && <Badge variant="selected">Network partner</Badge>}
                  </div>
                </td>
                <td className="py-2 pr-3">
                  {e.customerRole?.contract ? (
                    <span>
                      {e.customerRole.contract.contractId} · {e.customerRole.contract.title}
                    </span>
                  ) : e.customerRole?.active ? (
                    <Badge variant="due-outline">No contract attached</Badge>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2 pr-3">{e.customerRole?.contract?.invoicedEntity?.legalName ?? "—"}</td>
                <td className="py-2 pr-3">
                  {e.products.length > 0 ? (
                    <div className="flex flex-col gap-0.5">
                      {e.products.map((p) => (
                        <span key={p.id}>
                          {SCHEME_LABELS[p.product]} {p.country} · {STAGE_LABELS[p.stage]}
                        </span>
                      ))}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, user] = await Promise.all([loadGroupData(id), getCurrentUser()]);
  if (!data) notFound();

  const { group, tiles } = data;

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-6 py-6">
      <div className="flex flex-col gap-2 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-page">{group.name}</h1>
          <span className="flex-1" />
          <ReportIssueDrawer mode="group" groupId={group.id} groupName={group.name} members={data.entities.map((e) => ({ id: e.id, legalName: e.legalName }))} viewerZone={effectiveTimeZone(user)} />
          <OwnedBy label={ownedByLabel([Team.OPS])} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-text-secondary">
          <span>Parent: {group.parentLegalName ?? "Not recorded"}</span>
          {group.parentLei && (
            <span className="flex items-center gap-1">
              <span className="font-mono">{group.parentLei}</span>
              {group.parentLeiStatus === "NOT_VERIFIED" ? "Not verified with GLEIF" : "From GLEIF"}
            </span>
          )}
          <span>Headquarters: {group.hqCountry}, {countryName(group.hqCountry)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <ExposureTile label="Entities">{tiles.entityCount}</ExposureTile>
        <ExposureTile label="Roles">
          Customer {tiles.customerCount} · Network partner {tiles.partnerCount} · Both {tiles.bothCount}
        </ExposureTile>
        <ExposureTile label="Product lines by stage">
          {tiles.stageList.length > 0 ? tiles.stageList.map((s) => `${STAGE_LABELS[s.stage]} ${s.count}`).join(" · ") : "None"}
        </ExposureTile>
        <ExposureTile label="Countries">{tiles.countries.length > 0 ? tiles.countries.join(", ") : "None"}</ExposureTile>
        <ExposureTile label="No contract attached" warn={tiles.noContractCount > 0}>
          {tiles.noContractCount}
        </ExposureTile>
      </div>

      <ContractsPanel data={data} />
      <MemberTable data={data} />
    </div>
  );
}
