"use client";

import { Plus } from "lucide-react";
import { ContactRole } from "@prisma/client";

import { CONTACT_ROLE_LABELS } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Banner } from "@/components/customer-wizard/Banner";
import type { ContactState, ContactsState, FieldErrors } from "@/components/customer-wizard/types";
import { FieldError } from "@/components/ui/field-error";

const WIZARD_ROLES = [ContactRole.CHAMPION, ContactRole.DECISION_MAKER] as const;
const COMMON_TIME_ZONES = [
  "Europe/Bucharest", "Europe/London", "Europe/Berlin", "Europe/Paris", "Europe/Madrid", "Europe/Rome", "Europe/Vienna",
  "Europe/Warsaw", "Europe/Lisbon", "Europe/Dublin", "Europe/Amsterdam", "Europe/Athens", "Europe/Istanbul",
  "America/New_York", "America/Chicago", "America/Los_Angeles", "America/Sao_Paulo", "Asia/Singapore",
  "Asia/Dubai", "Asia/Tokyo", "Africa/Johannesburg", "Australia/Sydney", "UTC",
];
const WEEKDAYS = [
  { value: 1, label: "Mon" }, { value: 2, label: "Tue" }, { value: 3, label: "Wed" },
  { value: 4, label: "Thu" }, { value: 5, label: "Fri" }, { value: 6, label: "Sat" }, { value: 7, label: "Sun" },
];

export function emptyContact(): ContactState {
  return {
    role: ContactRole.CHAMPION,
    fullName: "",
    email: "",
    phone: "",
    timeZone: "",
    available24x7: false,
    fromDay: 1,
    toDay: 5,
    start: "09:00",
    end: "18:00",
    jobTitle: "",
  };
}

/** Same-email-different-role: informational only, client-side (brief Wizard-Step3). Same-email-same-role is a blocking field error from the schema. */
function findDuplicateEmail(contacts: ContactState[], index: number): ContactState | null {
  const email = contacts[index].email.trim().toLowerCase();
  if (!email) return null;
  for (let i = 0; i < index; i++) {
    if (contacts[i].email.trim().toLowerCase() === email) return contacts[i];
  }
  return null;
}

export function Step3Contacts({
  state,
  setState,
  errors,
}: {
  state: ContactsState;
  setState: (updater: (prev: ContactsState) => ContactsState) => void;
  errors: FieldErrors;
}) {
  function update(i: number, patch: Partial<ContactState>) {
    setState((prev) => ({ contacts: prev.contacts.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  }

  return (
    <div className="flex flex-col gap-4">
      {state.contacts.map((contact, i) => {
        const dup = findDuplicateEmail(state.contacts, i);
        const emailError = errors[`contacts.${i}.email`]?.[0];
        return (
          <Card key={i} aria-label={`Contact ${i + 1}`}>
            <CardHeader>
              <CardTitle className="text-subsection">Contact {i + 1}</CardTitle>
              <span className="flex-1" />
              {i > 0 && (
                <Button type="button" variant="text" onClick={() => setState((prev) => ({ contacts: prev.contacts.filter((_, j) => j !== i) }))}>
                  Remove contact
                </Button>
              )}
            </CardHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor={`contact-role-${i}`} className="text-meta text-text-secondary">Role *</label>
                <Select value={contact.role} onValueChange={(v) => update(i, { role: v as ContactRole })}>
                  <SelectTrigger id={`contact-role-${i}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WIZARD_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {CONTACT_ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-meta text-text-secondary">Technical, incident and escalation contacts are added by Ops. Billing contacts are added by Finance.</span>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={`contact-name-${i}`} className="text-meta text-text-secondary">Full name *</label>
                <Input id={`contact-name-${i}`} value={contact.fullName} onChange={(e) => update(i, { fullName: e.target.value })} aria-invalid={!!errors[`contacts.${i}.fullName`]} />
                {errors[`contacts.${i}.fullName`] && <FieldError>{errors[`contacts.${i}.fullName`][0]}</FieldError>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor={`contact-title-${i}`} className="text-meta text-text-secondary">Job title</label>
                <Input id={`contact-title-${i}`} value={contact.jobTitle} onChange={(e) => update(i, { jobTitle: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={`contact-email-${i}`} className="text-meta text-text-secondary">Email *</label>
                <Input id={`contact-email-${i}`} type="email" value={contact.email} onChange={(e) => update(i, { email: e.target.value })} aria-invalid={!!emailError} />
                {emailError && <FieldError>{emailError}</FieldError>}
                {!emailError && dup && (
                  <Banner variant="info">
                    This email is already used by another contact in this list.{" "}
                    <button
                      type="button"
                      className="font-medium text-link underline"
                      onClick={() => update(i, { fullName: dup.fullName, phone: dup.phone, timeZone: dup.timeZone, jobTitle: dup.jobTitle })}
                    >
                      Copy details from {dup.fullName} ({CONTACT_ROLE_LABELS[dup.role]})
                    </button>
                  </Banner>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor={`contact-phone-${i}`} className="text-meta text-text-secondary">Phone</label>
                <Input id={`contact-phone-${i}`} value={contact.phone} onChange={(e) => update(i, { phone: e.target.value })} placeholder="+447700900123" aria-invalid={!!errors[`contacts.${i}.phone`]} />
                {errors[`contacts.${i}.phone`] && <FieldError>{errors[`contacts.${i}.phone`][0]}</FieldError>}
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={`contact-tz-${i}`} className="text-meta text-text-secondary">Time zone</label>
                <Input id={`contact-tz-${i}`} list={`tz-options-${i}`} value={contact.timeZone} onChange={(e) => update(i, { timeZone: e.target.value })} placeholder="Search time zone..." />
                <datalist id={`tz-options-${i}`}>
                  {COMMON_TIME_ZONES.map((tz) => (
                    <option key={tz} value={tz} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-meta text-text-secondary">Availability window</label>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={String(contact.fromDay)} onValueChange={(v) => update(i, { fromDay: Number(v) })}>
                    <SelectTrigger className="w-[90px]" aria-label="From day">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((d) => (
                        <SelectItem key={d.value} value={String(d.value)}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-text-secondary">to</span>
                  <Select value={String(contact.toDay)} onValueChange={(v) => update(i, { toDay: Number(v) })}>
                    <SelectTrigger className="w-[90px]" aria-label="To day">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((d) => (
                        <SelectItem key={d.value} value={String(d.value)}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="time" aria-label="Start time" value={contact.start} onChange={(e) => update(i, { start: e.target.value })} className="w-[110px]" />
                  <span className="text-text-secondary">to</span>
                  <Input type="time" aria-label="End time" value={contact.end} onChange={(e) => update(i, { end: e.target.value })} className="w-[110px]" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-meta text-text-secondary">Status</label>
                <div className="flex h-9 items-center gap-2 rounded-sm border border-border-strong bg-tint px-3">
                  <Badge variant="success">Active</Badge>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
      {errors.contacts && <FieldError>{errors.contacts[0]}</FieldError>}
      <div>
        <Button type="button" variant="secondary" onClick={() => setState((prev) => ({ contacts: [...prev.contacts, emptyContact()] }))}>
          <Plus className="size-4" aria-hidden="true" /> Add contact
        </Button>
      </div>
    </div>
  );
}
