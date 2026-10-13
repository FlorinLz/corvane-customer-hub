import Link from "next/link";
import { notFound } from "next/navigation";
import { Team } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { OwnedBy } from "@/components/entity/OwnedBy";
import { AttachContractDialog } from "@/components/entity/details/AttachContractDialog";
import { EditRenewalDateDialog } from "@/components/entity/details/EditRenewalDateDialog";
import { EditRolesDialog } from "@/components/entity/details/EditRolesDialog";
import { LinkEntityDialog } from "@/components/entity/details/LinkEntityDialog";
import { UnlinkEntityDialog } from "@/components/entity/details/UnlinkEntityDialog";
import { countryName } from "@/lib/countries";
import { formatDate, daysBetween, toLocalDate, today } from "@/lib/dates";
import { effectiveTimeZone, formatDateTime } from "@/lib/time-zones";
import { CONTRACT_SCOPE_LABELS, CONNECTION_METHOD_LABELS, ENTITY_TYPE_LABELS, TEAM_LABELS, ownedByLabel } from "@/lib/labels";
import { leiStatusLabel, leiStatusVariant, lifecycleLabel, lifecycleVariant } from "@/lib/ui/status";
import { can } from "@/server/permissions/can";
import { loadDetailsData, type DetailsData } from "@/server/queries/details";
import { loadGroupOptions } from "@/server/queries/group";
import { getCurrentUser } from "@/server/session";

interface Perms {
  canEditRoles: boolean;
  canEditGroup: boolean;
  canAttachContract: boolean;
  canEditRenewal: boolean;
  groups: { id: string; name: string }[];
  zone: string;
}

function formatPrice(currency: string, value: unknown): string {
  return `${currency} ${Number(value).toFixed(4)}`;
}

