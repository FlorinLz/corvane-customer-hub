// Brief AC4 (ISO 9362): 8 or 11 chars - 4 letters (institution), 2 letters
// (a valid ISO 3166-1 country code), 2 letters or digits (location), an
// optional 3 letters or digits (branch).
//
// Deliberately does not import COUNTRIES from @/server/config itself: this
// module is isomorphic (used for client-side inline validation too), and a
// top-level import of a server-only module would get bundled into client
// JS regardless of which export is actually used — the same class of bug
// fixed in src/server/config.ts's postinstall/prisma.config.ts cousins.
// Callers pass the valid country codes in.
const BIC_RE = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

export function normaliseBic(v: string): string {
  return v.trim().toUpperCase();
}

export function bicCountryCode(v: string): string {
  return normaliseBic(v).slice(4, 6);
}

export function isValidBic(v: string, validCountryCodes: ReadonlySet<string>): boolean {
  const bic = normaliseBic(v);
  if (!BIC_RE.test(bic)) return false;
  return validCountryCodes.has(bicCountryCode(bic));
}
