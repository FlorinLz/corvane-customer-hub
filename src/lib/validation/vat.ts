// Brief 3.4.1 (M14 AC2). No VIES call.
import { EU_VAT_PREFIX } from "@/server/config";

export function normaliseVat(v: string) {
  return v.replace(/[\s.-]/g, "").toUpperCase();
}

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Returns an error message, or null when the (already normalised) value is valid. */
export function checkVat(vat: string, country: string | null): string | null {
  const prefix = EU_VAT_PREFIX[country ?? ""];
  if (prefix) {
    return new RegExp(`^${prefix}[A-Z0-9]{2,12}$`).test(vat)
      ? null
      : `VAT ID must start with ${prefix} for ${countryName(country!)}`;
  }
  return /^[A-Z0-9]{4,20}$/.test(vat) ? null : "VAT / tax ID must be 4 to 20 letters or digits";
}
