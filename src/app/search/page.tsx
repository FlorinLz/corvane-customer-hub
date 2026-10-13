import Link from "next/link";
import { ChevronDown, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { countryName } from "@/lib/countries";
import { daysBetween, formatDate, toLocalDate, today } from "@/lib/dates";
import { ENTITY_TYPE_LABELS, SCHEME_ADHERENCE_LABELS, SCHEME_LABELS, TEAM_LABELS } from "@/lib/labels";
import { parseSearchParams, type ParsedSearchParams } from "@/lib/search-params";
import { leiStatusLabel, leiStatusVariant, lifecycleLabel, lifecycleVariant } from "@/lib/ui/status";
import { getFilterCountries, runSearch, PAGE_SIZE, type SearchResultRow } from "@/server/queries/search";
import { runObligationsSearch, PAGE_SIZE as OBLIGATIONS_PAGE_SIZE, type ObligationRow } from "@/server/queries/obligations";

const SCHEMES: { value: "EU_VOP" | "UK_COP" | "GLOBAL_VALIDATION"; short: string; variant: "scheme-eu" | "scheme-uk" | "neutral-outline" }[] = [
  { value: "EU_VOP", short: "EU", variant: "scheme-eu" },
  { value: "UK_COP", short: "UK", variant: "scheme-uk" },
  { value: "GLOBAL_VALIDATION", short: "Global", variant: "neutral-outline" },
];

function buildUrl(params: ParsedSearchParams, overrides: Partial<Record<string, string | number | undefined>> = {}): string {
  const sp = new URLSearchParams();
  const q = overrides.q !== undefined ? String(overrides.q) : params.q;
  const view = overrides.view !== undefined ? String(overrides.view) : params.view;
  const country = overrides.country !== undefined ? String(overrides.country) : params.countries.join(",");
  const scheme = overrides.scheme !== undefined ? String(overrides.scheme) : params.schemes.join(",");
  const page = overrides.page !== undefined ? String(overrides.page) : String(params.page);
  const osort = overrides.osort !== undefined ? String(overrides.osort) : params.osort;

  if (q) sp.set("q", q);
  if (view !== "institutions") sp.set("view", view);
  if (country) sp.set("country", country);
  if (scheme) sp.set("scheme", scheme);
  if (page !== "1") sp.set("page", page);
  if (view === "obligations" && osort !== "sp_desc") sp.set("osort", osort);
  return `/search${sp.toString() ? `?${sp.toString()}` : ""}`;
}

function clearFiltersUrl(params: ParsedSearchParams): string {
  return buildUrl(params, { country: "", scheme: "", page: "1" });
}

function ActiveFilterChips({ params }: { params: ParsedSearchParams }) {
  const chips: { label: string; href: string }[] = [
    ...params.countries.map((c) => ({
      label: `${c} ${countryName(c)}`,
      href: buildUrl(params, { country: params.countries.filter((x) => x !== c).join(","), page: "1" }),
    })),
    ...params.schemes.map((s) => ({
      label: SCHEME_LABELS[s],
      href: buildUrl(params, { scheme: params.schemes.filter((x) => x !== s).join(","), page: "1" }),
    })),
  ];
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <Link key={c.label} href={c.href} className="no-underline">
          <Badge variant="selected" className="gap-1">
            {c.label}
            <X className="size-3" aria-hidden="true" />
          </Badge>
        </Link>
      ))}
    </div>
  );
}

