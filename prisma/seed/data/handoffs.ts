// Brief 7.1.9. Snapshots are built from the entity's actual state at send
// time (seed.ts), rather than hand-duplicated here, except for the few
// pieces of free text the brief calls out explicitly (commitments, notes).
export interface SeedHandoffLeg {
  type: "SALES_TO_OPS" | "OPS_TO_CS";
  from: string; // user key
  to: string; // user key
  sentOffset: number;
  sentTime?: string; // default "10:00"
  status: "SENT" | "CONFIRMED" | "ACCEPTED" | "DECLINED";
  closedOffset?: number; // confirmed/accepted/declined date
  declineReason?: string;
  commitments?: { description: string; dueOffset: number | null }[];
  noOpenCommitments?: boolean;
  noteForCsm?: string;
  blockHandoffNote?: string; // for products that were blocked at send time
}

export interface SeedHandoff {
  entity: string;
  legs: SeedHandoffLeg[];
}

export const HANDOFFS: SeedHandoff[] = [
  { entity: "lloyds", legs: [{ type: "SALES_TO_OPS", from: "tom", to: "adrian", sentOffset: -400, status: "CONFIRMED", closedOffset: -399 }] },
  { entity: "mps", legs: [
    { type: "SALES_TO_OPS", from: "tom", to: "adrian", sentOffset: -380, status: "CONFIRMED", closedOffset: -378 },
    { type: "OPS_TO_CS", from: "adrian", to: "emma", sentOffset: -152, status: "ACCEPTED", closedOffset: -150, commitments: [{ description: "Monthly service report until full DE volume", dueOffset: null }] },
  ] },
  { entity: "hvb", legs: [
    { type: "SALES_TO_OPS", from: "tom", to: "adrian", sentOffset: -500, status: "CONFIRMED", closedOffset: -499 },
    { type: "OPS_TO_CS", from: "adrian", to: "leo", sentOffset: -302, status: "ACCEPTED", closedOffset: -300, noOpenCommitments: true },
  ] },
  { entity: "adyen", legs: [
    { type: "SALES_TO_OPS", from: "tom", to: "kevin", sentOffset: -720, status: "CONFIRMED", closedOffset: -719 },
    { type: "OPS_TO_CS", from: "kevin", to: "leo", sentOffset: -202, status: "ACCEPTED", closedOffset: -200 },
  ] },
  { entity: "santanderUk", legs: [
    { type: "SALES_TO_OPS", from: "tom", to: "adrian", sentOffset: -262, status: "CONFIRMED", closedOffset: -261 },
    { type: "OPS_TO_CS", from: "adrian", to: "sophie", sentOffset: -142, status: "ACCEPTED", closedOffset: -140 },
  ] },
  { entity: "totta", legs: [
    { type: "SALES_TO_OPS", from: "tom", to: "adrian", sentOffset: -257, status: "CONFIRMED", closedOffset: -255 },
    {
      type: "OPS_TO_CS", from: "adrian", to: "sophie", sentOffset: -6, status: "DECLINED", closedOffset: -4,
      declineReason: "Portuguese accounts sit with Ethan Brooks from October",
      commitments: [{ description: "Confirm FR sandbox credentials", dueOffset: 14 }],
    },
  ] },
  { entity: "scbIt", legs: [
    { type: "SALES_TO_OPS", from: "tom", to: "adrian", sentOffset: -237, status: "CONFIRMED", closedOffset: -236 },
    { type: "OPS_TO_CS", from: "adrian", to: "emma", sentOffset: -47, status: "ACCEPTED", closedOffset: -45 },
  ] },
  { entity: "scbPt", legs: [
    { type: "SALES_TO_OPS", from: "michael", to: "kevin", sentOffset: -3, sentTime: "09:30", status: "SENT" },
  ] },
  { entity: "revolut", legs: [{ type: "SALES_TO_OPS", from: "michael", to: "adrian", sentOffset: -200, status: "CONFIRMED", closedOffset: -199 }] },
  { entity: "zopa", legs: [{ type: "SALES_TO_OPS", from: "tom", to: "kevin", sentOffset: -60, status: "CONFIRMED", closedOffset: -58 }] },
  { entity: "monzo", legs: [{ type: "SALES_TO_OPS", from: "michael", to: "kevin", sentOffset: -30, status: "CONFIRMED", closedOffset: -29 }] },
  { entity: "ceska", legs: [{ type: "SALES_TO_OPS", from: "michael", to: "kevin", sentOffset: -10, status: "CONFIRMED", closedOffset: -9 }] },
  { entity: "nordea", legs: [
    { type: "SALES_TO_OPS", from: "michael", to: "adrian", sentOffset: -262, status: "CONFIRMED", closedOffset: -261 },
    { type: "OPS_TO_CS", from: "adrian", to: "sophie", sentOffset: -152, status: "ACCEPTED", closedOffset: -150 },
  ] },
  { entity: "ingdiba", legs: [
    { type: "SALES_TO_OPS", from: "michael", to: "adrian", sentOffset: -225, status: "CONFIRMED", closedOffset: -224 },
    { type: "OPS_TO_CS", from: "adrian", to: "ethan", sentOffset: -122, status: "ACCEPTED", closedOffset: -120 },
  ] },
  { entity: "rbi", legs: [
    { type: "SALES_TO_OPS", from: "michael", to: "adrian", sentOffset: -600, status: "CONFIRMED", closedOffset: -599 },
    { type: "OPS_TO_CS", from: "adrian", to: "sophie", sentOffset: -402, status: "ACCEPTED", closedOffset: -400 },
  ] },
];

// Brief 7.1.10. Every other owner change comes from the handoffs above.
export interface SeedOwnerAssignment {
  entity: string;
  from: string; // user key
  to: string; // user key
  by: string; // user key
  offset: number;
  time?: string;
  reason: string;
  acknowledgedOffset: number | null; // null = not acknowledged (Home badge)
}

export const OWNER_ASSIGNMENTS: SeedOwnerAssignment[] = [
  { entity: "hvb", from: "leo", to: "emma", by: "leo", offset: -1, time: "17:10", reason: "Rebalancing German accounts before Q4", acknowledgedOffset: null },
  { entity: "monzo", from: "kevin", to: "ethan", by: "emma", offset: -20, reason: "CS owns UK fintech accounts from kickoff", acknowledgedOffset: -19 },
];
