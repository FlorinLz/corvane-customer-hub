// Brief 7.1.17.3. Issue team per entity: the Sales person (the creating
// Sales user, or Tom Hadley as fallback for a partner-only record created
// by Adrian Koh), plus the brief's defaults for Ops, Network, Finance and
// Compliance. The customer owner is `Entity.ownerId`, not stored here.
export interface SeedIssueTeamEntry {
  entityKey: string;
  salesUserKey: string;
  opsUserKey: string;
  networkUserKey: string;
  financeUserKey: string;
  complianceUserKey: string;
}

const DEFAULT_OPS = "adrian";
const DEFAULT_NETWORK = "lukas";
const DEFAULT_FINANCE = "rachel";
const DEFAULT_COMPLIANCE = "mei";

function entry(entityKey: string, salesUserKey: string, opsUserKey: string = DEFAULT_OPS): SeedIssueTeamEntry {
  return { entityKey, salesUserKey, opsUserKey, networkUserKey: DEFAULT_NETWORK, financeUserKey: DEFAULT_FINANCE, complianceUserKey: DEFAULT_COMPLIANCE };
}

export const ISSUE_TEAM: SeedIssueTeamEntry[] = [
  entry("revolut", "michael", "kevin"), // Revolut Ltd's named Ops person is Kevin Lim
  entry("mps", "tom"),
  entry("hvb", "tom"),
  entry("santanderUk", "tom"),
  entry("totta", "tom"),
  entry("scbIt", "tom"),
  entry("lloyds", "tom"),
  entry("zopa", "tom"),
  entry("adyen", "tom"),
  entry("scbPt", "michael"),
  entry("monzo", "michael"),
  entry("nordea", "michael"),
  entry("ingdiba", "michael"),
  entry("ceska", "michael"),
  entry("rbi", "michael"),
  entry("lloydsLegacy", "michael"),
  entry("ocbc", "tom"), // partner only, created by Adrian Koh: Sales falls back to Tom Hadley
  entry("boi", "tom"), // partner only, created by Adrian Koh: Sales falls back to Tom Hadley
];
