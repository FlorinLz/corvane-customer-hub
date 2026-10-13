"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CommunicationChannel } from "@prisma/client";

import { dialogNow, openingTime } from "@/lib/dialog-time";
import { apiRequest } from "@/lib/api-client";
import { now } from "@/lib/dates";
import { tzAbbreviation, zonedDateTimeToUtc } from "@/lib/time-zones";
import { COMMUNICATION_CHANNEL_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";

const CHANNELS = Object.values(CommunicationChannel);
const MAX_NOTE = 500;

interface Contact {
  id: string;
  fullName: string;
  role: string;
}

/** Brief M22 AC11, AC12. Communicator only, status Resolved. Confirms the resolution with the customer (the partner); the issue closes once every step is done. */
export function CloseDialog({ issueId, version, contacts, viewerZone, resolvedAt, triggerVariant = "primary", triggerLabel = "Confirm resolution with the customer", partner = false }: { issueId: string; version: number; contacts: Contact[]; viewerZone: string; resolvedAt: Date | null; triggerVariant?: "primary" | "secondary"; triggerLabel?: string; /** A partner issue: the confirmation comes from the partner. */ partner?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [contactId, setContactId] = React.useState("");
  const [personName, setPersonName] = React.useState("");
  const [channel, setChannel] = React.useState<CommunicationChannel | "">("");
  const [date, setDate] = React.useState(() => openingTime(resolvedAt, viewerZone).date);
  const [time, setTime] = React.useState(() => openingTime(resolvedAt, viewerZone).time);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function reset() {
    setContactId("");
    setPersonName("");
    setChannel("");
    const t = openingTime(resolvedAt, viewerZone); // read when the dialog opens, never a value kept from page load
    setDate(t.date);
    setTime(t.time);
    setNote("");
    setError(null);
  }

  async function save() {
    setPending(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/issues/${issueId}/close`, "POST", {
        personContactId: contactId || undefined,
        personName: contactId ? undefined : personName || undefined,
        channel,
        occurredAt: zonedDateTimeToUtc(date, time, viewerZone).toISOString(),
        note: note || undefined,
        version,
      });
      if (!res.ok) {
        if (res.kind === "validation") setError(Object.values(res.fieldErrors)[0]?.[0] ?? "Action not saved. Try again.");
        else if (res.kind === "issue_forbidden") setError(res.message);
        else setError("Action not saved. Try again.");
        return;
      }
      setOpen(false);
      toast.success("Resolution confirmed");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const occurredAtInFuture = zonedDateTimeToUtc(date, time, viewerZone) > dialogNow(resolvedAt);

  const valid = (contactId !== "" || personName.trim() !== "") && channel !== "" && !occurredAtInFuture;
  /** Why "Confirm resolution" is disabled, said next to the button: the first thing still missing. */
  const blockedReason: string | null = valid ? null : contactId === "" && personName.trim() === "" ? `Choose who confirmed` : channel === "" ? "Choose the channel" : "The time can't be in the future";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <Button variant={triggerVariant} onClick={() => setOpen(true)}>{triggerLabel}</Button>
      <DialogContent>
        <DialogHeader>Confirm resolution</DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-1">
            <label htmlFor="close-issue-person" className="text-meta text-text-secondary">{partner ? "Partner" : "Customer"} confirmation from</label>
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
              <SelectTrigger id="close-issue-person">
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
            {!contactId && <Input placeholder="Name of the person" value={personName} onChange={(e) => setPersonName(e.target.value.slice(0, 120))} />}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="close-issue-channel" className="text-meta text-text-secondary">Channel</label>
              <Select value={channel} onValueChange={(v) => setChannel(v as CommunicationChannel)}>
                <SelectTrigger id="close-issue-channel">
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
              <span className="text-meta text-text-secondary">Time</span>
              <div className="flex items-center gap-2">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-[100px]" />
                <span className="text-meta text-text-secondary">{tzAbbreviation(now(), viewerZone)}</span>
              </div>
              {occurredAtInFuture && <FieldError>The time can&apos;t be in the future</FieldError>}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="close-issue-note" className="text-meta text-text-secondary">Note (optional)</label>
            <Textarea id="close-issue-note" value={note} onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))} maxLength={MAX_NOTE} />
            <span className="self-end text-meta text-text-secondary">{note.length} / {MAX_NOTE}</span>
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
            Confirm resolution
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
