"use client";

import * as React from "react";
import Link from "next/link";
import type { IssueStatus } from "@prisma/client";

import { issueDisplayId } from "@/lib/labels";
import { useTickingNow } from "@/lib/use-ticking-now";
import { Button } from "@/components/ui/button";
import { ReportReviewActions } from "@/components/issues/ReportReviewActions";
import { ShareDraftDialog } from "@/components/issues/ShareDraftDialog";
import { AcknowledgeButton } from "@/components/issues/AcknowledgeButton";
import { ChangeStatusDialog } from "@/components/issues/ChangeStatusDialog";
import { RecordAssessmentDialog } from "@/components/issues/RecordAssessmentDialog";
import { RecordReportSentDialog } from "@/components/issues/RecordReportSentDialog";
import { TimeBlock } from "@/components/issues/TimeBlock";
import { useActionFocus } from "@/components/issues/ActionFocus";
import type { ReportDialogData } from "@/components/issues/ActionPlan";
import type { RoleAction } from "@/server/derived/role-actions";
import { WhyThis } from "@/components/onboarding/WhyThis";

/**
 * "Your next action": the viewer's most urgent open step, its time block and the ONE primary button for that step. With
 * nothing to do, it says so and names the next step of somebody else, with its time. The button only ever exists for the person
 * who owns the step.
 */
export function YourNextAction({
  mine,
  other,
  displayId,
  issueId,
  version,
  eventNeeded,
  status,
  serverNow,
  zone,
  reportDialog,
}: {
  /** The viewer's most urgent open step. */
  mine: RoleAction | null;
  /** With none: the next step of somebody else. */
  other: RoleAction | null;
  displayId: string;
  issueId: string;
  version: number;
  /** Times rule 7: Resolve asks for Event (Sev-1 with Event unknown). */
  eventNeeded?: { awareAt: Date; zone: string };
  status: IssueStatus;
  serverNow: Date;
  zone: string;
  reportDialog?: ReportDialogData;
}) {
  const now = useTickingNow(serverNow);
  const { scrollToMessage, rowVariant } = useActionFocus();
  const [resolveOpen, setResolveOpen] = React.useState(false);
  const shown = mine ?? other;

  let button: React.ReactNode = null;
  if (mine) {
    const key = mine.key;
    if (key === "acknowledge") button = <AcknowledgeButton issueId={issueId} version={version} />;
    else if (key === "acknowledge_on_parent" && mine.via) {
      button = (
        <Button asChild>
          <Link href={`/issues/${mine.via.id}`}>Acknowledge on {issueDisplayId(mine.via.number)}</Link>
        </Button>
      );
    } else if (key === "notify" || key === "close") {
      // The filled primary of a message step is the Message panel's own button; this one takes the person there.
      button = (
        <Button data-onboarding="go-to-message" variant={rowVariant} onClick={scrollToMessage}>
          Go to the message
        </Button>
      );
    } else if (key === "assess") button = <RecordAssessmentDialog issueId={issueId} triggerVariant="primary" />;
    else if (key === "investigate" && mine.via) {
      button = (
        <Button asChild>
          <Link href={`/issues/${mine.via.id}`}>Open {issueDisplayId(mine.via.number)}</Link>
        </Button>
      );
    } else if (key === "investigate") {
      button = <Button data-onboarding="resolve" onClick={() => setResolveOpen(true)}>Resolve</Button>;
    } else if (key === "review_report" && reportDialog) {
      button = <ReportReviewActions issueId={issueId} displayId={reportDialog.displayId} entityName={reportDialog.entityName} />;
    } else if (key === "prepare_report" && reportDialog) {
      button = <ShareDraftDialog issueId={issueId} version={version} displayId={reportDialog.displayId} entityName={reportDialog.entityName} />;
    } else if (key === "send_report" && reportDialog) {
      button = (
        <RecordReportSentDialog
          issueId={issueId}
          entityId={reportDialog.entityId}
          version={version}
          displayId={reportDialog.displayId}
          entityName={reportDialog.entityName}
          dueAt={mine.dueAt}
          resolvedAt={reportDialog.resolvedAt}
          contacts={reportDialog.contacts}
          defaultContactId={reportDialog.defaultContactId}
          draftLink={reportDialog.draftLink}
          draftSummary={reportDialog.draftSummary}
          viewerZone={zone}
          triggerVariant="secondary"
        />
      );
    }
  }

  const note = shown?.queuedUntil ? null : (shown?.afterNote ?? null);
  return (
    <section
      aria-label="Your next action"
      data-onboarding="next-action"
      className="grid grid-cols-1 items-center gap-x-6 gap-y-3 rounded-md border border-l-4 border-border border-l-primary bg-tint-strong px-5 py-[18px] min-[1101px]:grid-cols-[minmax(0,1fr)_220px_auto]"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-1">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-text-secondary">Your next action</h2>
          <WhyThis note="next-action" />
        </div>
        <p data-testid="next-action-title" className="text-[20px] font-semibold leading-7 text-primary">
          {mine ? mine.label : `Nothing for you to do on ${displayId}`}
        </p>
        <p className="text-meta text-text-secondary" data-testid="next-action-sub">
          {mine ? `Your role on ${displayId}: ${mine.role}` : other ? `Next step: ${other.role}, ${other.person.name}: ${other.label}` : "No open steps"}
        </p>
      </div>
      <div>{shown && <TimeBlock dueAt={shown.dueAt} now={now} zone={zone} note={note} dateOnly={shown.dateOnly} testId="next-action-time" />}</div>
      <div className="flex min-[1101px]:justify-end">{button}</div>
      {mine?.key === "investigate" && !mine.via && (
        <ChangeStatusDialog issueId={issueId} version={version} currentStatus={status} initialStatus="RESOLVED" eventNeeded={eventNeeded} controlled={{ open: resolveOpen, onOpenChange: setResolveOpen }} />
      )}
    </section>
  );
}
