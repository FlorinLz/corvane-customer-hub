// Brief 5.2 "View as" switcher, M15 AC11. Full session wiring (cookie,
// server action, per-user rights) lands in milestone 2 (demo mode); this is
// the static roster the milestone 1 shell stub renders.
export type Team = "SALES" | "OPS" | "CS" | "NETWORK" | "COMPLIANCE" | "FINANCE";

export const TEAM_LABELS: Record<Team, string> = {
  SALES: "Sales",
  OPS: "Ops",
  CS: "Customer Success",
  NETWORK: "Network",
  COMPLIANCE: "Compliance",
  FINANCE: "Finance",
};

export interface DemoUser {
  name: string;
  email: string;
  team: Team;
  isAdmin: boolean;
}

// Milestone 8 (PO decision): every active seeded user, not just each team's
// primary. Teams stay adjacent so the flat list still reads as grouped by
// team; within a team the primary person (the one every other milestone's
// seed data/worklists default to) comes first.
export const DEMO_USERS: DemoUser[] = [
  { name: "Tom Hadley", email: "tom.hadley@corvane.example", team: "SALES", isAdmin: false },
  { name: "Michael Reed", email: "michael.reed@corvane.example", team: "SALES", isAdmin: false },
  { name: "Adrian Koh", email: "adrian.koh@corvane.example", team: "OPS", isAdmin: true },
  { name: "Kevin Lim", email: "kevin.lim@corvane.example", team: "OPS", isAdmin: false },
  { name: "Emma Wilson", email: "emma.wilson@corvane.example", team: "CS", isAdmin: false },
  { name: "Leo Martin", email: "leo.martin@corvane.example", team: "CS", isAdmin: false },
  { name: "Sophie Mitchell", email: "sophie.mitchell@corvane.example", team: "CS", isAdmin: false },
  { name: "Ethan Brooks", email: "ethan.brooks@corvane.example", team: "CS", isAdmin: false },
  { name: "Lukas Brenner", email: "lukas.brenner@corvane.example", team: "NETWORK", isAdmin: false },
  { name: "Nora Lee", email: "nora.lee@corvane.example", team: "NETWORK", isAdmin: false },
  { name: "Mei Chen", email: "mei.chen@corvane.example", team: "COMPLIANCE", isAdmin: false },
  { name: "Rachel Wong", email: "rachel.wong@corvane.example", team: "FINANCE", isAdmin: false },
];

// B8: default "View as" user when no cookie is set.
export const DEFAULT_DEMO_USER: DemoUser = DEMO_USERS.find((u) => u.email === "adrian.koh@corvane.example")!;

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
