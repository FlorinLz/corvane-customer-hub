"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CommunicationChannel, CommunicationType } from "@prisma/client";

import { apiRequest } from "@/lib/api-client";
import { now } from "@/lib/dates";
import { defaultIncidentContactId } from "@/lib/incident-contact";
import { splitInZone, tzAbbreviation, zonedDateTimeToUtc } from "@/lib/time-zones";
import { COMMUNICATION_CHANNEL_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FieldError } from "@/components/ui/field-error";

const CHANNELS = Object.values(CommunicationChannel);
const MIN_MESSAGE = 10;
const MAX_MESSAGE = 5000;

interface Contact {
  id: string;
  fullName: string;
  role: string;
}

/** Brief M22 AC6, AC7, AC13. Effective communicator only. `notificationDone`: whether First notification already ran, so Update is the default type thereafter. */
export function RecordCommunicationDialog({
  issueId,
  version,
  notificationDone,
  contacts,
  prefilledMessage,
  viewerZone,
  triggerVariant = "primary",
  triggerLabel = "Record notification",
}: {
  issueId: string;
  version: number;
  notificationDone: boolean;
  contacts: Contact[];
  prefilledMessage: string;
  viewerZone: string;
  triggerVariant?: "primary" | "secondary";
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<CommunicationType>(notificationDone ? "UPDATE" : "FIRST_NOTIFICATION");
  const [date, setDate] = React.useState(() => splitInZone(now(), viewerZone).date);
  const [time, setTime] = React.useState(() => splitInZone(now(), viewerZone).time);
  const [channel, setChannel] = React.useState<CommunicationChannel | "">("");
  const [contactId, setContactId] = React.useState(() => defaultIncidentContactId(contacts));
  const [personName, setPersonName] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function reset() {
    setType(notificationDone ? "UPDATE" : "FIRST_NOTIFICATION");
    const t = splitInZone(now(), viewerZone);
    setDate(t.date);
    setTime(t.time);
    setChannel("");
    setContactId(defaultIncidentContactId(contacts));
    setPersonName("");
    setMessage("");
    setError(null);
  }

  function selectChannel(v: CommunicationChannel) {
    setChannel(v);
    if (v === "EMAIL" && !message) setMessage(prefilledMessage);
  }

  async function save() {
    setPending(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/issues/${issueId}/communications`, "POST", {
        type,
        occurredAt: zonedDateTimeToUtc(date, time, viewerZone).toISOString(),
        channel,
        contactId: contactId || undefined,
        personName: contactId ? undefined : personName || undefined,
        message,
        version,
      });
      if (!res.ok) {
        if (res.kind === "validation") setError(Object.values(res.fieldErrors)[0]?.[0] ?? "Notification not saved. Try again.");
        else if (res.kind === "issue_forbidden") setError(res.message);
        else setError("Notification not saved. Try again.");
        return;
      }
      setOpen(false);
      toast.success(type === "FIRST_NOTIFICATION" ? "Notification recorded" : "Update recorded");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const occurredAtInFuture = zonedDateTimeToUtc(date, time, viewerZone) > now();

  const valid = channel !== "" && (contactId !== "" || personName.trim() !== "") && message.trim().length >= MIN_MESSAGE && message.length <= MAX_MESSAGE && !occurredAtInFuture;
  /** Why "Record notification" is disabled, said next to the button: the first thing still missing. */
  const blockedReason: string | null = valid
    ? null
    : channel === ""
      ? "Choose the channel"
      : contactId === "" && personName.trim() === ""
        ? "Choose who it was sent to"
        : message.trim().length < MIN_MESSAGE
          ? `Write at least ${MIN_MESSAGE} characters`
          : message.length > MAX_MESSAGE
            ? "The message is too long"
            : "The time can't be in the future";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <Button data-onboarding="record-communication" variant={triggerVariant} onClick={() => setOpen(true)}>{triggerLabel}</Button>
      <DialogContent>
        <DialogHeader>Record notification</DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-1">
            <span className="text-meta text-text-secondary">Type</span>
            <div className="flex gap-1" role="radiogroup" aria-label="Type">
              {(["FIRST_NOTIFICATION", "UPDATE"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn("rounded-sm border px-3 py-1.5 text-body", type === t ? "border-primary bg-selected text-primary" : "border-border-strong bg-white text-text")}
                >
                  {t === "FIRST_NOTIFICATION" ? "First notification" : "Update"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-meta text-text-secondary">Time</span>
            <div className="flex items-center gap-2">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[170px]" />
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-[110px]" />
              <span className="text-meta text-text-secondary">{tzAbbreviation(now(), viewerZone)}</span>
            </div>
            {occurredAtInFuture && <FieldError>The time can&apos;t be in the future</FieldError>}
            {error && error.includes("Corvane aware at") && <FieldError>{error}</FieldError>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="record-comm-channel" className="text-meta text-text-secondary">Channel</label>
              <Select value={channel} onValueChange={(v) => selectChannel(v as CommunicationChannel)}>
                <SelectTrigger id="record-comm-channel" data-onboarding="dialog-channel">
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
            <div className="flex flex-col gap-1">
              <label htmlFor="record-comm-person" className="text-meta text-text-secondary">Person</label>
              <Select
                value={contactId ? `CONTACT:${contactId}` : personName ? "OTHER" : ""}
                onValueChange={(v) => {
                  if (v.startsWith("CONTACT:")) {
                    setContactId(v.slice("CONTACT:".length));
                    setPersonName("");
                  } else {
                    setContactId("");
                  }
                }}
              >
                <SelectTrigger id="record-comm-person">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={`CONTACT:${c.id}`}>
                      {c.fullName}
                      {c.role === "INCIDENT" ? " (Incident contact)" : ""}
                    </SelectItem>
                  ))}
                  <SelectItem value="OTHER">Other person</SelectItem>
                </SelectContent>
              </Select>
              {!contactId && (
                <Input placeholder="Name of the person" value={personName} onChange={(e) => setPersonName(e.target.value.slice(0, 120))} />
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="record-comm-message" className="text-meta text-text-secondary">Message</label>
            <Textarea id="record-comm-message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={MAX_MESSAGE} rows={8} className="font-mono text-[13px]" aria-invalid={message.length > 0 && message.trim().length < MIN_MESSAGE} />
            <span className="self-end text-meta text-text-secondary">{message.length} / {MAX_MESSAGE}</span>
          </div>
          {error && !error.includes("Corvane aware at") && <FieldError>{error}</FieldError>}
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
          <Button data-onboarding="record-communication-submit" disabled={!valid} disabledReason={blockedReason ?? undefined} aria-describedby={blockedReason ? "record-blocked-reason" : undefined} loading={pending} onClick={() => void save()}>
            Record notification
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
