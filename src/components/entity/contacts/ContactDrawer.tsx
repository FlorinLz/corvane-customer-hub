"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ContactContext, ContactRole } from "@prisma/client";

import { apiRequest } from "@/lib/api-client";
import { CONTACT_ROLE_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTrigger, DrawerContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldError } from "@/components/ui/field-error";

const COMMON_TIME_ZONES = [
  "Europe/Bucharest", "Europe/London", "Europe/Berlin", "Europe/Paris", "Europe/Madrid", "Europe/Rome",
  "Europe/Warsaw", "Europe/Lisbon", "Europe/Dublin", "Europe/Amsterdam", "Europe/Athens", "Europe/Istanbul",
  "America/New_York", "America/Chicago", "America/Los_Angeles", "America/Sao_Paulo", "Asia/Singapore",
  "Asia/Dubai", "Asia/Tokyo", "Africa/Johannesburg", "Australia/Sydney", "UTC",
];

const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: "Mon" }, { value: 2, label: "Tue" }, { value: 3, label: "Wed" },
  { value: 4, label: "Thu" }, { value: 5, label: "Fri" }, { value: 6, label: "Sat" }, { value: 7, label: "Sun" },
];

const PHONE_REQUIRED: ContactRole[] = [ContactRole.INCIDENT, ContactRole.ESCALATION];
const TZ_REQUIRED: ContactRole[] = [ContactRole.INCIDENT, ContactRole.ESCALATION, ContactRole.TECHNICAL];
const AVAILABILITY_REQUIRED: ContactRole[] = [ContactRole.INCIDENT, ContactRole.ESCALATION];

export interface ContactFormValues {
  context: ContactContext;
  role: ContactRole;
  fullName: string;
  email: string;
  phone: string;
  timeZone: string;
  available24x7: boolean;
  fromDay: number;
  toDay: number;
  start: string;
  end: string;
  jobTitle: string;
  isPrimary: boolean;
  status: "ACTIVE" | "LEFT";
}

function daysInRange(from: number, to: number): number[] {
  const days: number[] = [];
  let d = from;
  while (true) {
    days.push(d);
    if (d === to) break;
    d = d === 7 ? 1 : d + 1;
  }
  return days;
}

function emptyForm(context: ContactContext, offeredRoles: ContactRole[]): ContactFormValues {
  return {
    context,
    role: offeredRoles[0],
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
    isPrimary: false,
    status: "ACTIVE",
  };
}

