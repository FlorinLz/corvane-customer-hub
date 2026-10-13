import { describe, expect, it } from "vitest";

import { isValidAvailability } from "@/lib/validation/availability";
import { isValidEmail } from "@/lib/validation/email";
import { normalisePhone, phoneError, suggestPhone } from "@/lib/validation/phone";
import { isValidTimeZone } from "@/lib/validation/timezone";
import { addContactSchema } from "@/lib/validation/contact";

describe("phone (brief 3.4.1, M7 AC4, edge case 3)", () => {
  it("strips spaces, hyphens, dots and brackets before checking E.164", () => {
    expect(normalisePhone("+44 7700-900.123")).toBe("+447700900123");
    expect(normalisePhone("+(44) 7700 900 123")).toBe("+447700900123");
  });

  it("'0044 7700 900123' fails, with the suggestion '+447700900123'", () => {
    expect(phoneError("0044 7700 900123")).toBe("Use international format, for example +447700900123. Did you mean +447700900123?");
    expect(suggestPhone("0044 7700 900123")).toBe("+447700900123");
  });

  it("a valid E.164 number passes", () => {
    expect(phoneError("+447700900123")).toBeNull();
  });
});

describe("email (brief 3.4.1, M7 AC4)", () => {
  it("requires one @ and a dot in the domain", () => {
    expect(isValidEmail("priya.nair@example.com")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("two@@example.com")).toBe(false);
    expect(isValidEmail("no-domain-dot@example")).toBe(false);
  });
});

describe("addContactSchema role-conditional requirements (brief 3.4.2 Contact, decision B12)", () => {
  const base = { context: "CUSTOMER" as const, fullName: "Priya Nair", email: "priya.nair@example.com" };

  it("phone is required for Incident and Escalation", () => {
    expect(addContactSchema.safeParse({ ...base, role: "INCIDENT" }).success).toBe(false);
    expect(addContactSchema.safeParse({ ...base, role: "ESCALATION" }).success).toBe(false);
    expect(addContactSchema.safeParse({ ...base, role: "CHAMPION" }).success).toBe(true);
  });

  it("time zone is required for Incident, Escalation and Technical", () => {
    const withPhone = { ...base, phone: "+40712345678" };
    expect(addContactSchema.safeParse({ ...withPhone, role: "TECHNICAL" }).success).toBe(false);
    expect(
      addContactSchema.safeParse({ ...withPhone, role: "TECHNICAL", timeZone: "Europe/Bucharest" }).success,
    ).toBe(true);
  });

  it("availability is required for Incident and Escalation but not Technical", () => {
    const withPhoneAndTz = { ...base, phone: "+40712345678", timeZone: "Europe/Bucharest" };
    expect(addContactSchema.safeParse({ ...withPhoneAndTz, role: "INCIDENT" }).success).toBe(false);
    expect(addContactSchema.safeParse({ ...withPhoneAndTz, role: "TECHNICAL" }).success).toBe(true);
    expect(
      addContactSchema.safeParse({
        ...withPhoneAndTz,
        role: "INCIDENT",
        availability: { available24x7: false, days: [1, 2, 3, 4, 5], start: "09:00", end: "18:00" },
      }).success,
    ).toBe(true);
  });

  it("lowercases email on parse", () => {
    const result = addContactSchema.safeParse({ ...base, role: "CHAMPION", email: "Priya.Nair@Example.COM" });
    expect(result.success && result.data.email).toBe("priya.nair@example.com");
  });
});

describe("isValidTimeZone (brief 3.3.4)", () => {
  it("accepts a real IANA zone and rejects a made-up one", () => {
    expect(isValidTimeZone("Europe/Bucharest")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });

  it("accepts the bare 'UTC' alias (brief: 'Intl.supportedValuesOf(\"timeZone\") plus UTC' — the runtime list alone doesn't include it)", () => {
    expect(isValidTimeZone("UTC")).toBe(true);
  });
});

describe("isValidAvailability (brief 3.4.2, edge case 2)", () => {
  it("24/7 is always valid", () => {
    expect(isValidAvailability({ available24x7: true })).toBe(true);
  });

  it("requires at least 1 weekday and a start different from the end", () => {
    expect(isValidAvailability({ available24x7: false, days: [], start: "09:00", end: "18:00" })).toBe(false);
    expect(isValidAvailability({ available24x7: false, days: [1], start: "09:00", end: "09:00" })).toBe(false);
  });

  it("a window from 22:00 to 06:00 crosses midnight and is still valid", () => {
    expect(isValidAvailability({ available24x7: false, days: [1, 2, 3, 4, 5], start: "22:00", end: "06:00" })).toBe(true);
  });
});
