// Brief 3.4.1: evidence, contract and agreement links.
export type DocLinkCheck = "ok" | "not_https" | "host_not_approved" | "too_long" | "invalid";

export function checkDocLink(v: string, approved: string[]): DocLinkCheck {
  if (v.length > 2048) return "too_long";
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return "invalid";
  }
  if (u.protocol !== "https:") return "not_https";
  return approved.includes(u.hostname.toLowerCase()) ? "ok" : "host_not_approved";
}

/** Brief 3.1.5 `APPROVED_DOC_HOSTS`: comma-separated approved hosts for evidence, contract and agreement links. */
export function approvedDocHosts(): string[] {
  return (process.env.APPROVED_DOC_HOSTS || "docs.corvane-internal.example")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/** Brief 3.4.2 shared error copy for every evidence/contract/agreement link field. */
export function docLinkError(check: DocLinkCheck): string | null {
  switch (check) {
    case "ok":
      return null;
    case "not_https":
    case "invalid":
      return "Enter a link that starts with https://";
    case "host_not_approved":
      return "Use a link to approved document storage";
    case "too_long":
      return "Link must be 2,048 characters or fewer";
  }
}
