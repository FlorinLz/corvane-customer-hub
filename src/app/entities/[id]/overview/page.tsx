import Link from "next/link";
import { getCurrentUser } from "@/server/session";
import { effectiveTimeZone } from "@/lib/time-zones";
import { historySummary } from "@/lib/time-correction";
import { notFound } from "next/navigation";
import { AlertTriangle, CircleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, toLocalDate } from "@/lib/dates";
import { CONTACT_ROLE_LABELS, SCHEME_LABELS, STAGE_LABELS, TEAM_LABELS } from "@/lib/labels";
import { loadOverviewData, type OverviewData } from "@/server/queries/overview";

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-meta text-link-text no-underline hover:underline">
      {children}
    </Link>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex size-5 items-center justify-center rounded-full bg-tint text-[12px] font-medium text-text-secondary">
      {count}
    </span>
  );
}

const ALERT_TAB_LABELS: Record<OverviewData["alerts"][number]["opens"], string> = {
  products: "Products & onboarding",
  contacts: "Contacts",
  compliance: "Compliance",
  billing: "Billing",
  details: "Details",
  partner: "Partner",
};

function AlertsSection({ alerts, entityId }: { alerts: OverviewData["alerts"]; entityId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active alerts</CardTitle>
        {alerts.length > 0 && <CountBadge count={alerts.length} />}
      </CardHeader>
      {alerts.length === 0 ? (
        <p className="text-meta text-text-secondary">No active alerts</p>
      ) : (
        <div className="flex flex-col">
          {alerts.map((a, i) => (
            <div key={i} className="flex items-center gap-3 border-t border-border py-2.5 text-body text-text first:border-t-0">
              {a.severity === "CARMINE" ? (
                <CircleAlert className="size-4 shrink-0 text-danger" aria-hidden="true" />
              ) : (
                <AlertTriangle className="size-4 shrink-0 text-due" aria-hidden="true" />
              )}
              <span className="flex-1">{a.text}</span>
              <CardLink href={`/entities/${entityId}/${a.opens}`}>View in {ALERT_TAB_LABELS[a.opens]}</CardLink>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ProductsSection({ data, entityId }: { data: OverviewData; entityId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Products and stages</CardTitle>
        {data.products.length > 0 && <CountBadge count={data.products.length} />}
        <span className="flex-1" />
        <CardLink href={`/entities/${entityId}/products`}>View in Products & onboarding</CardLink>
      </CardHeader>
      {data.products.length === 0 ? (
        <p className="text-meta text-text-secondary">No products recorded</p>
      ) : (
        <div className="flex flex-col">
          {data.products.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border py-2.5 first:border-t-0">
              <span className="w-[150px] shrink-0">
                <Badge variant={p.product === "EU_VOP" ? "scheme-eu" : p.product === "UK_COP" ? "scheme-uk" : "neutral-outline"}>
                  {SCHEME_LABELS[p.product]}
                </Badge>
              </span>
              <span className="w-[150px] shrink-0 text-body">{p.country}</span>
              <div className="flex min-w-[200px] flex-1 flex-col">
                <span className="text-body">
                  {STAGE_LABELS[p.stage]} · in stage since {formatDate(toLocalDate(p.stageEnteredAt))}
                </span>
                <span className="text-meta text-text-secondary">Target go-live {formatDate(toLocalDate(p.targetGoLive))}</span>
                {p.contractingEntity.legalName !== data.entity.legalName && (
                  <span className="text-meta text-text-secondary">Contracting entity: {p.contractingEntity.legalName}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {p.blockedBy && <Badge variant="danger">Blocked</Badge>}
                {p.billableFrom && <Badge variant="success">Billable from {formatDate(toLocalDate(p.billableFrom))}</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}
      {data.partnerRole && data.coverageCounts && (
        <p className="mt-3 border-t border-border pt-3 text-meta text-text-secondary">
          Coverage: {Object.entries(data.coverageCounts).map(([status, n]) => `${status.charAt(0) + status.slice(1).toLowerCase()} ${n}`).join(", ") || "None"}
        </p>
      )}
    </Card>
  );
}

function InteractionsSection({ interactions, entityId, zone }: { interactions: OverviewData["interactions"]; entityId: string; zone: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest interactions</CardTitle>
        <span className="flex-1" />
        <CardLink href={`/entities/${entityId}/history`}>View in History</CardLink>
      </CardHeader>
      {interactions.length === 0 ? (
        <p className="text-meta text-text-secondary">No History entries yet</p>
      ) : (
        <div className="flex flex-col">
          {interactions.map((i) => (
            <div key={i.id} className="flex flex-col gap-0.5 border-t border-border py-2.5 first:border-t-0">
              <div className="flex flex-wrap items-center gap-2 text-meta text-text-secondary">
                {i.kind === "note" && <Badge variant="selected">{i.type}</Badge>}
                <span>{i.actorName ?? i.actorTeam}</span>
                {i.actorTeam && <span>· {TEAM_LABELS[i.actorTeam]}</span>}
                <span>· {formatDate(i.date.toISOString().slice(0, 10))}</span>
              </div>
              <p className="line-clamp-1 text-body">{historySummary(i as { summary: string; details?: unknown }, zone)}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function RolesSection({ data, entityId }: { data: OverviewData; entityId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles</CardTitle>
        <span className="flex-1" />
        <CardLink href={`/entities/${entityId}/details`}>View in Details</CardLink>
      </CardHeader>
      <div className="flex flex-col gap-4">
        {data.customerRole && (
          <div className="flex flex-col gap-1">
            <Badge variant="selected" className="w-fit">Customer</Badge>
            {data.customerRole.contract ? (
              <span className="text-body">
                {data.customerRole.contract.contractId}, {data.customerRole.contract.scope === "GROUP_MASTER_AGREEMENT" ? "Group master agreement" : "Entity contract"}
              </span>
            ) : (
              <Badge variant="due-outline" className="w-fit">No contract attached</Badge>
            )}
            <span className="text-meta text-text-secondary">
              {data.customerRole.renewalDate ? `Renewal date ${formatDate(toLocalDate(data.customerRole.renewalDate))}` : "No renewal date recorded"}
            </span>
          </div>
        )}
        {data.partnerRole && (
          <div className="flex flex-col gap-1">
            <Badge variant="selected" className="w-fit">Network partner</Badge>
            <span className="text-body">
              {data.partnerRole.connectionMethod
                ? data.partnerRole.connectionMethod === "VIA_ROUTING_PROVIDER"
                  ? `Via routing provider (${data.partnerRole.providerName})`
                  : data.partnerRole.connectionMethod === "VIA_SCHEME"
                    ? "Via scheme"
                    : "Direct"
                : "No connection method recorded"}
            </span>
            <span className="text-meta text-text-secondary">
              {data.partnerRole.partnerAgreement ? `Partner agreement ${data.partnerRole.partnerAgreement.contractId}` : "No partner agreement reference"}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

function KeyPeopleSection({ data, entityId }: { data: OverviewData; entityId: string }) {
  const hasBoth = data.entity.customerRole?.active && data.entity.partnerRole?.active;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Key people</CardTitle>
        <span className="flex-1" />
        <CardLink href={`/entities/${entityId}/contacts`}>View in Contacts</CardLink>
      </CardHeader>
      <div className="flex flex-col">
        {data.keyPeopleRows.map(({ role, customer, partner }) => (
          <div key={role} className="grid grid-cols-[84px_1fr] gap-x-2 gap-y-0.5 border-t border-border py-2 first:border-t-0">
            <span className="text-meta text-text-secondary">{CONTACT_ROLE_LABELS[role]}</span>
            <div className="flex flex-col gap-1">
              {customer ? (
                <span className="text-body">
                  {hasBoth && <span className="text-meta text-text-secondary">Customer: </span>}
                  {customer.fullName} · {customer.email}
                  {customer.lastVerifiedAt && ` · Verified ${formatDate(toLocalDate(customer.lastVerifiedAt))}`}
                </span>
              ) : data.entity.customerRole?.active && !partner ? (
                role === "INCIDENT" ? (
                  <span className="text-danger">No active incident contact</span>
                ) : (
                  <span className="text-text-secondary">No active {CONTACT_ROLE_LABELS[role].toLowerCase()} contact</span>
                )
              ) : null}
              {partner && (
                <span className="text-body">
                  {hasBoth && <span className="text-meta text-text-secondary">Partner: </span>}
                  {partner.fullName} · {partner.email}
                  {partner.lastVerifiedAt && ` · Verified ${formatDate(toLocalDate(partner.lastVerifiedAt))}`}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function OwnerSection({ data }: { data: OverviewData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Current owner</CardTitle>
      </CardHeader>
      {data.entity.owner ? (
        <p className="text-body">
          Owner: {data.entity.owner.name}, {TEAM_LABELS[data.entity.owner.team]}
          {data.entity.ownerSince && `, since ${formatDate(toLocalDate(data.entity.ownerSince))}`}
        </p>
      ) : (
        <Badge variant="due-outline">No owner</Badge>
      )}
    </Card>
  );
}

function GroupSection({ data }: { data: OverviewData }) {
  if (data.groupSiblings.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Other entities in this group</CardTitle>
      </CardHeader>
      <div className="flex flex-col">
        {data.groupSiblings.map((e) => (
          <Link
            key={e.id}
            href={`/entities/${e.id}/overview`}
            className="flex flex-col gap-0.5 border-t border-border py-2 text-body text-text no-underline first:border-t-0 hover:bg-tint"
          >
            <span className="font-medium text-link-text">{e.legalName}</span>
            <span className="text-meta text-text-secondary">
              {e.country} · {e.lei ?? "No LEI"} ·{" "}
              {[e.customerRole?.active && "Customer", e.partnerRole?.active && "Network partner"].filter(Boolean).join(", ")}
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, viewer] = await Promise.all([loadOverviewData(id), getCurrentUser()]);
  if (!data) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="sr-only">Overview</h2>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-1 basis-[560px] flex-col gap-4">
          <AlertsSection alerts={data.alerts} entityId={id} />
          <ProductsSection data={data} entityId={id} />
          <InteractionsSection interactions={data.interactions} entityId={id} zone={effectiveTimeZone(viewer)} />
        </div>
        <div className="flex min-w-0 flex-1 basis-[300px] flex-col gap-4">
          <RolesSection data={data} entityId={id} />
          <KeyPeopleSection data={data} entityId={id} />
          <OwnerSection data={data} />
          <GroupSection data={data} />
        </div>
      </div>
    </div>
  );
}
