import Link from "next/link";
import { AlertTriangle, Clock, Copy, Lock, Mail, Phone } from "lucide-react";
import type { Team } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { DeleteRecordAction } from "@/components/entity/DeleteRecordAction";
import { AcknowledgeAssignmentBanner } from "@/components/entity/owner/AcknowledgeAssignmentBanner";
import { ReassignOwnerDialog } from "@/components/entity/owner/ReassignOwnerDialog";
import { RefreshGleifButton } from "@/components/entity/compliance/RefreshGleifButton";
import { ReportIssueDrawer } from "@/components/issues/ReportIssueDrawer";
import { SendOpsToCsButton } from "@/components/handoff/SendOpsToCsButton";
import { countryName } from "@/lib/countries";
import { formatDate } from "@/lib/dates";
import { formatDateTime } from "@/lib/time-zones";
import { ENTITY_TYPE_LABELS, TEAM_LABELS } from "@/lib/labels";
import { leiStatusLabel, leiStatusVariant, lifecycleLabel, lifecycleVariant } from "@/lib/ui/status";
import type { HeaderData } from "@/server/queries/header";

interface OwnerCandidate {
  id: string;
  name: string;
  team: Team;
}

interface MyAssignment {
  id: string;
  assignedByName: string;
  reason: string;
  assignedAt: string;
}

function Separator() {
  return <span className="h-4 w-px bg-border" aria-hidden="true" />;
}