function formatAmount(currency: string, value: unknown): string {
  return `${currency} ${Number(value).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatVolume(n: number): string {
  return n.toLocaleString("en-GB");
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 border-t border-border py-2.5 first:border-t-0">
      <span className="text-meta text-text-secondary">{label}</span>
      <div className="text-body">{children}</div>
    </div>
  );
}

function EntityCoreCard({ data, perms }: { data: DetailsData; perms: Perms }) {
  const { entity } = data;
  const countryMismatch = entity.country && entity.gleifCountry && entity.country !== entity.gleifCountry;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Entity core</CardTitle>
        <span className="flex-1" />
        <OwnedBy label={ownedByLabel([Team.OPS])} />
      </CardHeader>
      <FieldRow label="Legal name">{entity.legalName}</FieldRow>
      <FieldRow label="Aliases">
        {entity.aliases.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {entity.aliases.map((a) => (
              <Badge key={a.id} variant="neutral-outline">{a.alias}</Badge>
            ))}
          </div>
        ) : (
          <span className="text-text-secondary">No aliases recorded</span>
        )}
      </FieldRow>
      <FieldRow label="Type">{entity.type ? ENTITY_TYPE_LABELS[entity.type] : <span className="text-text-secondary">Not set</span>}</FieldRow>
      <FieldRow label="Country">
        {entity.country ? (
          <div className="flex flex-col gap-0.5">
            <span>{entity.country}, {countryName(entity.country)}</span>
            {countryMismatch && <span className="text-meta text-due">GLEIF records {entity.gleifCountry} for this LEI</span>}
          </div>
        ) : (
          <span className="text-text-secondary">Not set</span>
        )}
      </FieldRow>
      <FieldRow label="LEI">
        {entity.lei ? (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-mono font-medium">{entity.lei}</span>
              {entity.leiStatus && <Badge variant={leiStatusVariant(entity.leiStatus)}>{leiStatusLabel(entity.leiStatus)}</Badge>}
            </div>
            {entity.gleifCheckedAt && <span className="text-meta text-text-secondary">From GLEIF, checked {formatDateTime(entity.gleifCheckedAt, perms.zone)}</span>}
          </div>
        ) : (
          <span className="text-text-secondary">Not set</span>
        )}
      </FieldRow>
      <FieldRow label="BICs">
        {entity.bics.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {entity.bics.map((b) => (
              <Badge key={b.id} variant="neutral-outline" className="font-mono">{b.bic}</Badge>
            ))}
          </div>
        ) : (
          <span className="text-text-secondary">No BICs recorded</span>
        )}
      </FieldRow>
      <FieldRow label="Group">
        <div className="flex flex-wrap items-center gap-3">
          {entity.group ? (
            <Link href={`/groups/${entity.group.id}`} className="text-link-text hover:underline">
              {entity.group.name}
            </Link>
          ) : entity.groupDecision === "STANDALONE" ? (
            "Standalone entity"
          ) : (
            <span className="text-due">Group not set</span>
          )}
          {perms.canEditGroup && entity.group ? (
            <UnlinkEntityDialog entityId={entity.id} entityName={entity.legalName} groupId={entity.group.id} groupName={entity.group.name} version={entity.version} />
          ) : perms.canEditGroup ? (
            <LinkEntityDialog entityId={entity.id} version={entity.version} groups={perms.groups} />
          ) : null}
        </div>
      </FieldRow>
    </Card>
  );
}

function RolesCard({ data, perms }: { data: DetailsData; perms: Perms }) {
  const { entity } = data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles</CardTitle>
        <span className="flex-1" />
        {perms.canEditRoles ? (
          <EditRolesDialog
            entityId={entity.id}
            version={entity.version}
            hasCustomer={entity.customerRole?.active ?? false}
            hasPartner={entity.partnerRole?.active ?? false}
          />
        ) : (
          <OwnedBy label={ownedByLabel([Team.OPS])} />
        )}
      </CardHeader>
      <div className="flex gap-2">
        {entity.customerRole?.active && <Badge variant="selected">Customer</Badge>}
        {entity.partnerRole?.active && <Badge variant="selected">Network partner</Badge>}
      </div>
    </Card>
  );
}

function ContractReferenceField({ contract, selfLegalName }: { contract: NonNullable<DetailsData["customerRole"]>["contract"]; selfLegalName: string }) {
  if (!contract) {
    return <Badge variant="due-outline">No contract attached</Badge>;
  }
  const invoicedName = contract.invoicedEntity?.legalName ?? selfLegalName;
  const appliesTo = contract.scope === "GROUP_MASTER_AGREEMENT" ? contract.customerRoles.length : null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium">{contract.contractId}</span>
      <span>{contract.title}</span>
      <span className="text-meta text-text-secondary">Signed {formatDate(toLocalDate(contract.signingDate))}</span>
      <span className="text-meta text-text-secondary">
        {CONTRACT_SCOPE_LABELS[contract.scope]}
        {appliesTo !== null && ` · Applies to ${appliesTo} entities`}
      </span>
      <span className="text-meta text-text-secondary">Invoiced entity: {invoicedName}</span>
      <a href={contract.documentUrl} target="_blank" rel="noreferrer" className="text-meta text-link-text hover:underline">
        View document
      </a>
    </div>
  );
}

function CustomerRoleCard({ data, perms }: { data: DetailsData; perms: Perms }) {
  const cr = data.customerRole;
  if (!cr) return null;
  const hasHandoff = cr.slaAvailabilityPct !== null || cr.slaMaxResponseMs !== null || cr.slaOther || cr.specialTerms || cr.entitiesNotInPortal || cr.notesForOnboarding;
  const hasCommercial = cr.currency !== null && cr.pricePerVerification !== null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer role</CardTitle>
      </CardHeader>
      <FieldRow label="Contract reference">
        <div className="mb-1 flex items-center gap-2">
          <OwnedBy label={ownedByLabel([Team.OPS])} />
          {perms.canAttachContract && !cr.contract && (
            <AttachContractDialog entityId={data.entity.id} entityName={data.entity.legalName} version={cr.version} groupMembers={data.groupMembers} />
          )}
        </div>
        <ContractReferenceField contract={cr.contract} selfLegalName={data.entity.legalName} />
      </FieldRow>
      <FieldRow label="Renewal date">
        <div className="mb-1 flex items-center gap-2">
          <OwnedBy label={ownedByLabel([Team.CS])} />
          {perms.canEditRenewal && <EditRenewalDateDialog entityId={data.entity.id} version={cr.version} currentRenewalDate={cr.renewalDate ? toLocalDate(cr.renewalDate) : null} />}
        </div>
        {cr.renewalDate ? (
          <span>
            {formatDate(toLocalDate(cr.renewalDate))} ({(() => {
              const n = daysBetween(today(), toLocalDate(cr.renewalDate));
              return n >= 0 ? `in ${n} day${n === 1 ? "" : "s"}` : `${-n} day${-n === 1 ? "" : "s"} ago`;
            })()})
          </span>
        ) : (
          <span className="text-text-secondary">No renewal date recorded</span>
        )}
      </FieldRow>
      <FieldRow label="Handoff summary">
        <div className="mb-1"><OwnedBy label={ownedByLabel([Team.SALES])} /></div>
        {hasHandoff ? (
          <div className="flex flex-col gap-1">
            {cr.slaAvailabilityPct !== null && <span>Availability SLA: {Number(cr.slaAvailabilityPct)}%</span>}
            {cr.slaMaxResponseMs !== null && <span>Max response time: {cr.slaMaxResponseMs} ms</span>}
            {cr.slaOther && <span>Other SLA commitments: {cr.slaOther}</span>}
            {cr.specialTerms && <span>Special terms: {cr.specialTerms}</span>}
            {cr.entitiesNotInPortal && <span>Entities not yet in the portal: {cr.entitiesNotInPortal}</span>}
            {cr.notesForOnboarding && <span>Notes for onboarding: {cr.notesForOnboarding}</span>}
          </div>
        ) : (
          <span className="text-text-secondary">No handoff summary recorded</span>
        )}
      </FieldRow>
      <FieldRow label="Commercial terms">
        <div className="mb-1"><OwnedBy label={ownedByLabel([Team.SALES, Team.FINANCE])} /></div>
        {hasCommercial ? (
          <div className="flex flex-col gap-1">
            <span>{formatPrice(cr.currency!, cr.pricePerVerification)} per verification</span>
            {cr.volumeTiers.length > 0 && (
              <div className="flex flex-col gap-0.5">
                {cr.volumeTiers.map((t) => (
                  <span key={t.id} className="text-meta text-text-secondary">
                    {formatVolume(t.fromVolume)}{t.toVolume !== null ? `–${formatVolume(t.toVolume)}` : "+"} at {formatPrice(cr.currency!, t.pricePerVerification)}
                  </span>
                ))}
              </div>
            )}
            <span>{cr.monthlyMinimum !== null ? `Monthly minimum ${formatAmount(cr.currency!, cr.monthlyMinimum)}` : "No monthly minimum"}</span>
            <span>{cr.paymentTermDays !== null ? `Payment term ${cr.paymentTermDays} days` : "No payment term recorded"}</span>
          </div>
        ) : (
          <span className="text-text-secondary">No commercial terms recorded</span>
        )}
      </FieldRow>
    </Card>
  );
}

function PartnerRoleCard({ data }: { data: DetailsData }) {
  const pr = data.partnerRole;
  if (!pr) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Partner role</CardTitle>
        <span className="flex-1" />
        <OwnedBy label={ownedByLabel([Team.OPS])} />
      </CardHeader>
      <FieldRow label="Connection method">
        {pr.connectionMethod ? (
          <span>
            {CONNECTION_METHOD_LABELS[pr.connectionMethod]}
            {pr.connectionMethod === "VIA_ROUTING_PROVIDER" && pr.providerName && ` (${pr.providerName})`}
          </span>
        ) : (
          <span className="text-text-secondary">No connection method recorded</span>
        )}
      </FieldRow>
      <FieldRow label="Partner agreement">
        {pr.partnerAgreement ? (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{pr.partnerAgreement.contractId}</span>
            <span>{pr.partnerAgreement.title}</span>
            <span className="text-meta text-text-secondary">Signed {formatDate(toLocalDate(pr.partnerAgreement.signingDate))}</span>
            <a href={pr.partnerAgreement.documentUrl} target="_blank" rel="noreferrer" className="text-meta text-link-text hover:underline">
              View document
            </a>
          </div>
        ) : (
          <span className="text-text-secondary">No partner agreement reference</span>
        )}
      </FieldRow>
      <div className="mt-1">
        <Link href={`/entities/${data.entity.id}/partner`} className="text-meta text-link-text hover:underline">
          View coverage on the Partner tab
        </Link>
      </div>
    </Card>
  );
}

function LifecycleStateCard({ data }: { data: DetailsData }) {
  const { entity } = data;
  const isPartnerOnly = (entity.partnerRole?.active ?? false) && !(entity.customerRole?.active ?? false);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lifecycle state</CardTitle>
        <span className="flex-1" />
        <OwnedBy label={ownedByLabel([Team.OPS])} />
      </CardHeader>
      <div className="flex flex-col gap-1">
        <Badge variant={lifecycleVariant(entity.lifecycleState)} className="w-fit">{lifecycleLabel(entity.lifecycleState)}</Badge>
        {entity.lifecycleState === "INACTIVE" ? (
          entity.inactiveReason && <span className="text-meta text-text-secondary">Reason: {entity.inactiveReason}</span>
        ) : (
          <span className="text-meta text-text-secondary">{isPartnerOnly ? "Computed from partner coverage" : "Computed from the product stages"}</span>
        )}
      </div>
    </Card>
  );
}

// Brief 4.9.2 "Why this owner", M18 AC3, AC4, 5780, edge case 8. Read-only card; editing is phase 2.
function IssueTeamCard({ data }: { data: DetailsData }) {
  const { entity, issueTeam } = data;
  if (!issueTeam) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Issue team</CardTitle>
        </CardHeader>
        <span className="text-text-secondary">Issue team not set</span>
      </Card>
    );
  }

  const named = (team: "OPS" | "NETWORK" | "FINANCE" | "COMPLIANCE") =>
    issueTeam.members[team] ? issueTeam.members[team]!.name : <span className="text-text-secondary">Not set</span>;

  const onCallLine = (["OPS", "NETWORK", "COMPLIANCE"] as const)
    .map((team) => `${TEAM_LABELS[team]} ${issueTeam.onCall[team]?.name ?? "not set"}`)
    .join(" · ");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Issue team</CardTitle>
      </CardHeader>
      <span className="text-meta text-text-secondary">Set in the seed. Editing comes in a later release.</span>
      <div>
        <FieldRow label="Customer owner">
          {entity.owner ? `${entity.owner.name}, ${TEAM_LABELS[entity.owner.team]}` : <span className="text-text-secondary">No owner</span>}
        </FieldRow>
        <FieldRow label="Sales">
          {issueTeam.members.SALES ? (
            <>
              {issueTeam.members.SALES.name}
              {issueTeam.salesIsFallback && " (Sales Director, fallback)"}
            </>
          ) : (
            <span className="text-text-secondary">Not set</span>
          )}
        </FieldRow>
        <FieldRow label="Ops">{named("OPS")}</FieldRow>
        <FieldRow label="Network">{named("NETWORK")}</FieldRow>
        <FieldRow label="Finance">{named("FINANCE")}</FieldRow>
        <FieldRow label="Compliance">{named("COMPLIANCE")}</FieldRow>
      </div>
      <div className="flex flex-col gap-1.5 border-t border-border pt-3">
        <span className="text-meta text-text-secondary">On-call this week</span>
        <span>{onCallLine}</span>
        <span className="text-meta text-text-secondary">Sales and Finance: no on-call</span>
      </div>
      <span className="text-meta text-text-secondary">
        Issues go to the named person of the owner team inside business hours; a Sev-1 outside business hours goes to the on-call person.
      </span>
    </Card>
  );
}

export default async function DetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, user] = await Promise.all([loadDetailsData(id), getCurrentUser()]);
  if (!data) notFound();

  const canEditGroup = can(user, "entity.group.edit").ok;
  const perms: Perms = {
    canEditRoles: can(user, "entity.roles.edit").ok,
    canEditGroup,
    canAttachContract: can(user, "entity.contract.attach").ok,
    canEditRenewal: can(user, "customer.renewalDate.edit").ok,
    groups: canEditGroup && !data.entity.group ? await loadGroupOptions() : [],
    zone: effectiveTimeZone(user),
  };

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-page">Details</h2>
        <p className="text-meta text-text-secondary">Each card is edited by its owning team</p>
      </div>
      <EntityCoreCard data={data} perms={perms} />
      <RolesCard data={data} perms={perms} />
      <CustomerRoleCard data={data} perms={perms} />
      <PartnerRoleCard data={data} />
      <LifecycleStateCard data={data} />
      <IssueTeamCard data={data} />
    </div>
  );
}
