// Brief 3.4.1: E.164.
export function normalisePhone(v: string): string {
  return v.replace(/[\s\-.()]/g, "");
}

// "+" then 8 to 15 digits, first digit 1-9.
export const E164_RE = /^\+[1-9][0-9]{7,14}$/;

/** "0044 7700 900123" → "+447700900123"; null when there is no "00 → +" rewrite to suggest. */
export function suggestPhone(v: string): string | null {
  const n = normalisePhone(v);
  return n.startsWith("00") ? "+" + n.slice(2) : null;
}

/** Brief 3.4.2 Contact/Phone error copy, with the optional suggestion suffix. */
export function phoneError(v: string): string | null {
  const n = normalisePhone(v);
  if (E164_RE.test(n)) return null;
  const suggestion = suggestPhone(v);
  const base = "Use international format, for example +447700900123";
  return suggestion ? `${base}. Did you mean ${suggestion}?` : base;
}
