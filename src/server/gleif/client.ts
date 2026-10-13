import { getCachedRecord, getCacheCapturedAt } from "./cache";

// Brief 3.5.2.
export type GleifParent = { lei: string; legalName: string; country: string };

export type GleifRecord = {
  lei: string;
  legalName: string;
  legalAddressCountry: string;
  headquartersCountry: string;
  registrationStatus: string;
  nextRenewalDate: string;
  entityStatus: string;
  successorLei: string | null;
  directParent: GleifParent | null;
  ultimateParent: GleifParent | null;
};

export type GleifLookup =
  | { kind: "found"; source: "LIVE" | "CACHE"; fetchedAt: string; record: GleifRecord; parentsUnavailable: boolean }
  | { kind: "not_found" }
  | { kind: "unavailable" };

function baseUrl(): string {
  return process.env.GLEIF_BASE_URL || "https://api.gleif.org/api/v1";
}

function timeoutMs(): number {
  return Number(process.env.GLEIF_TIMEOUT_MS || 5000);
}

async function fetchGleif(path: string, signal: AbortSignal): Promise<Response> {
  return fetch(`${baseUrl()}${path}`, { headers: { Accept: "application/vnd.api+json" }, signal });
}

interface GleifApiEntityBody {
  data: {
    id: string;
    attributes: {
      lei: string;
      entity: {
        legalName: { name: string };
        legalAddress: { country: string };
        headquartersAddress: { country: string };
        status: string;
        successorEntity?: { lei: string } | null;
        successorEntities?: { lei: string }[];
      };
      registration: { status: string; nextRenewalDate: string };
    };
  };
}

function mapRecord(body: GleifApiEntityBody): Omit<GleifRecord, "directParent" | "ultimateParent"> {
  const { attributes: a } = body.data;
  return {
    lei: body.data.id,
    legalName: a.entity.legalName.name,
    legalAddressCountry: a.entity.legalAddress.country,
    headquartersCountry: a.entity.headquartersAddress.country,
    registrationStatus: a.registration.status,
    nextRenewalDate: String(a.registration.nextRenewalDate).slice(0, 10),
    entityStatus: a.entity.status,
    successorLei: a.entity.successorEntity?.lei ?? a.entity.successorEntities?.[0]?.lei ?? null,
  };
}

function mapParent(body: GleifApiEntityBody): GleifParent {
  const { attributes: a } = body.data;
  return {
    lei: body.data.id,
    legalName: a.entity.legalName.name,
    country: a.entity.headquartersAddress.country,
  };
}

async function resolveParent(
  settled: PromiseSettledResult<Response>,
  which: "directParent" | "ultimateParent",
  lei: string,
): Promise<{ parent: GleifParent | null; unavailable: boolean }> {
  if (settled.status === "fulfilled") {
    if (settled.value.status === 404) return { parent: null, unavailable: false };
    if (settled.value.ok) {
      const body = (await settled.value.json()) as GleifApiEntityBody;
      return { parent: mapParent(body), unavailable: false };
    }
  }
  const cached = getCachedRecord(lei);
  if (cached) return { parent: cached[which], unavailable: false };
  return { parent: null, unavailable: true };
}

/** Brief 3.5.2 decision flow. */
export async function lookupLei(lei: string): Promise<GleifLookup> {
  if (process.env.GLEIF_FORCE_CACHE === "true") {
    const record = getCachedRecord(lei);
    if (!record) return { kind: "unavailable" };
    return { kind: "found", source: "CACHE", fetchedAt: getCacheCapturedAt(), record, parentsUnavailable: false };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const [recordRes, directRes, ultimateRes] = await Promise.allSettled([
      fetchGleif(`/lei-records/${lei}`, controller.signal),
      fetchGleif(`/lei-records/${lei}/direct-parent`, controller.signal),
      fetchGleif(`/lei-records/${lei}/ultimate-parent`, controller.signal),
    ]);

    if (recordRes.status === "fulfilled" && recordRes.value.status === 404) {
      return { kind: "not_found" }; // a live 404 is authoritative; the cache is not consulted
    }

    if (recordRes.status === "fulfilled" && recordRes.value.ok) {
      const body = (await recordRes.value.json()) as GleifApiEntityBody;
      const base = mapRecord(body);
      const [direct, ultimate] = await Promise.all([
        resolveParent(directRes, "directParent", lei),
        resolveParent(ultimateRes, "ultimateParent", lei),
      ]);
      return {
        kind: "found",
        source: "LIVE",
        fetchedAt: new Date().toISOString(),
        record: { ...base, directParent: direct.parent, ultimateParent: ultimate.parent },
        parentsUnavailable: direct.unavailable || ultimate.unavailable,
      };
    }

    // Record call timed out, network error, or returned 429/5xx.
    const cached = getCachedRecord(lei);
    if (cached) {
      return { kind: "found", source: "CACHE", fetchedAt: getCacheCapturedAt(), record: cached, parentsUnavailable: false };
    }
    return { kind: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}
