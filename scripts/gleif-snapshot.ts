import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";

import type { GleifRecord } from "@/server/gleif/client";

// Brief 3.5.6 / 7.2.4. Rewrites data/gleif-cache.json from the live API for
// the fixed demo LEI list (the cache's own keys), without touching the
// frozen E2E fixture at tests/e2e/fixtures/gleif-cache.json.
const BASE_URL = process.env.GLEIF_BASE_URL || "https://api.gleif.org/api/v1";
const CACHE_PATH = process.env.GLEIF_CACHE_PATH || "data/gleif-cache.json";

interface ApiBody {
  data: {
    id: string;
    attributes: {
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

async function fetchLei(lei: string): Promise<GleifRecord | null> {
  const headers = { Accept: "application/vnd.api+json" };
  const recordRes = await fetch(`${BASE_URL}/lei-records/${lei}`, { headers });
  if (!recordRes.ok) return null;
  const record = (await recordRes.json()) as ApiBody;
  const a = record.data.attributes;

  async function fetchParent(path: string) {
    const res = await fetch(`${BASE_URL}/lei-records/${lei}/${path}`, { headers });
    if (res.status === 404 || !res.ok) return null;
    const body = (await res.json()) as ApiBody;
    return { lei: body.data.id, legalName: body.data.attributes.entity.legalName.name, country: body.data.attributes.entity.headquartersAddress.country };
  }

  const [directParent, ultimateParent] = await Promise.all([fetchParent("direct-parent"), fetchParent("ultimate-parent")]);

  return {
    lei: record.data.id,
    legalName: a.entity.legalName.name,
    legalAddressCountry: a.entity.legalAddress.country,
    headquartersCountry: a.entity.headquartersAddress.country,
    registrationStatus: a.registration.status,
    nextRenewalDate: String(a.registration.nextRenewalDate).slice(0, 10),
    entityStatus: a.entity.status,
    successorLei: a.entity.successorEntity?.lei ?? a.entity.successorEntities?.[0]?.lei ?? null,
    directParent,
    ultimateParent,
  };
}

async function main() {
  const existing = JSON.parse(readFileSync(CACHE_PATH, "utf-8")) as { records: Record<string, GleifRecord> };
  const leis = Object.keys(existing.records);
  const records: Record<string, GleifRecord> = {};
  for (const lei of leis) {
    console.log(`Fetching ${lei}...`);
    const record = await fetchLei(lei);
    if (record) records[lei] = record;
    else console.warn(`  no live record for ${lei}, keeping the cached one`);
  }
  const merged = { ...existing.records, ...records };
  writeFileSync(CACHE_PATH, JSON.stringify({ capturedAt: new Date().toISOString(), source: BASE_URL, records: merged }, null, 2) + "\n");
  console.log(`Wrote ${Object.keys(merged).length} records to ${CACHE_PATH}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
