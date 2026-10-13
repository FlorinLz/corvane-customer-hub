import { handle } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import { runSearch } from "@/server/queries/search";

// The "Affected entity" search of the Report issue drawer opened from Home: the same search as the top bar (name, alias, LEI or BIC),
// first page only, every active user (the same permission as the top bar's search page).
export const GET = handle("entity.searchForReport", async (req: Request) => {
  await getCurrentUser();
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 200);
  if (q.trim().length < 2) return [];
  const { rows } = await runSearch({ q, countries: [], schemes: [], page: 1 });
  return rows.slice(0, 8).map((r) => ({
    id: r.id,
    legalName: r.legalName,
    matchedAlias: r.matchedAlias,
    country: r.country,
    role: r.hasCustomerRole && r.hasPartnerRole ? "Both" : r.hasPartnerRole ? "Partner" : "Customer",
  }));
});
