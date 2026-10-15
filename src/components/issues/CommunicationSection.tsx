"use client";

import * as React from "react";
import { AlertTriangle, Copy, ExternalLink, Phone } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RecordCommunicationDialog } from "@/components/issues/RecordCommunicationDialog";
import { CloseDialog } from "@/components/issues/CloseDialog";
import { RecordReportSentDialog } from "@/components/issues/RecordReportSentDialog";
import type { ReportDialogData } from "@/components/issues/ActionPlan";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MESSAGE_STAGE_LABELS, UPDATE_HINT, UPDATE_PLACEHOLDER_LINE, type MessageStage } from "@/server/issues/stage-message";
import { MESSAGE_PANEL_ID, useActionFocus } from "@/components/issues/ActionFocus";

function ContactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[116px_minmax(0,1fr)] items-center gap-3 border-b border-border py-2 text-body last:border-b-0">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="min-w-0 text-text">{children}</dd>
    </div>
  );
}

export interface IncidentContactInfo {
  name: string;
  jobTitle: string | null;
  phone: string | null;
  email: string;
  /** "Europe/London, 09:48 BST" */
  localTime: string | null;
}
interface PickerContact {
  id: string;
  fullName: string;
  role: string;
}

export function CommunicationSection({
  issueId,
  version,
  isCommunicator,
  isOwner,
  isPartnerIssue,
  resolutionConfirmed,
  stage,
  reportDialog,
  incidentContact,
  subject: initialSubject,
  body: initialBody,
  to,
  entityId,
  entityName,
  contactsHref,
  status,
  notificationDone,
  contacts,
  viewerZone,
  resolvedAt,
}: {
  issueId: string;
  version: number;
  isCommunicator: boolean;
  /** The owner sends the root cause report (the REPORT template); the communicator sends the other three. */
  isOwner: boolean;
  /** The button reads like the Action plan step: "Confirm resolution with the partner" on a partner issue, else "Confirm resolution with the customer". */
  isPartnerIssue: boolean;
  /** The resolution is already confirmed (the issue can stay Resolved while the report is open): no button. */
  resolutionConfirmed: boolean;
  /** The template the panel shows, picked from the issue's state on the server. */
  stage: MessageStage;
  /** The root cause report task's data, for "Record report sent" on the REPORT template. */
  reportDialog?: ReportDialogData & { dueAt: Date | null };
  incidentContact: IncidentContactInfo | null;
  subject: string;
  body: string;
  to: string | null;
  entityId: string;
  /** "Incident contact at <entity>": the customer, or the partner on a partner issue. */
  entityName: string;
  /** The entity's Contacts tab (the heading links to it); null without access. */
  contactsHref: string | null;
  status: string;
  notificationDone: boolean;
  contacts: PickerContact[];
  viewerZone: string;
  resolvedAt: Date | null;
}) {
  // M22 AC5, edge case 9: "After the click the page shows 'Sent it? Record
  // the notification' next to 'Record notification'" -- set once "Open in
  // Gmail" actually opened a window (not on a blocked popup, which shows
  // its own error instead).
  const [sentHint, setSentHint] = React.useState(false);
  const { panelVariant } = useActionFocus();
  // Subject and body are editable on the page; a change of stage (after Resolve, say) discards the edits and shows the new template.
  const [text, setText] = React.useState({ subject: initialSubject, body: initialBody });
  const [stageNotice, setStageNotice] = React.useState(false);
  const shownStage = React.useRef(stage);
  React.useEffect(() => {
    if (shownStage.current === stage) return;
    shownStage.current = stage;
    setText({ subject: initialSubject, body: initialBody });
    setStageNotice(true);
    setSentHint(false);
  }, [stage, initialSubject, initialBody]);
  const subject = text.subject;
  const body = text.body;
  const canAct = stage === "REPORT" ? isOwner : isCommunicator;
  const placeholderLeft = stage === "UPDATE" && body.includes(UPDATE_PLACEHOLDER_LINE);
  // Every message for this issue is recorded and no next template applies: the panel keeps no stale template.
  const nothingLeft = stage === "RESOLUTION" && resolutionConfirmed;
  const who = isPartnerIssue ? "partner" : "customer";

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      toast.success("Message copied");
    } catch {
      toast.error("Couldn't copy the message");
    }
  }

  function openInGmail() {
    const q = encodeURIComponent;
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${q(to ?? "")}&su=${q(subject)}&body=${q(body)}`;
    const w = window.open(url, "_blank");
    if (w) {
      w.opener = null;
      setSentHint(true);
    } else {
      toast.error("Your browser blocked the Gmail window. Use Copy message");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Incident contact" className="rounded-md bg-tint-strong p-4">
        {!incidentContact ? (
          <div className="flex items-center gap-2 text-danger">
            <AlertTriangle className="size-5" aria-hidden="true" />
            <span className="font-medium">No active incident contact</span>
          </div>
        ) : (
          <>
            <h3 className="border-b border-border pb-2 text-[12px] font-medium uppercase tracking-[0.06em] text-text-secondary">
              {contactsHref ? (
                <a href={contactsHref} className="text-link-text hover:underline">
                  Incident contact at {entityName}
                </a>
              ) : (
                <>Incident contact at {entityName}</>
              )}
            </h3>
            <dl>
              <ContactRow label="Name">{incidentContact.name}</ContactRow>
              {incidentContact.jobTitle && <ContactRow label="Role">{incidentContact.jobTitle}</ContactRow>}
              {incidentContact.phone && (
                <ContactRow label="Phone">
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    <a href={`tel:${incidentContact.phone}`} className="break-all font-mono text-[16px] font-semibold text-link-text">
                      {incidentContact.phone}
                    </a>
                  </span>
                </ContactRow>
              )}
              <ContactRow label="Email">
                <a href={`mailto:${incidentContact.email}`} className="break-all text-link-text hover:underline">
                  {incidentContact.email}
                </a>
              </ContactRow>
              {incidentContact.localTime && <ContactRow label="Local time">{incidentContact.localTime}</ContactRow>}
            </dl>
            <div className="mt-3">
              <a href={`/entities/${entityId}/contacts?context=customer&role=incident,escalation`} className="text-body text-link-text hover:underline">
                All incident and escalation contacts
              </a>
            </div>
          </>
        )}
      </section>

      <section id={MESSAGE_PANEL_ID} data-onboarding="message-panel" aria-label={`Message to the ${who}`} className="flex flex-col gap-3 rounded-md border border-border p-5">
        <div className="flex flex-col gap-1">
          <h3 className="text-subsection">Message to the {who}{nothingLeft ? "" : ` · ${MESSAGE_STAGE_LABELS[stage]}`}</h3>
          {!nothingLeft && <p className="text-meta text-text-secondary">Your edits are kept on this page until you record the message.</p>}
        </div>
        {nothingLeft ? (
          <p data-testid="all-messages-sent" className="text-body text-text-secondary">
            All messages sent. See the Communication log.
          </p>
        ) : (
          <>
            {stageNotice && (
              <p role="status" data-testid="stage-notice" className="text-meta text-text-secondary">
                Message updated for the new stage
              </p>
            )}
            <div className="flex flex-col gap-1">
              <label htmlFor="message-subject" className="text-meta text-text-secondary">Subject</label>
              <Input id="message-subject" value={subject} onChange={(e) => setText((t) => ({ ...t, subject: e.target.value }))} readOnly={!canAct} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="message-body" className="text-meta text-text-secondary">Body</label>
              <HighlightedTextarea
                id="message-body"
                value={body}
                onChange={(v) => setText((t) => ({ ...t, body: v }))}
                readOnly={!canAct}
                rows={Math.min(30, Math.max(12, body.split("\n").length + 6))}
                highlight={placeholderLeft ? UPDATE_PLACEHOLDER_LINE : null}
              />
            </div>
            <div className="flex items-center gap-2 text-meta">
              <span>To:</span>
              {to ? <a href={`mailto:${to}`} className="text-link-text hover:underline">{to}</a> : <span className="text-text-secondary">No recipient</span>}
            </div>
            {canAct && (
              <div className="flex flex-wrap items-center gap-2">
                <Button data-onboarding="copy-message" variant="secondary" onClick={() => void copyMessage()}>
                  <Copy className="size-4" aria-hidden="true" /> Copy message
                </Button>
                <Button variant="secondary" onClick={openInGmail}>
                  Open in Gmail <ExternalLink className="size-4" aria-hidden="true" />
                </Button>
                {!to && <span className="text-meta text-text-secondary">Add the recipient in Gmail</span>}
                <span className="flex-1" />
                {stage === "REPORT" && reportDialog ? (
                  <RecordReportSentDialog
                    issueId={issueId}
                    entityId={reportDialog.entityId}
                    version={version}
                    displayId={reportDialog.displayId}
                    entityName={reportDialog.entityName}
                    dueAt={reportDialog.dueAt}
                    resolvedAt={reportDialog.resolvedAt}
                    contacts={reportDialog.contacts}
                    defaultContactId={reportDialog.defaultContactId}
                    viewerZone={viewerZone}
                    draftLink={reportDialog.draftLink}
                    draftSummary={reportDialog.draftSummary}
                    triggerVariant={panelVariant}
                  />
                ) : stage === "RESOLUTION" ? (
                  status === "RESOLVED" && !resolutionConfirmed && <CloseDialog issueId={issueId} version={version} contacts={contacts} viewerZone={viewerZone} resolvedAt={resolvedAt} triggerVariant={panelVariant} triggerLabel={`Confirm resolution with the ${who}`} partner={isPartnerIssue} />
                ) : (
                  <>
                    {sentHint && <span className="text-meta text-text-secondary">Sent it? Record the {stage === "UPDATE" ? "update" : "notification"}</span>}
                    <RecordCommunicationDialog
                      issueId={issueId}
                      version={version}
                      notificationDone={notificationDone}
                      contacts={contacts}
                      prefilledMessage={body}
                      viewerZone={viewerZone}
                      triggerVariant={panelVariant}
                      triggerLabel={stage === "UPDATE" ? "Record update" : "Record notification"}
                    />
                  </>
                )}
              </div>
            )}
            {canAct && placeholderLeft && (
              <p data-testid="update-hint" className="flex items-center gap-1.5 text-meta font-medium text-due">
                <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                {UPDATE_HINT}
              </p>
            )}
          </>
        )}
      </section>

    </div>
  );
}

/**
 * A textarea that can mark one line of its text (the update's "[one line to complete before sending]"): a backdrop with the same text,
 * metrics and padding sits behind the transparent textarea and paints the marked line.
 */
function HighlightedTextarea({
  id,
  value,
  onChange,
  readOnly,
  rows,
  highlight,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  rows: number;
  highlight: string | null;
}) {
  const backdrop = React.useRef<HTMLDivElement>(null);
  const at = highlight ? value.indexOf(highlight) : -1;
  const shared = "whitespace-pre-wrap break-words px-4 py-3 font-sans text-body leading-5";
  return (
    <div className="relative rounded-md border border-border bg-white focus-within:border-primary">
      <div ref={backdrop} aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden text-transparent", shared)}>
        {at >= 0 && highlight ? (
          <>
            {value.slice(0, at)}
            <mark data-testid="update-placeholder-mark" className="rounded-sm bg-highlight/35 text-transparent">{highlight}</mark>
            {value.slice(at + highlight.length)}
          </>
        ) : (
          value
        )}
      </div>
      <Textarea
        id={id}
        data-onboarding="message-body"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          if (backdrop.current) backdrop.current.scrollTop = e.currentTarget.scrollTop;
        }}
        readOnly={readOnly}
        rows={rows}
        className={cn("relative block w-full resize-y rounded-md border-0 bg-transparent focus-visible:outline-none", shared)}
      />
    </div>
  );
}
