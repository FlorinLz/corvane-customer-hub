// Brief 7.1.17.4. One shift per team, covering every instant from today-7 to
// today+14 (decision B19: Sales and Finance have no on-call rota).
export interface SeedOnCallShift {
  team: "OPS" | "NETWORK" | "COMPLIANCE";
  userKey: string;
  timeZone: string;
}

export const ON_CALL: SeedOnCallShift[] = [
  { team: "OPS", userKey: "kevin", timeZone: "Asia/Kuala_Lumpur" },
  { team: "NETWORK", userKey: "nora", timeZone: "Asia/Singapore" },
  { team: "COMPLIANCE", userKey: "mei", timeZone: "Asia/Singapore" },
];