function FilterPanel({ params, countries }: { params: ParsedSearchParams; countries: string[] }) {
  return (
    <aside className="sticky top-4 flex min-w-0 flex-col rounded-md border border-border bg-surface p-3">
      <div className="mb-2 flex items-center">
        <span className="flex-1 text-subsection">Filters</span>
        <Link href={clearFiltersUrl(params)} className="text-meta text-link-text hover:underline">
          Clear filters
        </Link>
      </div>
      <form method="GET" action="/search" className="flex flex-col">
        <input type="hidden" name="q" value={params.q} />
        {params.view !== "institutions" && <input type="hidden" name="view" value={params.view} />}

        <div className="flex flex-col gap-2 border-t border-border py-3">
          <span className="font-medium text-primary">Country</span>
          <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
            {countries.map((c) => (
              <label key={c} className="flex items-center gap-2 text-body">
                <input type="checkbox" name="country" value={c} defaultChecked={params.countries.includes(c)} />
                <span>
                  {c} {countryName(c)}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border py-3">
          <span className="font-medium text-primary">Scheme</span>
          {SCHEMES.map((s) => (
            <label key={s.value} className="flex items-center gap-2 text-body">
              <input type="checkbox" name="scheme" value={s.value} defaultChecked={params.schemes.includes(s.value)} />
              <span className="flex-1">{SCHEME_LABELS[s.value]}</span>
              <Badge variant={s.variant}>{s.short}</Badge>
            </label>
          ))}
        </div>

        <Button type="submit" className="mt-2">
          Apply filters
        </Button>
      </form>
    </aside>
  );
}

function RoleChips({ row }: { row: SearchResultRow }) {
  return (
    <div className="flex flex-wrap gap-1">
      {row.hasCustomerRole && <Badge variant="selected">Customer</Badge>}
      {row.hasPartnerRole && <Badge variant="selected">Network partner</Badge>}
    </div>
  );
}

function MatchReasonChips({ row, filtersActive }: { row: SearchResultRow; filtersActive: boolean }) {
  if (!filtersActive) return null;
  return (
    <div className="flex flex-wrap gap-1 text-meta text-text-secondary">
      {row.prodMatch && <Badge variant="neutral-outline">Customer product</Badge>}
      {row.covMatch && row.coverageChipText && <Badge variant="neutral-outline">Partner coverage: {row.coverageChipText}</Badge>}
    </div>
  );
}

function InstitutionsTable({ rows, filtersActive }: { rows: SearchResultRow[]; filtersActive: boolean }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface">
      <table className="w-full min-w-[900px] text-left text-meta">
        <thead>
          <tr className="border-b border-border text-text-secondary">
            <th className="px-2.5 py-2">Legal name</th>
            <th className="px-2.5 py-2">Type</th>
            <th className="px-2.5 py-2">Country</th>
            <th className="px-2.5 py-2">LEI + status</th>
            <th className="px-2.5 py-2">Roles</th>
            <th className="px-2.5 py-2">Group</th>
            <th className="px-2.5 py-2">Current owner</th>
            <th className="px-2.5 py-2">Lifecycle state</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border align-top last:border-b-0">
              <td className="px-2.5 py-2">
                <Link href={`/entities/${r.id}/overview`} className="font-medium text-link-text hover:underline">
                  {r.legalName}
                </Link>
                {r.matchedAlias && <p className="text-text-secondary">Matched alias: {r.matchedAlias}</p>}
                <MatchReasonChips row={r} filtersActive={filtersActive} />
                {r.noActiveIncidentContact && <Badge variant="danger">No active incident contact</Badge>}
              </td>
              <td className="px-2.5 py-2">{r.type ? ENTITY_TYPE_LABELS[r.type] : "—"}</td>
              <td className="px-2.5 py-2">{r.country ?? "—"}</td>
              <td className="px-2.5 py-2">
                {r.lei ? (
                  <div className="flex flex-col gap-1">
                    <span className="font-mono">{r.lei}</span>
                    {r.leiStatus && <Badge variant={leiStatusVariant(r.leiStatus)}>{leiStatusLabel(r.leiStatus)}</Badge>}
                  </div>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-2.5 py-2">
                <RoleChips row={r} />
              </td>
              <td className="px-2.5 py-2">
                {r.groupId ? (
                  <Link href={`/groups/${r.groupId}`} className="text-link-text hover:underline">
                    {r.groupName}
                  </Link>
                ) : (
                  "Standalone entity"
                )}
              </td>
              <td className="px-2.5 py-2">
                {r.ownerName ? (
                  <span>
                    {r.ownerName}, {r.ownerTeam ? TEAM_LABELS[r.ownerTeam] : ""}
                  </span>
                ) : (
                  <Badge variant="due-outline">No owner</Badge>
                )}
              </td>
              <td className="px-2.5 py-2">
                <Badge variant={lifecycleVariant(r.lifecycleState)}>{lifecycleLabel(r.lifecycleState)}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ObligationsTable({ rows, params }: { rows: ObligationRow[]; params: ParsedSearchParams }) {
  const sortLink = (asc: "in_asc" | "sp_asc", desc: "in_desc" | "sp_desc", current: string) => {
    const next = current === desc ? asc : desc;
    return buildUrl(params, { osort: next });
  };
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface">
      <table className="w-full min-w-[900px] text-left text-meta">
        <thead>
          <tr className="border-b border-border text-text-secondary">
            <th className="px-2.5 py-2">Entity</th>
            <th className="px-2.5 py-2">Country</th>
            <th className="px-2.5 py-2">Role</th>
            <th className="px-2.5 py-2">
              <Link href={sortLink("in_asc", "in_desc", params.osort)} className="flex items-center gap-1 hover:underline">
                Incident notice (h) <ChevronDown className="size-3" aria-hidden="true" />
              </Link>
            </th>
            <th className="px-2.5 py-2">
              <Link href={sortLink("sp_asc", "sp_desc", params.osort)} className="flex items-center gap-1 hover:underline">
                Subprocessor notice (d) <ChevronDown className="size-3" aria-hidden="true" />
              </Link>
            </th>
            <th className="px-2.5 py-2">Audit right</th>
            <th className="px-2.5 py-2">SLA %</th>
            <th className="px-2.5 py-2">EU VoP</th>
            <th className="px-2.5 py-2">UK CoP</th>
            <th className="px-2.5 py-2">Expiry</th>
            <th className="px-2.5 py-2">Contract</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const expiry = r.expiryDate ? toLocalDate(r.expiryDate) : null;
            const expiryDays = expiry ? daysBetween(today(), expiry) : null;
            return (
              <tr key={r.entityId} className="border-b border-border align-top last:border-b-0">
                <td className="px-2.5 py-2">
                  <Link href={`/entities/${r.entityId}/compliance`} className="font-medium text-link-text hover:underline">
                    {r.legalName}
                  </Link>
                </td>
                <td className="px-2.5 py-2">{r.country ?? "—"}</td>
                <td className="px-2.5 py-2">Customer</td>
                <td className="px-2.5 py-2">{r.incidentNoticeHours !== null ? `${r.incidentNoticeHours} h` : "Not captured"}</td>
                <td className="px-2.5 py-2">
                  {r.subprocessorNoticeDays !== null ? (r.subprocessorNoticeDays === 0 ? "No advance notice required" : `${r.subprocessorNoticeDays} d`) : "Not captured"}
                </td>
                <td className="px-2.5 py-2">{r.auditRight !== null ? (r.auditRight ? "Yes" : "No") : "Not captured"}</td>
                <td className="px-2.5 py-2">{r.availabilitySlaPct !== null ? `${r.availabilitySlaPct}%` : "Not captured"}</td>
                <td className="px-2.5 py-2">{r.euVopStatus ? SCHEME_ADHERENCE_LABELS[r.euVopStatus] : "Not captured"}</td>
                <td className="px-2.5 py-2">{r.ukCopStatus ? SCHEME_ADHERENCE_LABELS[r.ukCopStatus] : "Not captured"}</td>
                <td className="px-2.5 py-2">
                  {expiry ? (
                    <div className="flex flex-col gap-1">
                      <span>{formatDate(expiry)}</span>
                      {expiryDays !== null && expiryDays <= 90 && <Badge variant={expiryDays < 0 ? "danger" : "due-outline"}>{expiryDays < 0 ? "Expired" : `Expires in ${expiryDays} days`}</Badge>}
                    </div>
                  ) : (
                    "Not captured"
                  )}
                </td>
                <td className="px-2.5 py-2">
                  {r.contractUrl ? (
                    <a href={r.contractUrl} target="_blank" rel="noreferrer" className="text-link-text hover:underline">
                      Open
                    </a>
                  ) : (
                    "Not captured"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Pager({ page, total, pageSize, params }: { page: number; total: number; pageSize: number; params: ParsedSearchParams }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 border-t border-border py-3">
      <Link href={buildUrl(params, { page: Math.max(1, page - 1) })} className={`rounded-sm px-2 py-1 text-meta ${page <= 1 ? "pointer-events-none text-text-secondary" : "text-link-text hover:underline"}`}>
        Previous
      </Link>
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
        <Link
          key={p}
          href={buildUrl(params, { page: p })}
          className={`inline-flex size-8 items-center justify-center rounded-sm text-meta ${p === page ? "bg-selected font-semibold text-primary" : "text-text"}`}
        >
          {p}
        </Link>
      ))}
      <Link
        href={buildUrl(params, { page: Math.min(pageCount, page + 1) })}
        className={`rounded-sm px-2 py-1 text-meta ${page >= pageCount ? "pointer-events-none text-text-secondary" : "text-link-text hover:underline"}`}
      >
        Next
      </Link>
    </div>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const params = parseSearchParams(raw);
  const filtersActive = params.countries.length > 0 || params.schemes.length > 0;
  const hasAnyQuery = params.q.length >= 2 || filtersActive;

  const countries = await getFilterCountries();

  if (!hasAnyQuery) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-page">Search</h1>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <FilterPanel params={params} countries={countries} />
          <p className="text-body text-text-secondary">Search by name, alias, LEI or BIC, or use filters.</p>
        </div>
      </div>
    );
  }

  if (params.view === "obligations") {
    const { rows, total } = await runObligationsSearch({
      q: params.q,
      countries: params.countries,
      schemes: params.schemes,
      incMin: params.incMin,
      incMax: params.incMax,
      sort: params.osort,
      page: params.page,
    });

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-page">Search</h1>
          <span className="flex-1" />
          <div className="inline-flex overflow-hidden rounded-sm border border-border-strong">
            <Link href={buildUrl(params, { view: "institutions" })} className="px-3.5 py-2 text-meta text-text no-underline">
              Institutions
            </Link>
            <Link href={buildUrl(params, { view: "obligations" })} className="border-l border-border-strong bg-selected px-3.5 py-2 text-meta font-medium text-primary no-underline">
              Obligations
            </Link>
          </div>
        </div>
        <p className="text-body text-text-secondary">
          {params.q ? `Results for '${params.q}' · ` : ""}
          {total} agreement{total === 1 ? "" : "s"}
        </p>
        <ActiveFilterChips params={params} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <FilterPanel params={params} countries={countries} />
          <div className="flex min-w-0 flex-col gap-3">
            {rows.length === 0 ? (
              <p className="text-text-secondary">
                No agreements match these filters. <Link href={clearFiltersUrl(params)} className="text-link-text hover:underline">Clear filters</Link>
              </p>
            ) : (
              <>
                <ObligationsTable rows={rows} params={params} />
                <Pager page={params.page} total={total} pageSize={OBLIGATIONS_PAGE_SIZE} params={params} />
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const { rows, total } = await runSearch({ q: params.q, countries: params.countries, schemes: params.schemes, page: params.page });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-page">Search</h1>
        <span className="flex-1" />
        <div className="inline-flex overflow-hidden rounded-sm border border-border-strong">
          <Link href={buildUrl(params, { view: "institutions" })} className="bg-selected px-3.5 py-2 text-meta font-medium text-primary no-underline">
            Institutions
          </Link>
          <Link href={buildUrl(params, { view: "obligations" })} className="border-l border-border-strong px-3.5 py-2 text-meta text-text no-underline">
            Obligations
          </Link>
        </div>
      </div>
      <p className="text-body text-text-secondary">
        {params.q ? `Results for '${params.q}' · ` : ""}
        {total} institution{total === 1 ? "" : "s"}
      </p>
      <ActiveFilterChips params={params} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <FilterPanel params={params} countries={countries} />
        <div className="flex min-w-0 flex-col gap-3">
          {rows.length === 0 ? (
            <p className="text-text-secondary">
              {params.q ? `No institutions match '${params.q}'.` : "No institutions match these filters."}{" "}
              <Link href={clearFiltersUrl(params)} className="text-link-text hover:underline">
                Clear filters
              </Link>
            </p>
          ) : (
            <>
              <InstitutionsTable rows={rows} filtersActive={filtersActive} />
              <Pager page={params.page} total={total} pageSize={PAGE_SIZE} params={params} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
