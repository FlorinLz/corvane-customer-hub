"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import { NoteType } from "@prisma/client";

import { apiRequest } from "@/lib/api-client";
import { today } from "@/lib/dates";
import { NOTE_TYPE_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogFooter, DialogHeader, DrawerContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";

const MAX_SUMMARY = 5000;
const MIN_SUMMARY = 20;
const NOTE_TYPES = Object.values(NoteType);

interface Participant {
  kind: "USER" | "CONTACT" | "FREE_TEXT";
  id?: string;
  name: string;
}

interface ActionItemRow {
  description: string;
  ownerId: string;
  dueDate: string;
}

export function AddNoteDrawer({
  entityId,
  users,
  contacts,
}: {
  entityId: string;
  users: { id: string; name: string }[];
  contacts: { id: string; fullName: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<NoteType>(NoteType.CALL);
  const [interactionDate, setInteractionDate] = React.useState(today());
  const [participants, setParticipants] = React.useState<Participant[]>([]);
  const [freeTextName, setFreeTextName] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [items, setItems] = React.useState<ActionItemRow[]>([]);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [pending, setPending] = React.useState(false);

  function reset() {
    setType(NoteType.CALL);
    setInteractionDate(today());
    setParticipants([]);
    setFreeTextName("");
    setSummary("");
    setItems([]);
    setErrors({});
  }

  function addUser(id: string) {
    const user = users.find((u) => u.id === id);
    if (user && !participants.some((p) => p.kind === "USER" && p.id === id)) {
      setParticipants((p) => [...p, { kind: "USER", id, name: user.name }]);
    }
  }
  function addContact(id: string) {
    const contact = contacts.find((c) => c.id === id);
    if (contact && !participants.some((p) => p.kind === "CONTACT" && p.id === id)) {
      setParticipants((p) => [...p, { kind: "CONTACT", id, name: contact.fullName }]);
    }
  }
  function addFreeText() {
    const name = freeTextName.trim();
    if (name && participants.length < 10) {
      setParticipants((p) => [...p, { kind: "FREE_TEXT", name }]);
      setFreeTextName("");
    }
  }
  function removeParticipant(index: number) {
    setParticipants((p) => p.filter((_, i) => i !== index));
  }

  function addItem() {
    if (items.length < 20) setItems((rows) => [...rows, { description: "", ownerId: "", dueDate: "" }]);
  }
  function updateItem(index: number, patch: Partial<ActionItemRow>) {
    setItems((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function removeItem(index: number) {
    setItems((rows) => rows.filter((_, i) => i !== index));
  }

  async function save() {
    setPending(true);
    setErrors({});
    try {
      const result = await apiRequest(`/api/entities/${entityId}/notes`, "POST", {
        type,
        interactionDate,
        participants: participants.map((p) => (p.kind === "USER" ? { kind: "USER", userId: p.id } : p.kind === "CONTACT" ? { kind: "CONTACT", contactId: p.id } : { kind: "FREE_TEXT", name: p.name })),
        summary,
        actionItems: items,
      });
      if (!result.ok) {
        if (result.kind === "validation") setErrors(result.fieldErrors);
        else toast.error("Note not saved. Try again.");
        return;
      }
      setOpen(false);
      toast.success("Note added");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const summaryValid = summary.trim().length >= MIN_SUMMARY && summary.length <= MAX_SUMMARY;
  const itemsValid = items.every((i) => i.description.trim() && i.ownerId && i.dueDate);
  const valid = summaryValid && itemsValid;

  const availableUsers = users.filter((u) => !participants.some((p) => p.kind === "USER" && p.id === u.id));
  const availableContacts = contacts.filter((c) => !participants.some((p) => p.kind === "CONTACT" && p.id === c.id));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <Button onClick={() => setOpen(true)}>Add note</Button>
      <DrawerContent width={560}>
        <DialogHeader>Add note</DialogHeader>
        <DialogBody className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-1">
            <label htmlFor="note-type" className="text-meta text-text-secondary">Type</label>
            <Select value={type} onValueChange={(v) => setType(v as NoteType)}>
              <SelectTrigger id="note-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {NOTE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="note-interaction-date" className="text-meta text-text-secondary">Interaction date</label>
            <Input id="note-interaction-date" type="date" max={today()} value={interactionDate} onChange={(e) => setInteractionDate(e.target.value)} aria-invalid={!!errors.interactionDate} />
            {errors.interactionDate && <FieldError>{errors.interactionDate[0]}</FieldError>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-meta text-text-secondary">Participants</label>
            {participants.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {participants.map((p, i) => (
                  <span key={`${p.kind}-${p.id ?? p.name}-${i}`} className="flex items-center gap-1 rounded-full bg-tint px-2.5 py-1 text-meta">
                    {p.name}
                    <button type="button" onClick={() => removeParticipant(i)} aria-label={`Remove ${p.name}`}>
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Select value="" onValueChange={addUser}>
                <SelectTrigger className="w-[160px]" aria-label="Add colleague">
                  <SelectValue placeholder="Add colleague" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value="" onValueChange={addContact}>
                <SelectTrigger className="w-[160px]" aria-label="Add contact">
                  <SelectValue placeholder="Add contact" />
                </SelectTrigger>
                <SelectContent>
                  {availableContacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                aria-label="Add another person"
                value={freeTextName}
                onChange={(e) => setFreeTextName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addFreeText();
                  }
                }}
                placeholder="Other person, press Enter"
                className="w-[180px]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="note-summary" className="text-meta text-text-secondary">Summary</label>
            <Textarea id="note-summary" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={MAX_SUMMARY} rows={5} aria-invalid={summary.length > 0 && !summaryValid} />
            <span className="self-end text-meta text-text-secondary">{summary.length} / {MAX_SUMMARY}</span>
            {errors.summary && <FieldError>{errors.summary[0]}</FieldError>}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-meta text-text-secondary">Action items</label>
            {items.map((item, i) => (
              <div key={i} className="flex flex-wrap items-start gap-2 rounded-md border border-border p-2">
                <Input
                  aria-label="Action item description"
                  value={item.description}
                  onChange={(e) => updateItem(i, { description: e.target.value })}
                  placeholder="Description"
                  className="min-w-[160px] flex-1"
                />
                <Select value={item.ownerId} onValueChange={(v) => updateItem(i, { ownerId: v })}>
                  <SelectTrigger className="w-[150px]" aria-label="Action item owner">
                    <SelectValue placeholder="Owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input aria-label="Action item due date" type="date" min={today()} value={item.dueDate} onChange={(e) => updateItem(i, { dueDate: e.target.value })} className="w-[150px]" />
                <button type="button" onClick={() => removeItem(i)} aria-label="Remove action item" className="mt-2">
                  <X className="size-4 text-text-secondary" aria-hidden="true" />
                </button>
              </div>
            ))}
            {errors.actionItems && <FieldError>{errors.actionItems[0]}</FieldError>}
            <Button variant="secondary" type="button" onClick={addItem} className="self-start">
              + Add action item
            </Button>
          </div>
        </DialogBody>
        <DialogFooter reason={valid ? null : !summaryValid ? `Write at least ${MIN_SUMMARY} characters` : "Complete each action item"}>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={pending} onClick={() => void save()}>
            Save note
          </Button>
        </DialogFooter>
      </DrawerContent>
    </Dialog>
  );
}
