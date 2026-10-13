// Brief 3.6.1. Used for search (keeps legal forms) and duplicate/core
// matching (strips them). Diacritics and punctuation are stripped in both.
const LEGAL_FORMS = ["plc", "sa", "s a", "s p a", "ag", "ltd", "dac", "b v", "n v", "gmbh"];

function stripDiacriticsAndPunctuation(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Keeps legal forms (search match target). */
export function normaliseSearch(v: string): string {
  return stripDiacriticsAndPunctuation(v);
}

/** Strips legal forms (duplicate-check match target). */
export function normaliseCore(v: string): string {
  let s = normaliseSearch(v);
  for (const form of LEGAL_FORMS) {
    s = s.replace(new RegExp(`\\b${form}\\b`, "g"), " ");
  }
  return s.trim().replace(/\s+/g, " ");
}
