import { NotFoundError } from "@/server/errors";
import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { loadIssueReportContext } from "@/server/queries/issue-report-context";
import { COUNTRIES } from "@/server/config";

// Brief 3.8.3 "GET /api/entities/{id}/issue-context", M17 AC2, AC7-AC9.
// On-demand (the report drawer fetches this only when it opens, from
// whichever page it opens on), unlike the Issue page's own data, which
// loads through a server-component query loader at render time.
export const GET = handle("entity.issueContext", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await getCurrentUser(); // every active user of the 6 teams; no team-specific gate
  const context = await loadIssueReportContext(id);
  if (!context) throw new NotFoundError();
  return {
    customerRoleActive: context.customerRoleActive,
    isPartnerOnly: context.isPartnerOnly,
    productLines: context.productLines,
    contacts: context.contacts,
    coverageRows: context.coverageRows,
    partnerCoverages: context.partnerCoverages,
    registeredCountry: context.registeredCountry,
    countries: COUNTRIES,
  };
});
