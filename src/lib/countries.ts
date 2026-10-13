const displayNames = new Intl.DisplayNames(["en"], { type: "region" });

/** "GB" -> "United Kingdom". Falls back to the code itself when unknown. */
export function countryName(code: string): string {
  try {
    return displayNames.of(code) ?? code;
  } catch {
    return code;
  }
}
