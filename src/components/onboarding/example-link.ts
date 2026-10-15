import { approvedDocHosts } from "@/lib/validation/url";

/** The example link on the approved document host: the Share draft field accepts nothing else. */
export function exampleDraftLink(): string {
  return `https://${approvedDocHosts()[0]}/reports/iss-1042-draft.pdf`;
}
