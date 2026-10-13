// Brief 7.1.2. Only one group is seeded; every other entity is STANDALONE
// (confirmed at creation, so "Group not set" never fires in the seed).
export interface SeedGroup {
  key: string;
  name: string;
  parentLei: string;
  parentLegalName: string;
  hqCountry: string;
  createdOffset: number;
  createdBy: string; // user key
  members: string[]; // entity keys
}

export const GROUPS: SeedGroup[] = [
  {
    key: "santander",
    name: "Santander",
    parentLei: "5493006QMFDDMYWIAM13",
    parentLegalName: "BANCO SANTANDER S.A.",
    hqCountry: "ES",
    createdOffset: -270,
    createdBy: "adrian",
    members: ["santanderUk", "totta", "scbIt", "scbPt"],
  },
];
