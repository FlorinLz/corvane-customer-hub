// Brief 7.1.3. 18 seeded entities (Santander Consumer Bank GmbH, the 19th,
// is created live in scenario 1 and is not in the seed).
export interface SeedEntity {
  key: string;
  legalName: string;
  type: "BANK" | "FINTECH" | "PSP";
  country: string;
  lei: string;
  bics: string[];
  aliases: string[];
  roles: ("C" | "P")[];
  group: string | null; // group key, or null for standalone
  createdOffset: number;
  createdBy: string; // user key
  ownerKey: string | null; // user key, or null for "No owner"
  ownerSinceOffset: number | null;
  inactive?: { setBy: string; setOffset: number; reason: string };
  deleted?: { by: string; offsetDays: number; time: string; reason: string };
}

export const ENTITIES: SeedEntity[] = [
  {
    key: "santanderUk", legalName: "Santander UK plc", type: "BANK", country: "GB",
    lei: "PTCQB104N23FMNK2RZ28", bics: ["ABBYGB2LXXX"], aliases: [], roles: ["C"],
    group: "santander", createdOffset: -262, createdBy: "tom",
    ownerKey: "sophie", ownerSinceOffset: -140,
  },
  {
    key: "totta", legalName: "Banco Santander Totta, S.A.", type: "BANK", country: "PT",
    lei: "549300URJH9VSI58CS32", bics: ["TOTAPTPLXXX"], aliases: [], roles: ["C", "P"],
    group: "santander", createdOffset: -257, createdBy: "tom",
    ownerKey: "adrian", ownerSinceOffset: -255,
  },
  {
    key: "scbIt", legalName: "Santander Consumer Bank S.p.A.", type: "BANK", country: "IT",
    lei: "549300O0YQXDOJB36Y73", bics: ["FICUITTTXXX"], aliases: [], roles: ["C"],
    group: "santander", createdOffset: -237, createdBy: "tom",
    ownerKey: "emma", ownerSinceOffset: -45,
  },
  {
    key: "scbPt", legalName: "Banco Santander Consumer Portugal S.A.", type: "BANK", country: "PT",
    lei: "549300Z5VU00GHU3B005", bics: [], aliases: [], roles: ["C"],
    group: "santander", createdOffset: -3, createdBy: "michael",
    ownerKey: "michael", ownerSinceOffset: -3,
  },
  {
    key: "lloyds", legalName: "Lloyds Bank plc", type: "BANK", country: "GB",
    lei: "H7FNTJ4851HG0EXQ1Z70", bics: ["LOYDGB2LXXX"], aliases: ["Lloyds TSB Bank plc"], roles: ["C", "P"],
    group: null, createdOffset: -400, createdBy: "tom",
    ownerKey: "adrian", ownerSinceOffset: -399,
  },
  {
    key: "mps", legalName: "Banca Monte dei Paschi di Siena S.p.A.", type: "BANK", country: "IT",
    lei: "J4CP7MHCXR8DAQMKIL78", bics: ["PASCITMMXXX"], aliases: ["MPS"], roles: ["C"],
    group: null, createdOffset: -380, createdBy: "tom",
    ownerKey: "emma", ownerSinceOffset: -150,
  },
  {
    key: "zopa", legalName: "Zopa Bank Limited", type: "FINTECH", country: "GB",
    lei: "213800QW7QJVVCL9RZ56", bics: ["ZOPAGB21XXX"], aliases: ["Zopa Financial Services"], roles: ["C"],
    group: null, createdOffset: -60, createdBy: "tom",
    ownerKey: "kevin", ownerSinceOffset: -58,
  },
  {
    key: "hvb", legalName: "UniCredit Bank GmbH", type: "BANK", country: "DE",
    lei: "2ZCNRR8UK83OBTEK2170", bics: ["HYVEDEMMXXX"], aliases: ["HVB", "HypoVereinsbank"], roles: ["C"],
    group: null, createdOffset: -500, createdBy: "tom",
    ownerKey: "emma", ownerSinceOffset: -1,
  },
  {
    key: "adyen", legalName: "Adyen N.V.", type: "PSP", country: "NL",
    lei: "724500973ODKK3IFQ447", bics: [], aliases: [], roles: ["C", "P"],
    group: null, createdOffset: -720, createdBy: "tom",
    ownerKey: "leo", ownerSinceOffset: -200,
  },
  {
    key: "revolut", legalName: "Revolut Ltd", type: "FINTECH", country: "GB",
    lei: "213800MQORWPL582SW82", bics: ["REVOGB21XXX"], aliases: [], roles: ["C"],
    group: null, createdOffset: -200, createdBy: "michael",
    ownerKey: "adrian", ownerSinceOffset: -199,
  },
  {
    key: "monzo", legalName: "Monzo Bank Ltd", type: "FINTECH", country: "GB",
    lei: "213800PLUYXGZ8LU7T61", bics: ["MONZGB2LXXX"], aliases: [], roles: ["C"],
    group: null, createdOffset: -30, createdBy: "michael",
    ownerKey: "ethan", ownerSinceOffset: -20,
  },
  {
    key: "nordea", legalName: "Nordea Bank Abp", type: "BANK", country: "FI",
    lei: "529900ODI3047E2LIV03", bics: ["NDEAFIHHXXX"], aliases: [], roles: ["C"],
    group: null, createdOffset: -262, createdBy: "michael",
    ownerKey: "sophie", ownerSinceOffset: -150,
  },
  {
    key: "ingdiba", legalName: "ING-DiBa AG", type: "BANK", country: "DE",
    lei: "3KXUNHVVQFIJN6RHLO76", bics: ["INGDDEFFXXX"], aliases: [], roles: ["C", "P"],
    group: null, createdOffset: -225, createdBy: "michael",
    ownerKey: "ethan", ownerSinceOffset: -120,
  },
  {
    key: "ocbc", legalName: "Oversea-Chinese Banking Corporation Limited", type: "BANK", country: "SG",
    lei: "5493007O3QFXCPOGWK22", bics: ["OCBCSGSGXXX"], aliases: ["OCBC"], roles: ["P"],
    group: null, createdOffset: -110, createdBy: "adrian",
    ownerKey: null, ownerSinceOffset: null,
  },
  {
    key: "boi", legalName: "The Governor and Company of the Bank of Ireland", type: "BANK", country: "IE",
    lei: "Q2GQA2KF6XJ24W42G291", bics: ["BOFIIE2DXXX"], aliases: ["Bank of Ireland"], roles: ["P"],
    group: null, createdOffset: -70, createdBy: "adrian",
    ownerKey: "kevin", ownerSinceOffset: -70,
  },
  {
    key: "ceska", legalName: "Česká spořitelna, a.s.", type: "BANK", country: "CZ",
    lei: "9KOGW2C2FCIOJQ7FF485", bics: ["GIBACZPXXXX"], aliases: [], roles: ["C"],
    group: null, createdOffset: -10, createdBy: "michael",
    ownerKey: "kevin", ownerSinceOffset: -9,
  },
  {
    key: "rbi", legalName: "Raiffeisen Bank International AG", type: "BANK", country: "AT",
    lei: "9ZHRYM6F437SQJ6OUG95", bics: ["RZBAATWWXXX"], aliases: ["RBI"], roles: ["C"],
    group: null, createdOffset: -600, createdBy: "michael",
    ownerKey: "sophie", ownerSinceOffset: -400,
    inactive: { setBy: "adrian", setOffset: -60, reason: "Contract terminated by the customer" },
  },
  {
    key: "lloydsLegacy", legalName: "Lloyds Bank (legacy import)", type: "BANK", country: "GB",
    lei: "H7FNTJ4851HG0EXQ1Z70", bics: [], aliases: [], roles: ["C"],
    group: null, createdOffset: -40, createdBy: "michael",
    ownerKey: "michael", ownerSinceOffset: -40,
    deleted: { by: "adrian", offsetDays: -14, time: "16:40", reason: "Duplicate of Lloyds Bank plc (LEI H7FNTJ4851HG0EXQ1Z70)" },
  },
];

/** Partner records with no Sales creator: createdBy is Adrian Koh (Ops). */
export const PARTNER_ONLY_NO_SALES_CREATOR = new Set(["ocbc", "boi"]);
