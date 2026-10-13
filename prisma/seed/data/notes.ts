// Brief 7.1.14. Notes and their action items. Contact participants are
// resolved at seed time by (entity, fullName) against the created Contact
// rows.
export interface SeedActionItem {
  description: string;
  owner: string; // user key
  dueOffset: number;
  status: "OPEN" | "DONE";
  doneOffset?: number; // when status is DONE
}

export interface SeedNote {
  entity: string;
  type: "CALL" | "QBR" | "NEGOTIATION" | "INCIDENT" | "PAYMENT" | "OTHER";
  author: string; // user key
  interactionOffset: number;
  participantUsers: string[]; // user keys
  participantContacts: string[]; // contact full names (resolved against `entity`)
  summary: string;
  actionItems: SeedActionItem[];
}

export const NOTES: SeedNote[] = [
  {
    entity: "mps", type: "NEGOTIATION", author: "tom", interactionOffset: -400,
    participantUsers: ["tom"], participantContacts: ["Lorenzo Conti", "Giulia Ferri"],
    summary: "Agreed EUR pricing with two volume tiers and a 60-day payment term. MPS asked for a monthly service report.",
    actionItems: [{ description: "Send final tier proposal", owner: "tom", dueOffset: -395, status: "DONE", doneOffset: -396 }],
  },
  {
    entity: "mps", type: "INCIDENT", author: "lukas", interactionOffset: -45,
    participantUsers: ["lukas", "emma"], participantContacts: ["Silvia Moretti"],
    summary: "Partner slowdown on Global validation DE for 40 minutes. MPS saw delayed responses. Service restored, root cause on the partner side.",
    actionItems: [],
  },
  {
    entity: "mps", type: "CALL", author: "emma", interactionOffset: -20,
    participantUsers: ["emma"], participantContacts: ["Giulia Ferri"],
    summary: "Check-in on DE ramp-up. Volumes growing slowly. Giulia asked for a QBR before the renewal.",
    actionItems: [{ description: "Schedule QBR", owner: "emma", dueOffset: -10, status: "DONE", doneOffset: -12 }],
  },
  {
    entity: "mps", type: "PAYMENT", author: "rachel", interactionOffset: -12,
    participantUsers: ["rachel"], participantContacts: [],
    summary: "Q3 invoice paid 18 days late, PO number missing",
    actionItems: [{ description: "Confirm PO number for Q4 invoice", owner: "rachel", dueOffset: -3, status: "OPEN" }],
  },
  {
    entity: "lloyds", type: "NEGOTIATION", author: "tom", interactionOffset: -30,
    participantUsers: ["tom", "emma"], participantContacts: ["James Holloway"],
    summary: "Lloyds asked to revisit the second volume tier after the CoP volume forecast went up.",
    actionItems: [{ description: "Send revised volume tiers", owner: "tom", dueOffset: 14, status: "OPEN" }],
  },
  {
    entity: "lloyds", type: "INCIDENT", author: "lukas", interactionOffset: -20,
    participantUsers: ["lukas"], participantContacts: [],
    summary: "Marta Kovacs moved to Payments Operations. Paul Grant is now the primary incident contact for CoP.",
    actionItems: [],
  },
  {
    entity: "adyen", type: "QBR", author: "leo", interactionOffset: -150,
    participantUsers: ["leo"], participantContacts: ["Sanne de Vries"],
    summary: "Reviewed Global validation volumes in NL. Adyen plans EU VoP as a partner later this year.",
    actionItems: [],
  },
  {
    entity: "adyen", type: "CALL", author: "leo", interactionOffset: -60,
    participantUsers: ["leo"], participantContacts: ["Sanne de Vries"],
    summary: "Renewal discussion opened. Adyen wants the same pricing for another 12 months.",
    actionItems: [{ description: "Share renewal options", owner: "leo", dueOffset: 20, status: "OPEN" }],
  },
  {
    entity: "revolut", type: "CALL", author: "adrian", interactionOffset: -8,
    participantUsers: ["adrian"], participantContacts: ["Oskar Lindqvist"],
    summary: "Customer security team still owes the production certificates for EU VoP DE. Marked the line blocked.",
    actionItems: [{ description: "Chase certificates", owner: "adrian", dueOffset: 2, status: "OPEN" }],
  },
  {
    entity: "hvb", type: "CALL", author: "leo", interactionOffset: -35,
    participantUsers: ["leo"], participantContacts: ["Claudia Schulz"],
    summary: "Renewal date is close. UniCredit wants a proposal before the end of the month.",
    actionItems: [],
  },
];