function IncidentBlock({ incident, entityId }: { incident: HeaderData["incident"]; entityId: string }) {
  if (!incident) {
    return (
      <section
        aria-label="Incident contact"
        className="flex items-center gap-2.5 rounded-md border-2 border-danger bg-white p-4 text-danger"
      >
        <AlertTriangle className="size-5" aria-hidden="true" />
        <span className="text-body font-medium">No active incident contact</span>
      </section>
    );
  }

  return (
    <section aria-label="Incident contact" className="rounded-md bg-tint-strong p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="text-[12px] font-medium uppercase tracking-wider text-text-secondary">Incident contact</span>
        {incident.isPrimary && <Badge variant="brand">Primary</Badge>}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-8">
        <div className="flex flex-col gap-0.5">
          <span className="text-subsection text-text">{incident.name}</span>
          {incident.jobTitle && <span className="text-meta">{incident.jobTitle}</span>}
          {incident.lastVerifiedAt && (
            <span className="mt-1.5 text-meta">
              Verified {formatDate(incident.lastVerifiedAt)} by {incident.lastVerifiedByName}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          {incident.phone && (
            <div className="flex items-center gap-1.5">
              <Phone className="size-5 text-primary" aria-hidden="true" />
              <a href={`tel:${incident.phone}`} className="font-mono text-[18px] font-medium text-link-text">
                {incident.phone}
              </a>
              <IconButton aria-label="Copy phone number">
                <Copy className="size-4" aria-hidden="true" />
              </IconButton>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Mail className="size-4 text-text-secondary" aria-hidden="true" />
            <a href={`mailto:${incident.email}`} className="text-link-text hover:underline">
              {incident.email}
            </a>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {incident.timeZone && incident.availability && (
            <div className="flex items-center gap-1.5">
              <Clock className="size-4 text-text-secondary" aria-hidden="true" />
              <span>
                {incident.timeZone} · Local time {incident.availability.localTime}
              </span>
            </div>
          )}
          {incident.availability && (
            <div className="flex items-center gap-2">
              {incident.available24x7 && <Badge variant="neutral-outline">24/7</Badge>}
              <Badge variant={incident.availability.isAvailableNow ? "success" : "due"}>
                {incident.availability.isAvailableNow ? "Available now" : "Outside availability"}
              </Badge>
            </div>
          )}
        </div>
      </div>
      <div className="mt-2.5">
        <Link href={`/entities/${entityId}/contacts?context=partner&role=incident,escalation`} className="text-meta text-link-text hover:underline">
          All incident and escalation contacts
        </Link>
      </div>
    </section>
  );
}

export function EntityHeader({
  data,
  isAdmin,
  canReassignOwner = false,
  canRetryGleif = false,
  canSendOpsToCs = false,
  ownerCandidates = [],
  myAssignment = null,
  viewerZone,
}: {
  data: HeaderData;
  isAdmin: boolean;
  canReassignOwner?: boolean;
  canRetryGleif?: boolean;
  canSendOpsToCs?: boolean;
  ownerCandidates?: OwnerCandidate[];
  myAssignment?: MyAssignment | null;
  viewerZone: string;
}) {
  const { entity, incident, hasCoverageIssue, billingFlag, pendingHandoffs, openIssueCount, hasEligibleProductForOpsToCs } = data;
  const isInactive = entity.lifecycleState === "INACTIVE";

  return (
    <div className="border-b border-border bg-surface">
      {(pendingHandoffs.salesToOps || pendingHandoffs.opsToCs || myAssignment) && (
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-6 pt-4">
          {myAssignment && (
            <AcknowledgeAssignmentBanner
              assignmentId={myAssignment.id}
              assignedByName={myAssignment.assignedByName}
              reason={myAssignment.reason}
              assignedAt={myAssignment.assignedAt}
            />
          )}
          {pendingHandoffs.salesToOps && (
            <div className="flex items-center gap-3 rounded-md border border-border border-l-4 border-l-due bg-white p-3">
              <AlertTriangle className="size-5 text-due" aria-hidden="true" />
              <span className="flex-1 text-body">
                Handoff to {pendingHandoffs.salesToOps.recipient} pending since {formatDate(pendingHandoffs.salesToOps.sentAt)}
              </span>
              <Button variant="secondary" asChild>
                <Link href={`/handoffs/${pendingHandoffs.salesToOps.id}`}>Open handoff</Link>
              </Button>
            </div>
          )}
          {pendingHandoffs.opsToCs && (
            <div className="flex items-center gap-3 rounded-md border border-border border-l-4 border-l-due bg-white p-3">
              <AlertTriangle className="size-5 text-due" aria-hidden="true" />
              <span className="flex-1 text-body">
                Handoff to {pendingHandoffs.opsToCs.recipient} pending since {formatDate(pendingHandoffs.opsToCs.sentAt)}
              </span>
              <Button variant="secondary" asChild>
                <Link href={`/handoffs/${pendingHandoffs.opsToCs.id}`}>Open handoff</Link>
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-6 pt-5">
        <div className="flex items-center gap-3">
          <h1 className="text-page">{entity.legalName}</h1>
          {isInactive && <Badge variant="muted">Inactive</Badge>}
          <span className="flex-1" />
          {!entity.deletedAt && <ReportIssueDrawer mode="entity" entityId={entity.id} entityName={entity.legalName} viewerZone={viewerZone} />}
          {canSendOpsToCs && !entity.deletedAt && !pendingHandoffs.opsToCs && (
            <SendOpsToCsButton entityId={entity.id} hasEligibleProduct={hasEligibleProductForOpsToCs} hasOpenHandoff={!!pendingHandoffs.opsToCs} />
          )}
          {isAdmin && !entity.deletedAt && <DeleteRecordAction entityId={entity.id} legalName={entity.legalName} />}
        </div>

        {entity.partnerRole?.active && <IncidentBlock incident={incident} entityId={entity.id} />}

        <div className="flex flex-col gap-2 pb-5">
          <div className="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-meta text-text-secondary">LEI</span>
            {entity.lei ? (
              <>
                <span className="font-mono text-body font-medium">{entity.lei}</span>
                <IconButton aria-label="Copy LEI">
                  <Copy className="size-4" aria-hidden="true" />
                </IconButton>
                {entity.leiStatus && (
                  <Badge variant={leiStatusVariant(entity.leiStatus)} title={entity.gleifCheckedAt ? `GLEIF status, checked ${formatDateTime(entity.gleifCheckedAt, viewerZone)}` : undefined}>
                    {leiStatusLabel(entity.leiStatus)}
                  </Badge>
                )}
                {canRetryGleif && <RefreshGleifButton entityId={entity.id} variant="text" />}
              </>
            ) : (
              <span className="text-text-secondary">Not set</span>
            )}
            <Separator />
            <span>{entity.type ? ENTITY_TYPE_LABELS[entity.type] : "Not set"}</span>
            <Separator />
            <span>{entity.country ? `${entity.country}, ${countryName(entity.country)}` : "Not set"}</span>
            <Separator />
            {entity.group ? (
              <Link href={`/groups/${entity.group.id}`} className="text-link-text hover:underline">
                {entity.group.name}
              </Link>
            ) : entity.groupDecision === "STANDALONE" ? (
              <span>Standalone entity</span>
            ) : (
              <span className="text-due">Group not set</span>
            )}
          </div>

          <div className="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-2">
            {entity.customerRole?.active && <Badge variant="selected">Customer</Badge>}
            {entity.partnerRole?.active && (
              <Link
                href={`/entities/${entity.id}/partner`}
                className="no-underline"
                title={hasCoverageIssue ? "Partner coverage issue" : undefined}
              >
                <Badge variant="selected">
                  Network partner
                  {hasCoverageIssue && <span className="inline-block size-1.5 rounded-full bg-due" aria-hidden="true" />}
                </Badge>
              </Link>
            )}
            <Separator />
            {entity.owner ? (
              <>
                <span>
                  <span className="text-meta text-text-secondary">Owner:</span>{" "}
                  <span className="font-medium">
                    {entity.owner.name}, {TEAM_LABELS[entity.owner.team]}
                  </span>
                  {!entity.owner.active && <Badge variant="muted" className="ml-2">Inactive user</Badge>}
                </span>
                {entity.ownerSince && <span className="text-meta text-text-secondary">Owner since {formatDate(entity.ownerSince.toISOString().slice(0, 10))}</span>}
                {canReassignOwner ? (
                  <ReassignOwnerDialog
                    entityId={entity.id}
                    currentOwnerId={entity.owner.id}
                    currentOwnerName={`${entity.owner.name}, ${TEAM_LABELS[entity.owner.team]}`}
                    candidates={ownerCandidates}
                    pendingOpsToCsRecipient={pendingHandoffs.opsToCs?.recipient ?? null}
                  />
                ) : (
                  <span title="Owned by Customer Success">
                    <Lock className="size-3.5 text-text-secondary" aria-hidden="true" />
                  </span>
                )}
              </>
            ) : canReassignOwner ? (
              <ReassignOwnerDialog
                entityId={entity.id}
                currentOwnerId={null}
                currentOwnerName={null}
                candidates={ownerCandidates}
                pendingOpsToCsRecipient={pendingHandoffs.opsToCs?.recipient ?? null}
              />
            ) : (
              <Badge variant="due-outline">No owner</Badge>
            )}
            <Separator />
            <Badge variant={lifecycleVariant(entity.lifecycleState)}>{lifecycleLabel(entity.lifecycleState)}</Badge>
            {openIssueCount > 0 && (
              <Link href={`/entities/${entity.id}/issues`} className="no-underline">
                <Badge variant="danger">{openIssueCount} open issue{openIssueCount === 1 ? "" : "s"}</Badge>
              </Link>
            )}
            {billingFlag.incomplete && (
              <Link href={`/entities/${entity.id}/billing`} className="no-underline">
                <Badge variant="due">Incomplete for billing</Badge>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
