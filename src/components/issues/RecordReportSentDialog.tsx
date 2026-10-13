"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CommunicationChannel } from "@prisma/client";

import { dialogNow, openingTime } from "@/lib/dialog-time";
import { apiRequest } from "@/lib/api-client";
import { now } from "@/lib/dates";
import { COMMUNICATION_CHANNEL_LABELS } from "@/lib/labels";
import { tzAbbreviation, zonedDateTimeToUtc } from "@/lib/time-zones";
import { byDateText, dayTimeText } from "@/lib/time-block";
import { REPORT_LINK_HOST } from "@/lib/validation/report-link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";

const CHANNELS = Object.values(CommunicationChannel);
const MIN_SUMMARY = 10;
const MAX_SUMMARY = 2000;
const MAX_LINK = 2048;

interface Contact {
  id: string;
  fullName: string;
  role: string;
}

function linkError(value: string): string | null {
  if (value.trim() === "") return null;
  if (value.length > MAX_LINK) return "Link must be 2,048 characters or fewer";
  try {
    const u = new URL(value.trim());
    if (u.protocol === "https:" && u.hostname === REPORT_LINK_HOST) return null;
  } catch {
    // falls through to the message below
  }
  return `Enter a link starting with https://${REPORT_LINK_HOST}/`;
}

/**
 * "Record report sent". Owner only: the row button of "Who does what" opens it;
 * the server answers 403 to anyone else.
 */
