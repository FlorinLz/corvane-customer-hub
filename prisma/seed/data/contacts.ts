// Brief 7.1.8. Owning team is derived from (context, role) at seed time,
// same as M15 AC4. Phones are E.164. Emails: <first>.<last>@<slug>.example.
export interface SeedContact {
  entity: string;
  slug: string;
  context: "CUSTOMER" | "PARTNER";
  role: "CHAMPION" | "DECISION_MAKER" | "TECHNICAL" | "INCIDENT" | "ESCALATION" | "BILLING";
  fullName: string;
  jobTitle: string;
  phone: string | null;
  timeZone: string | null;
  available24x7: boolean;
  availabilityDays: number[]; // ISO weekday 1=Mon..7=Sun
  availabilityStart: string | null;
  availabilityEnd: string | null;
  isPrimary: boolean;
  left?: { offset: number; note: string };
  verifiedOffset: number | null; // null = never verified
  verifiedBy: string | null; // user key
}

function email(fullName: string, slug: string): string {
  const [first, ...rest] = fullName.toLowerCase().split(" ");
  const last = rest.join("-").replace(/[^a-z-]/g, "");
  const firstClean = first.replace(/[^a-z-]/g, "");
  return `${firstClean}.${last}@${slug}.example`;
}

const WEEKDAYS = [1, 2, 3, 4, 5];
const NONE = { available24x7: false, availabilityDays: [], availabilityStart: null, availabilityEnd: null };
const ALL_DAY = { available24x7: true, availabilityDays: [], availabilityStart: null, availabilityEnd: null };
const mf = (start: string, end: string) => ({ available24x7: false, availabilityDays: WEEKDAYS, availabilityStart: start, availabilityEnd: end });

interface Row {
  entity: string; slug: string; context: "CUSTOMER" | "PARTNER";
  role: SeedContact["role"]; fullName: string; jobTitle: string;
  phone?: string; timeZone?: string;
  availability?: { available24x7: boolean; availabilityDays: number[]; availabilityStart: string | null; availabilityEnd: string | null };
  isPrimary?: boolean; left?: { offset: number; note: string };
  verifiedOffset: number | null; verifiedBy: string | null;
}

