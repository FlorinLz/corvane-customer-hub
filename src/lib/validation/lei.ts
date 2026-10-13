// Brief 3.4.1. ISO 17442, check digits ISO 7064 MOD 97-10.
export function normaliseLei(v: string) {
  return v.trim().toUpperCase();
}

export function isValidLei(v: string): boolean {
  if (!/^[A-Z0-9]{18}[0-9]{2}$/.test(v)) return false;
  let rem = 0;
  for (const ch of v) {
    const n = ch >= "A" ? ch.charCodeAt(0) - 55 : ch.charCodeAt(0) - 48; // A=10 ... Z=35
    for (const d of String(n)) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem === 1;
}
