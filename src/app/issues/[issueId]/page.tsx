import Link from "next/link";
import { notFound } from "next/navigation";

import { getCurrentUser } from "@/server/session";
import { loadIssuePageData, buildIssueMessage } from "@/server/queries/issue-page";
import { loadActiveUsers } from "@/server/queries/users";
import { formatInZone } from "@/lib/time-zones";
import { ISSUE_IMPACT_LABELS, ISSUE_TYPE_LABELS, SCHEME_LABELS, TEAM_LABELS, issueDisplayId } from "@/lib/labels";
import { IssueHeader } from "@/components/issues/IssueHeader";
import { IssueActionsBar } from "@/components/issues/IssueActionsBar";
import { IssueDescription } from "@/components/issues/IssueDescription";
import { AboutAndTimeline } from "@/components/issues/AboutAndTimeline";
import { CorrectTimesDialog } from "@/components/issues/CorrectTimesDialog";
import { YourNextAction } from "@/components/issues/YourNextAction";
import { ActionPlan } from "@/components/issues/ActionPlan";
import { ActionFocusProvider } from "@/components/issues/ActionFocus";
import { CommunicationSection } from "@/components/issues/CommunicationSection";
import { PeoplePanel } from "@/components/issues/PeoplePanel";
import { CompliancePanel } from "@/components/issues/CompliancePanel";
import { CustomerObligationsPanel } from "@/components/issues/CustomerObligationsPanel";
import { CommunicationLogCard } from "@/components/issues/CommunicationLogCard";
import { NotesSection } from "@/components/issues/NotesSection";
import { CopyForCustomerButton } from "@/components/issues/CopyForCustomerButton";
import { DegradedProposalBanner } from "@/components/issues/DegradedProposalBanner";
import { AffectedCustomersPanel } from "@/components/issues/AffectedCustomersPanel";
import { LinkedIssuesPanel } from "@/components/issues/LinkedIssuesPanel";
import { DualRoleBanner } from "@/components/issues/DualRoleBanner";

