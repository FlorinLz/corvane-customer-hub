import "dotenv/config";

import { lookupLei } from "@/server/gleif/client";
import { today, addDays } from "@/lib/dates";

// Brief 7.2.5 pre-demo checklist, step 1. Prints the specific warnings the
// brief calls out, plus any other seeded LEI whose renewal falls inside 90
// days or whose status is no longer ISSUED.
const SCENARIO_LEIS: Record<string, string> = {
  "5493006QMFDDMYWIAM13": "Banco Santander S.A.",
  "PTCQB104N23FMNK2RZ28": "Santander UK plc",
  "549300URJH9VSI58CS32": "Banco Santander Totta, S.A.",
  "549300O0YQXDOJB36Y73": "Santander Consumer Bank S.p.A.",
  "5299000I7Y60A8273788": "Santander Consumer Bank GmbH",
  "549300Z5VU00GHU3B005": "Banco Santander Consumer Portugal S.A.",
  "H7FNTJ4851HG0EXQ1Z70": "Lloyds Bank plc",
  "J4CP7MHCXR8DAQMKIL78": "Banca Monte dei Paschi di Siena S.p.A.",
  "213800QW7QJVVCL9RZ56": "Zopa Bank Limited",
  "2ZCNRR8UK83OBTEK2170": "UniCredit Bank GmbH",
  "724500973ODKK3IFQ447": "Adyen N.V.",
  "213800MQORWPL582SW82": "Revolut Ltd",
  "213800PLUYXGZ8LU7T61": "Monzo Bank Ltd",
};

async function main() {
  const windowEnd = addDays(today(), 90);
  console.log(`Checking GLEIF for ${Object.keys(SCENARIO_LEIS).length} scenario LEIs (today ${today()}, 90-day window ends ${windowEnd})...\n`);

  for (const [lei, name] of Object.entries(SCENARIO_LEIS)) {
    const lookup = await lookupLei(lei);
    if (lookup.kind !== "found") {
      console.warn(`[WARN] ${name} (${lei}): GLEIF lookup returned ${lookup.kind}`);
      continue;
    }
    const { record, source } = lookup;
    const renewal = record.nextRenewalDate;
    const insideWindow = renewal <= windowEnd;
    const notIssued = record.registrationStatus !== "ISSUED";

    if (lei === "549300Z5VU00GHU3B005") {
      console.log(record.registrationStatus === "LAPSED"
        ? `[OK] Banco Santander Consumer Portugal S.A. is still LAPSED.`
        : `[CHANGED] Banco Santander Consumer Portugal S.A. is now ${record.registrationStatus} (was LAPSED). The scbPt Overdue item disappears — have a screenshot ready.`);
    }
    if (lei === "724500973ODKK3IFQ447") {
      console.log(insideWindow
        ? `[CHANGED] Adyen's renewal (${renewal}) is now inside 90 days — its LEI card shows Expiring, a second real expiry example.`
        : `[OK] Adyen's renewal (${renewal}) is still outside 90 days.`);
    }
    // UniCredit Bank GmbH (was BCR's "LEI renewal due" slot): its real renewal
    // (2027-08-02, far outside the 90-day window) doesn't carry that story the
    // way BCR's did — see DECISIONS.md "Rename demo data to international
    // names". No special case; it falls through to the generic [NOTE] branch
    // below like any other entity whose renewal happens to land inside the
    // window.
    if (lei === "5299000I7Y60A8273788") {
      const ok = record.legalName.toLowerCase().includes("santander consumer bank") && record.legalAddressCountry === "AT" && record.ultimateParent?.lei === "5493006QMFDDMYWIAM13";
      console.log(ok
        ? `[OK] Santander Consumer Bank GmbH still returns AT, ultimate parent Banco Santander S.A.`
        : `[CHANGED] Santander Consumer Bank GmbH's GLEIF record changed: ${JSON.stringify(record)}`);
    }
    if (!["549300Z5VU00GHU3B005", "724500973ODKK3IFQ447", "5299000I7Y60A8273788"].includes(lei) && (insideWindow || notIssued)) {
      console.log(`[NOTE] ${name} (${lei}): renewal ${renewal}${notIssued ? `, status ${record.registrationStatus}` : ""} — will land on a worklist bucket.`);
    }
    if (source === "CACHE") console.warn(`[WARN] ${name}: live GLEIF unreachable, answered from the cache (captured ${lookup.fetchedAt}).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
