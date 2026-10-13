import { formatDate, type LocalDate } from "@/lib/dates";

// Brief 3.1.3 "Audit value formatting (auditValue())". Each formatter takes
// a typed value and returns the display string recordFields() stores;
// `null`/`undefined` always render as `null` so the caller's create/remove
// semantics ("(none)" / "(removed)") apply uniformly.
export function auditText(v: string | null | undefined): string | null {
  return v === null || v === undefined || v === "" ? null : v;
}

export function auditDate(v: LocalDate | Date | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const local = typeof v === "string" ? v : v.toISOString().slice(0, 10);
  return formatDate(local);
}

export function auditTimestamp(v: Date | null | undefined): string | null {
  return v === null || v === undefined ? null : v.toISOString();
}

export function auditEnum<T extends string>(
  v: T | null | undefined,
  labels: Record<T, string>,
): string | null {
  return v === null || v === undefined ? null : labels[v];
}

export function auditDecimal(
  v: { toString(): string } | number | string | null | undefined,
): string | null {
  return v === null || v === undefined ? null : v.toString();
}

export function auditBoolean(v: boolean | null | undefined): string | null {
  return v === null || v === undefined ? null : v ? "Yes" : "No";
}

export function auditArray(v: string[] | null | undefined): string | null {
  return v === null || v === undefined || v.length === 0 ? null : v.join(", ");
}