export function RecordReportSentDialog({
  issueId,
  entityId,
  version,
  displayId,
  entityName,
  dueAt,
  resolvedAt,
  contacts,
  defaultContactId,
  viewerZone,
  draftLink,
  draftSummary,
  triggerVariant = "primary",
}: {
  issueId: string;
  entityId: string;
  version: number;
  displayId: string;
  entityName: string;
  dueAt: Date | null;
  resolvedAt: Date | null;
  contacts: Contact[];
  defaultContactId: string | null;
  viewerZone: string;
  /** The approved draft: Sent to, Channel, and Sent on are confirmed by the owner; the link and summary start from the draft. */
  draftLink: string | null;
  draftSummary: string | null;
  triggerVariant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState(() => openingTime(resolvedAt, viewerZone).date);
  const [time, setTime] = React.useState(() => openingTime(resolvedAt, viewerZone).time);
  const [contactId, setContactId] = React.useState(defaultContactId ?? "");
  const [channel, setChannel] = React.useState<CommunicationChannel | "">("");
  const [reportUrl, setReportUrl] = React.useState(draftLink ?? "");
  const [summary, setSummary] = React.useState(draftSummary ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function reset() {
    const t = openingTime(resolvedAt, viewerZone); // read when the dialog opens, never a value kept from page load
    setDate(t.date);
    setTime(t.time);
    setContactId(defaultContactId ?? "");
    setChannel("");
    setReportUrl(draftLink ?? "");
    setSummary(draftSummary ?? "");
    setError(null);
  }

  const sentAt = zonedDateTimeToUtc(date, time, viewerZone);
  const inFuture = sentAt > dialogNow(resolvedAt);
  const beforeResolution = resolvedAt !== null && sentAt < new Date(Math.floor(resolvedAt.getTime() / 60_000) * 60_000); // the form takes minutes
  const urlError = linkError(reportUrl);
  const noContacts = contacts.length === 0;
  const summaryShort = summary.length > 0 && summary.trim().length < MIN_SUMMARY;
  const valid = !noContacts && contactId !== "" && channel !== "" && summary.trim().length >= MIN_SUMMARY && summary.length <= MAX_SUMMARY && !urlError && !inFuture && !beforeResolution;
  /** Why "Record report sent" is disabled, said next to the button: the first thing still missing. */
  const blockedReason: string | null = valid
    ? null
    : noContacts
      ? "No active customer contact to send it to"
      : contactId === ""
        ? "Choose who it was sent to"
        : channel === ""
          ? "Choose the channel"
          : summary.trim().length < MIN_SUMMARY
            ? `Write a summary of at least ${MIN_SUMMARY} characters`
            : summary.length > MAX_SUMMARY
              ? "The summary is too long"
              : urlError
                ? "Check the report link"
                : inFuture
                  ? "The time can't be in the future"
                  : "The time can't be before the resolution";

  async function save() {
    setPending(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/issues/${issueId}/root-cause-report`, "POST", {
        sentAt: sentAt.toISOString(),
        contactId,
        channel,
        reportUrl: reportUrl.trim() || undefined,
        summary,
        version,
      });
      if (!res.ok) {
        if (res.kind === "validation") setError(Object.values(res.fieldErrors)[0]?.[0] ?? "Report not recorded. Try again.");
        else if (res.kind === "issue_forbidden") setError(res.message);
        else setError("Report not recorded. Try again.");
        return;
      }
      setOpen(false);
      toast.success("Report recorded");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <Button variant={triggerVariant} onClick={() => setOpen(true)}>Record report sent</Button>
      <DialogContent>
        <DialogHeader>Record report sent</DialogHeader>
        <DialogBody>
          <p className="text-meta text-text-secondary">
            Root cause report for {displayId}, {entityName}.{dueAt ? ` Due ${byDateText(dueAt, now(), viewerZone).replace(/^by /, "")}.` : " No deadline."}
          </p>
          <div className="flex flex-col gap-1">
            <span className="text-meta text-text-secondary">Sent on</span>
            <div className="flex items-center gap-2">
              <Input type="date" aria-label="Sent on date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[170px]" />
              <Input type="time" aria-label="Sent on time" value={time} onChange={(e) => setTime(e.target.value)} className="w-[110px]" />
              <span className="text-meta text-text-secondary">{tzAbbreviation(now(), viewerZone)}</span>
            </div>
            <span className="text-meta text-text-secondary">
              Not in the future and not before the resolution time{resolvedAt ? `, ${dayTimeText(resolvedAt, now(), viewerZone)}` : ""}.
            </span>
            {inFuture && <FieldError>The time can&apos;t be in the future</FieldError>}
            {beforeResolution && <FieldError>The time can&apos;t be before Resolved at ({dayTimeText(resolvedAt!, now(), viewerZone)})</FieldError>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="report-sent-to" className="text-meta text-text-secondary">Sent to</label>
              <Select value={contactId} onValueChange={setContactId} disabled={noContacts}>
                <SelectTrigger id="report-sent-to">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.fullName}
                      {c.role === "INCIDENT" ? " (Incident contact)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {noContacts && (
                <FieldError>
                  No active customer contact.{" "}
                  <Link href={`/entities/${entityId}/contacts`} className="underline">
                    Add one in Contacts
                  </Link>
                </FieldError>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="report-channel" className="text-meta text-text-secondary">Channel</label>
              <Select value={channel} onValueChange={(v) => setChannel(v as CommunicationChannel)}>
                <SelectTrigger id="report-channel">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {COMMUNICATION_CHANNEL_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="report-link" className="text-meta text-text-secondary">Report link</label>
            <Input id="report-link" value={reportUrl} onChange={(e) => setReportUrl(e.target.value)} placeholder={`https://${REPORT_LINK_HOST}/reports/…`} aria-invalid={!!urlError} />
            <span className="text-meta text-text-secondary">Optional. Only links on {REPORT_LINK_HOST}.</span>
            {urlError && <FieldError>{urlError}</FieldError>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="report-summary" className="text-meta text-text-secondary">Summary</label>
            <Textarea
              id="report-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={MAX_SUMMARY}
              rows={5}
              placeholder="What the report covers: cause, impact, corrective actions"
              aria-invalid={summaryShort}
            />
            <div className="flex items-center justify-between text-meta text-text-secondary">
              <span>10 to 2,000 characters</span>
              <span>{summary.length} / {MAX_SUMMARY.toLocaleString("en-GB")}</span>
            </div>
            {summaryShort && <FieldError>Enter at least 10 characters</FieldError>}
          </div>
          {error && <FieldError>{error}</FieldError>}
        </DialogBody>
        <DialogFooter>
          {blockedReason && (
            <span id="record-blocked-reason" className="mr-auto text-meta text-text-secondary">
              {blockedReason}
            </span>
          )}
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={!valid} disabledReason={blockedReason ?? undefined} aria-describedby={blockedReason ? "record-blocked-reason" : undefined} loading={pending} onClick={() => void save()}>
            Record report sent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