export default async function IssuePage({ params, searchParams }: { params: Promise<{ issueId: string }>; searchParams: Promise<{ reported?: string }> }) {
  const { issueId } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  const pageData = await loadIssuePageData(issueId, user);
  if (!pageData) notFound();

  const {
    issue,
    roles,
    communicator,
    clocks,
    roleActions,
    clocksCtx,
    serverNow,
    card,
    partnerCard,
    incidentContact,
    severityCaps,
    ownerTeamCandidates,
    isPartnerIssue,
    degradedProposal,
    affectedCustomers,
    linkedIssuesPanel,
    dualRoleBanner,
  } = pageData;
  const displayId = issueDisplayId(issue.number);
  const allUsers = await loadActiveUsers();

  const message = buildIssueMessage(pageData);

  const incidentContactInfo = incidentContact
    ? {
        name: incidentContact.fullName,
        jobTitle: incidentContact.jobTitle,
        phone: incidentContact.phone,
        email: incidentContact.email,
        // "Europe/London, 09:48 BST": the contact's own zone, read from the server demo clock.
        localTime: incidentContact.timeZone ? `${incidentContact.timeZone}, ${formatInZone(serverNow, incidentContact.timeZone, { timeOnly: true })}` : null,
      }
    : null;

  const resolution = issue.resolutions[0] ?? null;
  const copyForCustomerText = `${displayId} is with our ${TEAM_LABELS[issue.ownerTeam]} team (${issue.owner?.name ?? "unassigned"}). ${communicator?.name ?? "No communicator"} will keep you updated.`;

  // The message steps (Record notification, Confirm resolution) keep their one filled primary in the Message panel; "Your next action" has a secondary button that scrolls to it.
  const hasRowButton = roleActions.next.mine?.key === "notify" || roleActions.next.mine?.key === "close";

  // A linked issue's times come from its partner issue (CREATED, routingRule INHERITED_FROM_PARENT); any linked issue names it under "About this issue".
  // The company page opens for everyone, except a deleted record (the admin only): no access, no link.
  const canOpenEntity = !issue.entity.deletedAt || user.isAdmin;
  const linkedParent = issue.parentLinks[0]?.parent ?? null;
  const inheritedParent = issue.routingRule === "INHERITED_FROM_PARENT" ? linkedParent : null;
  const resolvedViaNumber = issue.parentLinks.find((l) => l.parent.id === resolution?.cascadedFromIssueId)?.parent.number ?? null;
  // Times rule 5: the Timeline's Correction row names the latest correction; the tooltip lists what each corrected field was originally.
  const lastCorrection = issue.timeCorrections.at(-1) ?? null;
  const originalValues: { field: string; value: string | null }[] = [];
  for (const c of issue.timeCorrections) if (!originalValues.some((o) => o.field === c.field)) originalValues.push({ field: c.field, value: c.oldValue });
  const FIELD_ORDER = ["EVENT_AT", "AWARE_AT", "AWARENESS_SOURCE"];
  originalValues.sort((a, b) => FIELD_ORDER.indexOf(a.field) - FIELD_ORDER.indexOf(b.field));
  // Times rule 7: Sev-1 with Event unknown (or a partner issue with a Sev-1 linked issue) needs Event to resolve.
  const eventNeeded =
    !issue.eventAt && (issue.severity === "SEV1" || issue.childLinks.some((l) => l.child.severity === "SEV1"))
      ? { awareAt: issue.awareAt, zone: clocksCtx.viewerZone }
      : undefined;
  const reportDialog = issue.rootCauseTask
    ? {
        entityId: issue.entityId,
        displayId,
        entityName: issue.entity.legalName,
        resolvedAt: issue.resolvedAt,
        contacts: pageData.contacts.map((c) => ({ id: c.id, fullName: c.fullName, role: c.role })),
        defaultContactId: incidentContact?.id ?? pageData.contacts[0]?.id ?? null,
        draftLink: issue.rootCauseTask.draftLink,
        draftSummary: issue.rootCauseTask.draftSummary,
      }
    : undefined;

  return (
    <ActionFocusProvider hasRowButton={hasRowButton}>
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-6 py-6">
      {sp.reported === "1" && (
        <div className="flex items-center gap-3 rounded-md border-l-4 border-l-success bg-tint p-3" role="status">
          <span className="flex-1 text-body">Issue {displayId} reported</span>
          <CopyForCustomerButton text={copyForCustomerText} partner={isPartnerIssue} />
        </div>
      )}

      <IssueHeader number={issue.number} type={issue.type} severity={issue.severity} status={issue.status} ownerName={issue.owner?.name ?? null} ownerTeam={issue.ownerTeam} />

      {roles.isOwner && (
        <IssueActionsBar
          issueId={issue.id}
          version={issue.version}
          eventNeeded={eventNeeded}
          status={issue.status}
          severity={issue.severity}
          type={issue.type}
          severityCaps={severityCaps}
          ownerId={issue.ownerId}
          ownerName={issue.owner?.name ?? null}
          ownerCandidates={ownerTeamCandidates}
          canReassign={issue.status !== "CLOSED" && issue.routingRule !== "INHERITED_FROM_PARENT"}
          contributorCandidates={allUsers}
          alreadyOnIds={[issue.ownerId, communicator?.id, ...issue.contributors.map((c) => c.userId)].filter((id): id is string => !!id)}
        />
      )}

      <IssueDescription issueId={issue.id} version={issue.version} description={issue.description} canEdit={roles.isReporter && issue.status === "NEW"} />

      <AboutAndTimeline
        entityRole={isPartnerIssue ? "Partner" : "Customer"}
        entityName={issue.entity.legalName}
        entityHref={canOpenEntity ? `/entities/${issue.entityId}/overview` : null}
        product={issue.scheme && issue.country ? `${SCHEME_LABELS[issue.scheme]} ${issue.country}` : null}
        impact={ISSUE_IMPACT_LABELS[issue.impact]}
        linkedParent={linkedParent ? { id: linkedParent.id, number: linkedParent.number, entityName: linkedParent.entity.legalName, entityHref: !linkedParent.entity.deletedAt || user.isAdmin ? `/entities/${linkedParent.entityId}/overview` : null } : null}
        correctLink={
          roles.isOwner && !inheritedParent ? (
            <CorrectTimesDialog
              issueId={issue.id}
              version={issue.version}
              issueLabel={`${displayId} · ${ISSUE_TYPE_LABELS[issue.type]} · ${issue.entity.legalName}`}
              zone={clocksCtx.viewerZone}
              openedAt={issue.createdAt}
              current={{ awareAt: issue.awareAt, eventAt: issue.eventAt, source: issue.awarenessSource }}
              awareLocked={issue.reporterKind === "MONITORING"}
            />
          ) : null
        }
        timeline={{
          eventAt: issue.eventAt,
          awareAt: issue.awareAt,
          source: issue.awarenessSource,
          severity: issue.severity,
          correction: lastCorrection
            ? { byName: lastCorrection.correctedBy.name, at: lastCorrection.correctedAt, originals: originalValues }
            : null,
          openedAt: issue.createdAt,
          reportedBy: issue.reporter ? `${issue.reporter.name} (${TEAM_LABELS[issue.reporter.team!]})` : "Monitoring (automatic)",
          reportedAtCustomerBy: issue.customerReporterName ?? issue.customerReporterContact?.fullName ?? null,
          acknowledged: issue.acknowledgedAt
            ? { byName: issue.acknowledgedBy?.name ?? null, at: issue.acknowledgedAt, via: null }
            : inheritedParent?.acknowledgedAt
              ? { byName: inheritedParent.acknowledgedBy?.name ?? null, at: inheritedParent.acknowledgedAt, via: inheritedParent.number }
              : null,
          resolved: issue.resolvedAt && resolution ? { byName: resolution.resolvedBy.name, at: issue.resolvedAt, via: resolvedViaNumber } : null,
          timesFrom: inheritedParent ? { id: inheritedParent.id, number: inheritedParent.number } : null,
        }}
        zone={clocksCtx.viewerZone}
        serverNow={serverNow}
      />

      <YourNextAction
        mine={roleActions.next.mine}
        other={roleActions.next.other}
        displayId={displayId}
        issueId={issue.id}
        version={issue.version}
        status={issue.status}
        eventNeeded={eventNeeded}
        serverNow={serverNow}
        zone={clocksCtx.viewerZone}
        reportDialog={reportDialog}
      />

      <ActionPlan
        plan={roleActions.plan}
        done={roleActions.done}
        viewerId={user.id}
        serverNow={serverNow}
        zone={clocksCtx.viewerZone}
        displayId={displayId}
        issueId={issue.id}
        entityName={issue.entity.legalName}
        canApprove={user.team === "COMPLIANCE"}
        notice={
          // M27 AC2: a Sev-1 customer issue is resolved while the customer's regulatory regime is not captured: no task, and where to fix it.
          !issue.rootCauseTask &&
          !isPartnerIssue &&
          issue.severity === "SEV1" &&
          (issue.status === "RESOLVED" || issue.status === "CLOSED") &&
          issue.entity.customerRole?.active &&
          (card?.regulatoryRegime ?? null) === null ? (
            <>
              No root cause report task: regulatory regime not captured.{" "}
              <Link href={`/entities/${issue.entityId}/compliance`} className="text-link-text hover:underline">
                Open the Compliance tab
              </Link>
            </>
          ) : undefined
        }
      />

      {dualRoleBanner && <DualRoleBanner parentId={dualRoleBanner.parentId} parentNumber={dualRoleBanner.parentNumber} lastPartnerCommunication={dualRoleBanner.lastPartnerCommunication} />}

      {isPartnerIssue && partnerCard?.incidentNoticeHours != null && (
        <p className="text-meta text-text-secondary">Partner agreement incident notification time: {partnerCard.incidentNoticeHours} h</p>
      )}

      {isPartnerIssue && degradedProposal && (
        <DegradedProposalBanner issueId={issue.id} displayId={displayId} description={issue.description} isNetwork={user.team === "NETWORK"} viewerZone={clocksCtx.viewerZone} proposal={degradedProposal} />
      )}

      {isPartnerIssue && affectedCustomers && (
        <AffectedCustomersPanel
          issueId={issue.id}
          version={issue.version}
          isOwner={roles.isOwner}
          viewerZone={clocksCtx.viewerZone}
          schemeCountryLabel={issue.scheme && issue.country ? `${SCHEME_LABELS[issue.scheme]} / ${issue.country}` : "this scheme and country"}
          affected={affectedCustomers.affected.map((a) => ({
            entityId: a.entityId,
            entityName: a.entityName,
            productLines: a.productLines,
            ownerName: a.ownerName,
            incidentNoticeHours: a.incidentNoticeHours,
            notifyBy: a.notifyBy ? a.notifyBy.toISOString() : null,
            notifyByDefault: a.notifyByDefault,
            linkedIssue: a.linkedIssue,
            attachCandidates: a.attachCandidates,
            defaultAction: a.defaultAction,
            defaultAttachId: a.defaultAttachId,
          }))}
          beforeGoLive={affectedCustomers.beforeGoLive}
        />
      )}

      {isPartnerIssue && linkedIssuesPanel && <LinkedIssuesPanel isOwner={roles.isOwner} rows={linkedIssuesPanel.rows} notifiedCount={linkedIssuesPanel.notifiedCount} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <CommunicationSection
            issueId={issue.id}
            version={issue.version}
            isCommunicator={roles.isCommunicator}
            isOwner={roles.isOwner}
            isPartnerIssue={isPartnerIssue}
            resolutionConfirmed={issue.communications.some((c) => c.type === "CLOSURE_CONFIRMED")}
            stage={message.stage}
            reportDialog={reportDialog ? { ...reportDialog, dueAt: issue.rootCauseTask?.dueAt ?? null } : undefined}
            incidentContact={incidentContactInfo}
            subject={message.subject}
            body={message.body}
            to={message.to}
            entityId={issue.entityId}
            entityName={issue.entity.legalName}
            contactsHref={canOpenEntity ? `/entities/${issue.entityId}/contacts` : null}
            status={issue.status}
            notificationDone={!!issue.notifiedAt}
            contacts={pageData.contacts}
            viewerZone={clocksCtx.viewerZone}
            resolvedAt={issue.resolvedAt}
          />

          <CommunicationLogCard
            partner={isPartnerIssue}
            log={issue.communications.map((c) => ({ id: c.id, type: c.type, occurredAt: c.occurredAt, channel: c.channel, personName: c.personName, message: c.message, recordedByName: c.recordedByName }))}
            viewerZone={clocksCtx.viewerZone}
          />

          <NotesSection
            partner={isPartnerIssue}
            issueId={issue.id}
            notes={issue.notes.map((n) => ({ id: n.id, kind: n.kind, body: n.body, authorName: n.authorName, authorTeam: n.authorTeam, createdAt: n.createdAt }))}
            viewerZone={clocksCtx.viewerZone}
          />
        </div>

        <div className="flex flex-col gap-4">
          <PeoplePanel
            issueId={issue.id}
            version={issue.version}
            isOwner={roles.isOwner}
            ownerName={issue.owner?.name ?? null}
            ownerTeam={issue.ownerTeam}
            communicatorLabel={communicator ? `${communicator.name} (${TEAM_LABELS[communicator.team]})` : "No communicator: set an owner on the entity"}
            reporterName={issue.reporter?.name ?? "Monitoring (automatic)"}
            reporterTeam={issue.reporter?.team ?? null}
            routingReason={issue.routingReason}
            contributors={issue.contributors.map((c) => ({ userId: c.userId, name: c.user.name, team: c.user.team, forReport: c.addedForReport }))}
          />

          <CompliancePanel
            issueId={issue.id}
            entityId={issue.entityId}
            severity={issue.severity}
            reasons={issue.complianceReasons}
            regime={card?.regulatoryRegime}
            hasCard={!!card}
            isPartnerIssue={isPartnerIssue}
            clockText={clocks.compliance?.text ?? null}
            assessorName={issue.complianceAssessor?.name ?? null}
            isCompliance={user.team === "COMPLIANCE"}
            issueClosed={issue.status === "CLOSED"}
            assessments={issue.assessments.map((a) => ({ id: a.id, outcome: a.outcome, rationale: a.rationale, assessedByName: a.assessedBy.name, assessedAt: a.assessedAt }))}
            viewerZone={clocksCtx.viewerZone}
          />

          {issue.entity.customerRole?.active && <CustomerObligationsPanel card={card} />}

          {resolution && (
            <div className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h3 className="text-subsection">
                Resolution
                {resolution.supersededAt && <span className="ml-2 text-meta text-due">Superseded</span>}
              </h3>
              <div className="flex flex-col gap-1">
                <span className="text-meta text-text-secondary">Root cause</span>
                <p className="whitespace-pre-line text-body">{resolution.rootCause}</p>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-meta text-text-secondary">Solution</span>
                <p className="whitespace-pre-line text-body">{resolution.solution}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </ActionFocusProvider>
  );
}
