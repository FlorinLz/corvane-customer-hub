// Brief 3.4.1. One "@", a dot in the domain, no spaces; max 254; stored lowercase.
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(v: string): boolean {
  return v.length <= 254 && EMAIL_RE.test(v);
}
