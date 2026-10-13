import { z } from "zod";

// Brief 3.7.4 "searchParamsSchema". R1 scope only: query, view switch, Country
// and Scheme filters, paging, and the Obligations view's Incident notice
// filter and column sort. Unknown or invalid values are dropped silently.
const isoCountry = z.string().regex(/^[A-Z]{2}$/);
const scheme = z.enum(["EU_VOP", "UK_COP", "GLOBAL_VALIDATION"]);
const view = z.enum(["institutions", "obligations"]);
const osort = z.enum(["sp_desc", "sp_asc", "in_asc", "in_desc"]);

function toArray(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(",").filter(Boolean);
}

export interface ParsedSearchParams {
  q: string;
  view: "institutions" | "obligations";
  countries: string[];
  schemes: ("EU_VOP" | "UK_COP" | "GLOBAL_VALIDATION")[];
  page: number;
  osort: "sp_desc" | "sp_asc" | "in_asc" | "in_desc";
  incMin?: number;
  incMax?: number;
}

export function parseSearchParams(raw: Record<string, string | string[] | undefined>): ParsedSearchParams {
  const get = (key: string): string | undefined => (Array.isArray(raw[key]) ? raw[key]?.[0] : raw[key]);

  const q = get("q")?.slice(0, 200) ?? "";
  const viewResult = view.safeParse(get("view"));
  const pageResult = z.coerce.number().int().min(1).safeParse(get("page"));
  const osortResult = osort.safeParse(get("osort"));
  const incMinResult = z.coerce.number().int().min(0).max(720).safeParse(get("incMin"));
  const incMaxResult = z.coerce.number().int().min(0).max(720).safeParse(get("incMax"));

  const countries = toArray(get("country")).filter((c) => isoCountry.safeParse(c).success);
  const schemes = toArray(get("scheme")).filter((s): s is "EU_VOP" | "UK_COP" | "GLOBAL_VALIDATION" => scheme.safeParse(s).success) as (
    | "EU_VOP"
    | "UK_COP"
    | "GLOBAL_VALIDATION"
  )[];

  return {
    q,
    view: viewResult.success ? viewResult.data : "institutions",
    countries,
    schemes,
    page: pageResult.success ? pageResult.data : 1,
    osort: osortResult.success ? osortResult.data : "sp_desc",
    incMin: incMinResult.success ? incMinResult.data : undefined,
    incMax: incMaxResult.success ? incMaxResult.data : undefined,
  };
}