/** 480px right-side drawer, shared between Add and Edit. */
export function ContactDrawer({
  entityId,
  contactId,
  version,
  offeredRoles,
  contexts,
  initial,
  trigger,
}: {
  entityId: string;
  contactId?: string;
  version?: number;
  offeredRoles: ContactRole[];
  contexts: ContactContext[];
  initial?: Partial<ContactFormValues>;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const isEdit = Boolean(contactId);
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<ContactFormValues>({ ...emptyForm(contexts[0], offeredRoles), ...initial });
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [duplicateWarning, setDuplicateWarning] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function reset() {
    setValues({ ...emptyForm(contexts[0], offeredRoles), ...initial });
    setErrors({});
    setDuplicateWarning(null);
  }

  function set<K extends keyof ContactFormValues>(key: K, value: ContactFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function availabilityPayload() {
    if (!AVAILABILITY_REQUIRED.includes(values.role) && !values.available24x7 && !values.start) return null;
    if (values.available24x7) return { available24x7: true as const };
    return { available24x7: false as const, days: daysInRange(values.fromDay, values.toDay), start: values.start, end: values.end };
  }

  async function save(confirmDuplicate = false) {
    setPending(true);
    setErrors({});
    setDuplicateWarning(null);
    try {
      const body = {
        context: values.context,
        role: values.role,
        fullName: values.fullName,
        email: values.email,
        phone: values.phone || null,
        timeZone: values.timeZone || null,
        availability: availabilityPayload(),
        jobTitle: values.jobTitle || null,
        ...(isEdit ? { status: values.status === "ACTIVE" ? ("ACTIVE" as const) : undefined, version } : { isPrimary: values.isPrimary, confirmDuplicate }),
      };
      const result = isEdit
        ? await apiRequest(`/api/contacts/${contactId}`, "PATCH", body)
        : await apiRequest(`/api/entities/${entityId}/contacts`, "POST", body);

      if (!result.ok) {
        if (result.kind === "validation") setErrors(result.fieldErrors);
        else if (result.kind === "conflict" && result.needsConfirmation) setDuplicateWarning(result.message);
        else toast.error(result.kind === "conflict" ? result.message : "Contact not saved. Try again.");
        return;
      }
      setOpen(false);
      toast.success("Contact saved");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const phoneRequired = PHONE_REQUIRED.includes(values.role);
  const tzRequired = TZ_REQUIRED.includes(values.role);
  const availabilityRequired = AVAILABILITY_REQUIRED.includes(values.role);
  const valid =
    values.fullName.trim().length >= 2 &&
    values.email.trim().length > 0 &&
    (!phoneRequired || values.phone.trim().length > 0) &&
    (!tzRequired || values.timeZone.trim().length > 0) &&
    (!availabilityRequired || values.available24x7 || (values.start && values.end && values.start !== values.end));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DrawerContent width={480}>
        <DialogHeader>{isEdit ? "Edit contact" : "Add contact"}</DialogHeader>
        <DialogBody className="flex-1 overflow-y-auto">
          {contexts.length > 1 && (
            <div className="flex flex-col gap-1">
              <label className="text-meta text-text-secondary">Context</label>
              <div className="flex overflow-hidden rounded-sm border border-border-strong">
                {contexts.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set("context", c)}
                    className={`h-9 flex-1 text-body ${values.context === c ? "bg-selected font-medium text-primary" : "bg-white text-text-secondary"}`}
                  >
                    {c === "CUSTOMER" ? "Customer" : "Partner"}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="contact-role" className="text-meta text-text-secondary">Role</label>
            <Select value={values.role} onValueChange={(v) => set("role", v as ContactRole)}>
              <SelectTrigger id="contact-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {offeredRoles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {CONTACT_ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="contact-full-name" className="text-meta text-text-secondary">Full name</label>
            <Input id="contact-full-name" value={values.fullName} onChange={(e) => set("fullName", e.target.value)} aria-invalid={!!errors.fullName} />
            {errors.fullName && <FieldError>{errors.fullName[0]}</FieldError>}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="contact-email" className="text-meta text-text-secondary">Email</label>
            <Input id="contact-email" type="email" value={values.email} onChange={(e) => set("email", e.target.value)} aria-invalid={!!errors.email} />
            {errors.email && <FieldError>{errors.email[0]}</FieldError>}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="contact-phone" className="text-meta text-text-secondary">Phone{phoneRequired && " *"}</label>
            <Input id="contact-phone" value={values.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+447700900123" aria-invalid={!!errors.phone} />
            {errors.phone && <FieldError>{errors.phone[0]}</FieldError>}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="contact-timezone" className="text-meta text-text-secondary">Time zone{tzRequired && " *"}</label>
            <Input
              id="contact-timezone"
              list="tz-options"
              value={values.timeZone}
              onChange={(e) => set("timeZone", e.target.value)}
              placeholder="Search time zone..."
              aria-invalid={!!errors.timeZone}
            />
            <datalist id="tz-options">
              {COMMON_TIME_ZONES.map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
            {errors.timeZone && <FieldError>{errors.timeZone[0]}</FieldError>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-meta text-text-secondary">Availability{availabilityRequired && " *"}</label>
            <div className="flex overflow-hidden rounded-sm border border-border-strong">
              <button
                type="button"
                onClick={() => set("available24x7", true)}
                className={`h-9 flex-1 text-body ${values.available24x7 ? "bg-selected font-medium text-primary" : "bg-white text-text-secondary"}`}
              >
                24/7
              </button>
              <button
                type="button"
                onClick={() => set("available24x7", false)}
                className={`h-9 flex-1 text-body ${!values.available24x7 ? "bg-selected font-medium text-primary" : "bg-white text-text-secondary"}`}
              >
                Weekdays
              </button>
            </div>
            {!values.available24x7 && (
              <div className="flex flex-wrap items-center gap-2">
                <Select value={String(values.fromDay)} onValueChange={(v) => set("fromDay", Number(v))}>
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
                <Select value={String(values.toDay)} onValueChange={(v) => set("toDay", Number(v))}>
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
                <Input type="time" aria-label="Start time" value={values.start} onChange={(e) => set("start", e.target.value)} className="w-[110px]" />
                <span className="text-text-secondary">to</span>
                <Input type="time" aria-label="End time" value={values.end} onChange={(e) => set("end", e.target.value)} className="w-[110px]" />
              </div>
            )}
            {errors.availability && <FieldError>{errors.availability[0]}</FieldError>}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="contact-job-title" className="text-meta text-text-secondary">Job title</label>
            <Input id="contact-job-title" value={values.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} />
          </div>

          {isEdit && initial?.status === "LEFT" && (
            <label className="flex items-center gap-2 text-body">
              <input
                type="checkbox"
                checked={values.status === "ACTIVE"}
                onChange={(e) => set("status", e.target.checked ? "ACTIVE" : "LEFT")}
                className="size-4 accent-primary"
              />
              Set back to Active
            </label>
          )}

          {!isEdit && values.role === "INCIDENT" && (
            <label className="flex items-center gap-2 text-body">
              <input type="checkbox" checked={values.isPrimary} onChange={(e) => set("isPrimary", e.target.checked)} className="size-4 accent-primary" />
              Primary incident contact
            </label>
          )}

          {duplicateWarning && (
            <div className="rounded-md border-l-4 border-l-due bg-tint p-3 text-body text-text">{duplicateWarning}</div>
          )}
        </DialogBody>
        <DialogFooter reason={valid ? null : values.fullName.trim().length < 2 ? "Enter the full name" : values.email.trim().length === 0 ? "Enter the email" : phoneRequired && values.phone.trim().length === 0 ? "Enter the phone number" : tzRequired && values.timeZone.trim().length === 0 ? "Choose the time zone" : "Set the availability"}>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={pending} onClick={() => void save(Boolean(duplicateWarning))}>
            {duplicateWarning ? "Save anyway" : "Save contact"}
          </Button>
        </DialogFooter>
      </DrawerContent>
    </Dialog>
  );
}
