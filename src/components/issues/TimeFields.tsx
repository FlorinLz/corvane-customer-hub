"use client";

import * as React from "react";
import { AwarenessSource } from "@prisma/client";

import { now } from "@/lib/dates";
import { AWARENESS_SOURCE_LABELS } from "@/lib/labels";
import { splitInZone, tzAbbreviation, zonedDateTimeToUtc } from "@/lib/time-zones";
import { checkTimes, type TimesErrors } from "@/server/issues/times";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Times rule 3 and 5: the three fields the Report issue drawer and the Correct times dialog share.
// Corvane aware at (required), Source (required), Event date and time with "Unknown". Order rule: Event <= Corvane aware at <= Opened <= now.

const SOURCES = Object.values(AwarenessSource);

export interface TimesFormState {
  awareDate: string;
  awareTime: string;
  source: AwarenessSource | "";
  eventUnknown: boolean;
  eventDate: string;
  eventTime: string;
}

/**
 * Fields prefilled from stored instants (Correct times), or for a new report: Corvane aware at is "now" in the viewer's zone and
 * Event starts empty. Event is optional; left empty it is saved as Unknown, so a time nobody stated is never recorded.
 */
export function timesFormFrom(zone: string, v?: { awareAt: Date; eventAt: Date | null; source: AwarenessSource }): TimesFormState {
  const aware = splitInZone(v?.awareAt ?? now(), zone);
  const event = v?.eventAt ? splitInZone(v.eventAt, zone) : null;
  return {
    awareDate: aware.date,
    awareTime: aware.time,
    source: v?.source ?? "EMAIL",
    eventUnknown: !!v && event === null,
    eventDate: event?.date ?? "",
    eventTime: event?.time ?? "",
  };
}

/** Event as an instant; null when Unknown or left empty. Validation (Event on or before Corvane aware at) runs only when it has a value. */
export function eventInstant(form: TimesFormState, zone: string): Date | null {
  if (form.eventUnknown || !form.eventDate || !form.eventTime) return null;
  return zonedDateTimeToUtc(form.eventDate, form.eventTime, zone);
}

export function awareInstant(form: TimesFormState, zone: string): Date {
  return zonedDateTimeToUtc(form.awareDate, form.awareTime, zone);
}

/** The request fields: ISO instants, `eventAt: null` for Unknown. */
export function timesBody(form: TimesFormState, zone: string) {
  return { awareAt: awareInstant(form, zone).toISOString(), eventAt: eventInstant(form, zone)?.toISOString() ?? null, awarenessSource: form.source };
}

/** Order errors for the form as it stands. `openedAt` is the issue's creation time when correcting; omit it when reporting. */
export function timesErrors(form: TimesFormState, zone: string, openedAt?: Date): TimesErrors {
  if (!form.awareDate || !form.awareTime) return { awareAt: "Enter when Corvane became aware" };
  if (!form.eventUnknown && !!form.eventDate !== !!form.eventTime) return { eventAt: "Enter both the event date and the event time, or leave them empty" };
  return checkTimes({ eventAt: eventInstant(form, zone), awareAt: awareInstant(form, zone), openedAt, now: now() });
}

export function timesValid(form: TimesFormState, zone: string, openedAt?: Date): boolean {
  const e = timesErrors(form, zone, openedAt);
  return !e.eventAt && !e.awareAt && form.source !== "";
}

