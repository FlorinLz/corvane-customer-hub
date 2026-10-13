import type { AwarenessSource } from "@prisma/client";

import { formatInZone } from "@/lib/time-zones";
import { AWARENESS_SOURCE_LABELS } from "@/lib/labels";

export type CorrectedField = "EVENT_AT" | "AWARE_AT" | "AWARENESS_SOURCE";

export const CORRECTED_FIELD_LABELS: Record<CorrectedField, string> = {
  EVENT_AT: "Event",
  AWARE_AT: "Corvane aware at",
  AWARENESS_SOURCE: "Source",
};

/** The stored value of one corrected field as text: a time in `zone` ("05 Oct 2026 10:00 MYT"), a source label, or "Unknown". */
export function correctionValueText(field: string, value: string | null, zone: string): string {
  if (value === null) return "Unknown";
  if (field === "AWARENESS_SOURCE") return AWARENESS_SOURCE_LABELS[value as AwarenessSource] ?? value;
  const text = formatInZone(new Date(value), zone);
  return zone === "UTC" ? text.replace("UTC+00:00", "UTC") : text;
}

/** The History sentence: "Corvane aware at corrected from 12:00 to 10:00 MYT by Kevin Lim: <reason>". The event stores UTC; the reader's zone is applied here. */
export function correctionSentence(d: { field: string; oldValue: string | null; newValue: string | null; by: string; reason: string }, zone: string): string {
  const label = CORRECTED_FIELD_LABELS[d.field as CorrectedField] ?? d.field;
  return `${label} corrected from ${correctionValueText(d.field, d.oldValue, zone)} to ${correctionValueText(d.field, d.newValue, zone)} by ${d.by}: ${d.reason}`;
}

/** A History event's sentence in the reader's zone: corrections store UTC and their raw values in `details`; every other event is its stored text. */
export function historySummary(e: { summary: string; details?: unknown }, zone: string): string {
  const d = e.details as { kind?: string; field: string; oldValue: string | null; newValue: string | null; by: string; reason: string } | null | undefined;
  return d && !Array.isArray(d) && d.kind === "TIME_CORRECTION" ? correctionSentence(d, zone) : e.summary;
}