const ROWS: Row[] = [
  { entity: "santanderUk", slug: "santander-uk", context: "CUSTOMER", role: "CHAMPION", fullName: "Oliver Bennett", jobTitle: "Head of Payments Innovation", left: { offset: -12, note: "Moved to another bank" }, verifiedOffset: -200, verifiedBy: "tom" },
  { entity: "santanderUk", slug: "santander-uk", context: "CUSTOMER", role: "TECHNICAL", fullName: "Grace Turner", jobTitle: "Integration Lead", phone: "+447700900210", timeZone: "Europe/London", verifiedOffset: -150, verifiedBy: "adrian" },
  { entity: "santanderUk", slug: "santander-uk", context: "CUSTOMER", role: "INCIDENT", fullName: "Daniel Price", jobTitle: "Payments Operations Manager", phone: "+447700900211", timeZone: "Europe/London", availability: ALL_DAY, verifiedOffset: -150, verifiedBy: "adrian" },

  { entity: "totta", slug: "santander-totta", context: "CUSTOMER", role: "CHAMPION", fullName: "Inês Carvalho", jobTitle: "Head of Digital Payments", verifiedOffset: -60, verifiedBy: "tom" },
  { entity: "totta", slug: "santander-totta", context: "CUSTOMER", role: "TECHNICAL", fullName: "Rui Almeida", jobTitle: "Integration Engineer", phone: "+351912345010", timeZone: "Europe/Lisbon", verifiedOffset: -35, verifiedBy: "adrian" },
  { entity: "totta", slug: "santander-totta", context: "CUSTOMER", role: "INCIDENT", fullName: "Marta Sousa", jobTitle: "Operations Lead", phone: "+351912345011", timeZone: "Europe/Lisbon", availability: ALL_DAY, verifiedOffset: -35, verifiedBy: "adrian" },
  { entity: "totta", slug: "santander-totta", context: "PARTNER", role: "TECHNICAL", fullName: "João Ferreira", jobTitle: "Network Integration Lead", phone: "+351912345012", timeZone: "Europe/Lisbon", verifiedOffset: -120, verifiedBy: "lukas" },
  { entity: "totta", slug: "santander-totta", context: "PARTNER", role: "INCIDENT", fullName: "Pedro Matos", jobTitle: "Service Desk Manager", phone: "+351912345013", timeZone: "Europe/Lisbon", availability: mf("08:00", "20:00"), isPrimary: true, verifiedOffset: -30, verifiedBy: "lukas" },
  { entity: "totta", slug: "santander-totta", context: "PARTNER", role: "BILLING", fullName: "Sofia Ribeiro", jobTitle: "Accounts Payable", verifiedOffset: -204, verifiedBy: "rachel" },

  { entity: "scbIt", slug: "scb-it", context: "CUSTOMER", role: "CHAMPION", fullName: "Federica Rinaldi", jobTitle: "Head of Payments", verifiedOffset: -40, verifiedBy: "emma" },
  { entity: "scbIt", slug: "scb-it", context: "CUSTOMER", role: "TECHNICAL", fullName: "Marco Bellini", jobTitle: "IT Architect", phone: "+393401234510", timeZone: "Europe/Rome", verifiedOffset: -50, verifiedBy: "adrian" },
  { entity: "scbIt", slug: "scb-it", context: "CUSTOMER", role: "INCIDENT", fullName: "Chiara Russo", jobTitle: "Operations Manager", phone: "+393401234511", timeZone: "Europe/Rome", availability: ALL_DAY, verifiedOffset: -50, verifiedBy: "adrian" },

  { entity: "scbPt", slug: "scb-pt", context: "CUSTOMER", role: "CHAMPION", fullName: "Tiago Moreira", jobTitle: "Head of Operations", verifiedOffset: -3, verifiedBy: "michael" },

  { entity: "lloyds", slug: "lloyds", context: "CUSTOMER", role: "CHAMPION", fullName: "James Holloway", jobTitle: "Director, Payments Partnerships", verifiedOffset: -30, verifiedBy: "tom" },
  { entity: "lloyds", slug: "lloyds", context: "CUSTOMER", role: "INCIDENT", fullName: "Ruth Okafor", jobTitle: "Payments Incident Manager", phone: "+447700900301", timeZone: "Europe/London", availability: ALL_DAY, verifiedOffset: -25, verifiedBy: "adrian" },
  { entity: "lloyds", slug: "lloyds", context: "PARTNER", role: "INCIDENT", fullName: "Paul Grant", jobTitle: "Head of CoP Service Operations", phone: "+447700900123", timeZone: "Europe/London", availability: ALL_DAY, isPrimary: true, verifiedOffset: -20, verifiedBy: "lukas" },
  { entity: "lloyds", slug: "lloyds", context: "PARTNER", role: "INCIDENT", fullName: "Marta Kovacs", jobTitle: "Payments Operations", phone: "+447700900124", timeZone: "Europe/London", availability: mf("09:00", "17:00"), isPrimary: false, verifiedOffset: -200, verifiedBy: "lukas" },
  { entity: "lloyds", slug: "lloyds", context: "PARTNER", role: "ESCALATION", fullName: "Sarah Whitfield", jobTitle: "Head of Network Operations", phone: "+447700900125", timeZone: "Europe/London", availability: mf("08:00", "20:00"), verifiedOffset: -20, verifiedBy: "lukas" },

  { entity: "mps", slug: "mps", context: "CUSTOMER", role: "CHAMPION", fullName: "Giulia Ferri", jobTitle: "Head of Transaction Banking", verifiedOffset: -30, verifiedBy: "emma" },
  { entity: "mps", slug: "mps", context: "CUSTOMER", role: "DECISION_MAKER", fullName: "Lorenzo Conti", jobTitle: "Chief Operating Officer", verifiedOffset: -30, verifiedBy: "emma" },
  { entity: "mps", slug: "mps", context: "CUSTOMER", role: "TECHNICAL", fullName: "Paolo Greco", jobTitle: "Integration Lead", phone: "+393351234510", timeZone: "Europe/Rome", verifiedOffset: -60, verifiedBy: "adrian" },
  { entity: "mps", slug: "mps", context: "CUSTOMER", role: "INCIDENT", fullName: "Silvia Moretti", jobTitle: "Payments Operations Manager", phone: "+393351234511", timeZone: "Europe/Rome", availability: ALL_DAY, verifiedOffset: -60, verifiedBy: "adrian" },

  { entity: "zopa", slug: "zopa", context: "CUSTOMER", role: "CHAMPION", fullName: "Amelia Hughes", jobTitle: "Head of Payments", verifiedOffset: -58, verifiedBy: "tom" },
  { entity: "zopa", slug: "zopa", context: "CUSTOMER", role: "TECHNICAL", fullName: "Ben Carter", jobTitle: "Platform Engineer", phone: "+447700900401", timeZone: "Europe/London", verifiedOffset: -15, verifiedBy: "kevin" },
  { entity: "zopa", slug: "zopa", context: "CUSTOMER", role: "INCIDENT", fullName: "Chloe Evans", jobTitle: "Operations Lead", phone: "+447700900402", timeZone: "Europe/London", availability: ALL_DAY, verifiedOffset: -15, verifiedBy: "kevin" },

  { entity: "hvb", slug: "hvb", context: "CUSTOMER", role: "CHAMPION", fullName: "Claudia Schulz", jobTitle: "Head of Payments", verifiedOffset: -90, verifiedBy: "leo" },
  { entity: "hvb", slug: "hvb", context: "CUSTOMER", role: "TECHNICAL", fullName: "Tobias Klein", jobTitle: "IT Integration Lead", phone: "+491511234010", timeZone: "Europe/Berlin", verifiedOffset: -300, verifiedBy: "adrian" },
  { entity: "hvb", slug: "hvb", context: "CUSTOMER", role: "INCIDENT", fullName: "Markus Wolf", jobTitle: "Operations Manager", phone: "+491511234011", timeZone: "Europe/Berlin", availability: ALL_DAY, verifiedOffset: -300, verifiedBy: "adrian" },

  { entity: "adyen", slug: "adyen", context: "CUSTOMER", role: "CHAMPION", fullName: "Sanne de Vries", jobTitle: "Head of Partnerships", verifiedOffset: -60, verifiedBy: "leo" },
  { entity: "adyen", slug: "adyen", context: "CUSTOMER", role: "TECHNICAL", fullName: "Joris Bakker", jobTitle: "CTO Office", phone: "+31612345610", timeZone: "Europe/Amsterdam", verifiedOffset: -200, verifiedBy: "kevin" },
  { entity: "adyen", slug: "adyen", context: "CUSTOMER", role: "INCIDENT", fullName: "Daan Visser", jobTitle: "Operations Lead", phone: "+31612345611", timeZone: "Europe/Amsterdam", availability: ALL_DAY, verifiedOffset: -200, verifiedBy: "kevin" },
  { entity: "adyen", slug: "adyen", context: "PARTNER", role: "INCIDENT", fullName: "Lotte Jansen", jobTitle: "Service Desk Lead", phone: "+31623456710", timeZone: "Europe/Amsterdam", availability: ALL_DAY, isPrimary: true, verifiedOffset: -15, verifiedBy: "lukas" },
  { entity: "adyen", slug: "adyen", context: "PARTNER", role: "ESCALATION", fullName: "Eva Smit", jobTitle: "Head of Operations", phone: "+31634567810", timeZone: "Europe/Amsterdam", availability: mf("09:00", "18:00"), verifiedOffset: null, verifiedBy: null },

  { entity: "revolut", slug: "revolut", context: "CUSTOMER", role: "CHAMPION", fullName: "Hannah Clarke", jobTitle: "Head of Payment Partnerships", verifiedOffset: -90, verifiedBy: "michael" },
  { entity: "revolut", slug: "revolut", context: "CUSTOMER", role: "TECHNICAL", fullName: "Oskar Lindqvist", jobTitle: "Senior Integration Engineer", phone: "+447700900450", timeZone: "Europe/London", verifiedOffset: -30, verifiedBy: "adrian" },
  { entity: "revolut", slug: "revolut", context: "CUSTOMER", role: "INCIDENT", fullName: "Priya Nair", jobTitle: "Payments Incident Lead", phone: "+447700900456", timeZone: "Europe/London", availability: ALL_DAY, verifiedOffset: -30, verifiedBy: "adrian" },
  { entity: "revolut", slug: "revolut", context: "CUSTOMER", role: "BILLING", fullName: "Ella Morgan", jobTitle: "Finance Operations", verifiedOffset: -60, verifiedBy: "rachel" },

  { entity: "monzo", slug: "monzo", context: "CUSTOMER", role: "CHAMPION", fullName: "Jack Robinson", jobTitle: "Head of Payments", verifiedOffset: -30, verifiedBy: "michael" },
  { entity: "monzo", slug: "monzo", context: "CUSTOMER", role: "TECHNICAL", fullName: "Harriet Cole", jobTitle: "Platform Engineer", phone: "+447700900501", timeZone: "Europe/London", verifiedOffset: -9, verifiedBy: "kevin" },
  { entity: "monzo", slug: "monzo", context: "CUSTOMER", role: "INCIDENT", fullName: "Isla Wright", jobTitle: "Operations Lead", phone: "+447700900502", timeZone: "Europe/London", availability: ALL_DAY, verifiedOffset: -9, verifiedBy: "kevin" },

  { entity: "nordea", slug: "nordea", context: "CUSTOMER", role: "CHAMPION", fullName: "Aino Virtanen", jobTitle: "Head of Payments", verifiedOffset: -150, verifiedBy: "sophie" },
  { entity: "nordea", slug: "nordea", context: "CUSTOMER", role: "TECHNICAL", fullName: "Mikko Laine", jobTitle: "Integration Lead", phone: "+358401234510", timeZone: "Europe/Helsinki", verifiedOffset: -220, verifiedBy: "adrian" },
  { entity: "nordea", slug: "nordea", context: "CUSTOMER", role: "INCIDENT", fullName: "Juha Nieminen", jobTitle: "Operations Manager", phone: "+358401234511", timeZone: "Europe/Helsinki", availability: ALL_DAY, verifiedOffset: -220, verifiedBy: "adrian" },

  { entity: "ingdiba", slug: "ing-diba", context: "CUSTOMER", role: "CHAMPION", fullName: "Lena Fischer", jobTitle: "Head of Payments", verifiedOffset: -120, verifiedBy: "ethan" },
  { entity: "ingdiba", slug: "ing-diba", context: "CUSTOMER", role: "TECHNICAL", fullName: "Felix Wagner", jobTitle: "Integration Engineer", phone: "+491711234510", timeZone: "Europe/Berlin", verifiedOffset: -180, verifiedBy: "adrian" },
  { entity: "ingdiba", slug: "ing-diba", context: "CUSTOMER", role: "INCIDENT", fullName: "Max Hoffmann", jobTitle: "Operations Lead", phone: "+491711234511", timeZone: "Europe/Berlin", availability: ALL_DAY, verifiedOffset: -180, verifiedBy: "adrian" },
  { entity: "ingdiba", slug: "ing-diba", context: "PARTNER", role: "INCIDENT", fullName: "Jonas Weber", jobTitle: "Network Operations", phone: "+491711234512", timeZone: "Europe/Berlin", availability: ALL_DAY, isPrimary: true, verifiedOffset: -10, verifiedBy: "nora" },

  { entity: "ocbc", slug: "ocbc", context: "PARTNER", role: "INCIDENT", fullName: "Wei Ling Tan", jobTitle: "Payments Operations", phone: "+6591234510", timeZone: "Asia/Singapore", availability: mf("09:00", "18:00"), isPrimary: true, verifiedOffset: -30, verifiedBy: "lukas" },
  { entity: "ocbc", slug: "ocbc", context: "PARTNER", role: "ESCALATION", fullName: "Rajesh Kumar", jobTitle: "Head of Operations", phone: "+6591234511", timeZone: "Asia/Singapore", availability: mf("08:00", "20:00"), verifiedOffset: -30, verifiedBy: "lukas" },

  { entity: "boi", slug: "boi", context: "PARTNER", role: "INCIDENT", fullName: "Ciaran Walsh", jobTitle: "Service Operations", phone: "+353871234510", timeZone: "Europe/Dublin", availability: ALL_DAY, isPrimary: true, verifiedOffset: -40, verifiedBy: "lukas" },

  { entity: "ceska", slug: "csas", context: "CUSTOMER", role: "CHAMPION", fullName: "Petra Novotná", jobTitle: "Head of Payments", verifiedOffset: -10, verifiedBy: "michael" },
  { entity: "ceska", slug: "csas", context: "CUSTOMER", role: "TECHNICAL", fullName: "Jan Dvořák", jobTitle: "Integration Lead", phone: "+420601234510", timeZone: "Europe/Prague", verifiedOffset: -5, verifiedBy: "kevin" },
  { entity: "ceska", slug: "csas", context: "CUSTOMER", role: "INCIDENT", fullName: "Tomáš Svoboda", jobTitle: "Operations Manager", phone: "+420601234511", timeZone: "Europe/Prague", availability: ALL_DAY, verifiedOffset: -5, verifiedBy: "kevin" },

  { entity: "rbi", slug: "rbi", context: "CUSTOMER", role: "CHAMPION", fullName: "Katrin Bauer", jobTitle: "Head of Payments", verifiedOffset: -400, verifiedBy: "sophie" },
];

export const CONTACTS: SeedContact[] = ROWS.map((r) => {
  const avail = r.availability ?? NONE;
  return {
    entity: r.entity,
    slug: r.slug,
    context: r.context,
    role: r.role,
    fullName: r.fullName,
    jobTitle: r.jobTitle,
    phone: r.phone ?? null,
    timeZone: r.timeZone ?? null,
    available24x7: avail.available24x7,
    availabilityDays: avail.availabilityDays,
    availabilityStart: avail.availabilityStart,
    availabilityEnd: avail.availabilityEnd,
    isPrimary: r.isPrimary ?? false,
    left: r.left,
    verifiedOffset: r.verifiedOffset,
    verifiedBy: r.verifiedBy,
  };
});

export { email as contactEmail };