export function TimesFields({
  form,
  onChange,
  zone,
  openedAt,
  awareLocked = false,
  showSource = true,
  serverErrors = {},
  idPrefix,
}: {
  form: TimesFormState;
  onChange: (next: TimesFormState) => void;
  zone: string;
  openedAt?: Date;
  /** Monitoring issues: Corvane aware at is the alert time and is not correctable. */
  awareLocked?: boolean;
  showSource?: boolean;
  serverErrors?: Record<string, string[]>;
  idPrefix: string;
}) {
  const errors = timesErrors(form, zone, openedAt);
  let awareError: string | undefined = errors.awareAt ?? serverErrors.awareAt?.[0];
  const eventError = errors.eventAt ?? serverErrors.eventAt?.[0];
  // An order error is about one field: Event after Corvane aware at is the Event's mistake, so it shows there and not on both.
  if (awareError && eventError) awareError = undefined;
  const abbr = tzAbbreviation(now(), zone);
  const set = (patch: Partial<TimesFormState>) => onChange({ ...form, ...patch });
  const setAware = (patch: Pick<Partial<TimesFormState>, "awareDate" | "awareTime">) => set(patch);
  const setEvent = (patch: Pick<Partial<TimesFormState>, "eventDate" | "eventTime">) => set(patch);

  const eventBlock = (
    <div className="flex flex-col gap-1">
      <span className="text-meta text-text-secondary" id={`${idPrefix}-event-label`}>Event date and time</span>
      <div className="flex items-center gap-2">
        <Input type="date" aria-labelledby={`${idPrefix}-event-label`} data-testid={`${idPrefix}-event-date`} value={form.eventDate} disabled={form.eventUnknown} aria-invalid={!!eventError} aria-describedby={eventError ? `${idPrefix}-event-error` : undefined} onChange={(e) => setEvent({ eventDate: e.target.value })} className="w-[170px]" />
        <Input type="time" aria-label="Event time" data-testid={`${idPrefix}-event-time`} value={form.eventTime} disabled={form.eventUnknown} aria-invalid={!!eventError} aria-describedby={eventError ? `${idPrefix}-event-error` : undefined} onChange={(e) => setEvent({ eventTime: e.target.value })} className="w-[110px]" />
        <span className="text-meta text-text-secondary">{abbr}</span>
        <label className="ml-1 flex items-center gap-2 text-body">
          <Checkbox
            data-testid={`${idPrefix}-event-unknown`}
            checked={form.eventUnknown}
            onChange={(e) => set(e.target.checked ? { eventUnknown: true, eventDate: "", eventTime: "" } : { eventUnknown: false })}
          />
          Unknown
        </label>
      </div>
      {eventError && <FieldError id={`${idPrefix}-event-error`}>{eventError}</FieldError>}
      <p className="text-meta text-text-secondary">When the problem started, if known.</p>
    </div>
  );

  const awareBlock = (
    <div className="flex flex-col gap-1">
      <span className="text-meta text-text-secondary" id={`${idPrefix}-aware-label`}>Corvane aware at *</span>
      <div className="flex items-center gap-2">
        <Input type="date" aria-labelledby={`${idPrefix}-aware-label`} data-testid={`${idPrefix}-aware-date`} value={form.awareDate} disabled={awareLocked} aria-invalid={!!awareError} aria-describedby={awareError ? `${idPrefix}-aware-error` : undefined} onChange={(e) => setAware({ awareDate: e.target.value })} className="w-[170px]" />
        <Input type="time" aria-label="Corvane aware at time" data-testid={`${idPrefix}-aware-time`} value={form.awareTime} disabled={awareLocked} aria-invalid={!!awareError} aria-describedby={awareError ? `${idPrefix}-aware-error` : undefined} onChange={(e) => setAware({ awareTime: e.target.value })} className="w-[110px]" />
        <span className="text-meta text-text-secondary">{abbr}</span>
      </div>
      {awareError && <FieldError id={`${idPrefix}-aware-error`}>{awareError}</FieldError>}
      <p className="text-meta text-text-secondary">
        {awareLocked
          ? "The alert time. It can't be corrected on a monitoring issue."
          : "When the signal reached Corvane, for example when the email arrived, not when it was read. Deadlines count from this time."}
      </p>
    </div>
  );

  const sourceBlock = showSource && (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${idPrefix}-source`} className="text-meta text-text-secondary">Source *</label>
      <Select value={form.source} onValueChange={(v) => set({ source: v as AwarenessSource })}>
        <SelectTrigger id={`${idPrefix}-source`} data-testid={`${idPrefix}-source`}>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        {/* sideOffset: the list opens below the helper text, never over it. */}
        <SelectContent sideOffset={30}>
          {SOURCES.map((s) => (
            <SelectItem key={s} value={s}>
              {AWARENESS_SOURCE_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-meta text-text-secondary">How the signal reached Corvane: Email, Phone, Chat, Monitoring or Internal.</p>
    </div>
  );

  // Report drawer order (board): Corvane aware at, Source, Event. The Correct times dialog (board) puts Event first.
  return idPrefix === "correct-times" ? (
    <>
      {eventBlock}
      {awareBlock}
      {sourceBlock}
    </>
  ) : (
    <>
      {awareBlock}
      {sourceBlock}
      {eventBlock}
    </>
  );
}
