// Brief 7.1.1. All active (resolution 6). createdAt = today-400 for all.
// timeZone per 7.1.17.1 (issue flow, milestone 6A); defaults to Europe/Bucharest otherwise.
export interface SeedUser {
  key: string;
  name: string;
  email: string;
  team: "SALES" | "OPS" | "CS" | "NETWORK" | "COMPLIANCE" | "FINANCE";
  isAdmin: boolean;
  timeZone: string;
}

export const USERS: SeedUser[] = [
  { key: "tom", name: "Tom Hadley", email: "tom.hadley@corvane.example", team: "SALES", isAdmin: false, timeZone: "Europe/Amsterdam" },
  { key: "michael", name: "Michael Reed", email: "michael.reed@corvane.example", team: "SALES", isAdmin: false, timeZone: "America/New_York" },
  { key: "adrian", name: "Adrian Koh", email: "adrian.koh@corvane.example", team: "OPS", isAdmin: true, timeZone: "Asia/Kuala_Lumpur" },
  { key: "kevin", name: "Kevin Lim", email: "kevin.lim@corvane.example", team: "OPS", isAdmin: false, timeZone: "Asia/Kuala_Lumpur" },
  { key: "emma", name: "Emma Wilson", email: "emma.wilson@corvane.example", team: "CS", isAdmin: false, timeZone: "Europe/Amsterdam" },
  { key: "leo", name: "Leo Martin", email: "leo.martin@corvane.example", team: "CS", isAdmin: false, timeZone: "Europe/Amsterdam" },
  { key: "sophie", name: "Sophie Mitchell", email: "sophie.mitchell@corvane.example", team: "CS", isAdmin: false, timeZone: "Europe/London" },
  { key: "ethan", name: "Ethan Brooks", email: "ethan.brooks@corvane.example", team: "CS", isAdmin: false, timeZone: "Europe/Amsterdam" },
  { key: "lukas", name: "Lukas Brenner", email: "lukas.brenner@corvane.example", team: "NETWORK", isAdmin: false, timeZone: "Asia/Singapore" },
  // Created CS; team-changed to Network at ts(-30, "11:20") — see NORA_LEE_TEAM_CHANGE below.
  { key: "nora", name: "Nora Lee", email: "nora.lee@corvane.example", team: "NETWORK", isAdmin: false, timeZone: "Asia/Singapore" },
  { key: "mei", name: "Mei Chen", email: "mei.chen@corvane.example", team: "COMPLIANCE", isAdmin: false, timeZone: "Asia/Singapore" },
  { key: "rachel", name: "Rachel Wong", email: "rachel.wong@corvane.example", team: "FINANCE", isAdmin: false, timeZone: "Asia/Singapore" },
];

/** Nora Lee is created with team CS, then changed to Network (scenario decision 6). */
export const NORA_LEE_TEAM_CHANGE = {
  key: "nora",
  createdTeam: "CS" as const,
  changedAt: [-30, "11:20"] as const,
};
