/**
 * First-visit onboarding copy (DECISIONS.md, "First-visit onboarding"). Plain data, shared by the welcome card, the scenario panel, the
 * "Why this?" notes and the tests. British English, short sentences, no em dashes.
 */

export const REPO_URL = "https://github.com/FlorinLz/corvane-customer-hub";
export const START_HERE_URL = `${REPO_URL}#start-here`;
export const DECISIONS_URL = `${REPO_URL}/blob/main/DECISIONS.md`;

/** localStorage keys. A version suffix so a changed card can be shown again by bumping it. */
export const STORAGE_KEYS = {
  welcomeDismissed: "ch_onboarding_welcome_v1",
  mobileDismissed: "ch_onboarding_mobile_v1",
  seen: "ch_onboarding_seen_v1",
  panel: "ch_onboarding_panel_v1",
} as const;

/** The opening of the welcome card from anywhere (the demo bar's "?"). */
export const OPEN_WELCOME_EVENT = "ch:onboarding-open-welcome";

export const WELCOME = {
  title: "Customer Hub, a portfolio demo",
  intro:
    "Corvane checks payee names between banks. When something breaks, four teams must act fast and one person must speak to the customer. Customer Hub gives each person their next action and a deadline.",
  by: "Built by Florin Lazar, Product Manager. Fictional data; the demo resets itself.",
  scenario1: "Run scenario 1 (2 min)",
  scenario2: "Run scenario 2 (3 min)",
  explore: "Explore on my own",
  howBuilt: "How it was built",
  decisions: "Design decisions",
} as const;

export const MOBILE_NOTICE = "Customer Hub is built for desktop. Open it on a laptop for the full demo.";

export type ScenarioId = 1 | 2;

/** What the server reports about the data (src/server/queries/onboarding.ts). */
export interface OnboardingState {
  /** DemoMeta.seedVersion: a restore starts every scenario again. */
  seedVersion: number;
  scenario1: { issueId: string | null; updateRecorded: boolean };
  scenario2: {
    issueId: string | null;
    acknowledged: boolean;
    degraded: boolean;
    linkedCount: number;
    revolutNotified: boolean;
    resolved: boolean;
  };
}

export interface ScenarioStep {
  id: string;
  title: string;
  text: string;
  optional?: boolean;
  /** The persona the step is told from (a DEMO_USERS email). */
  persona: string;
  personaName: string;
  /** Where "Take me there" goes: Home, or the scenario's issue page. */
  page: "home" | "issue";
  /** data-onboarding value scrolled to after the jump. */
  anchor: string;
  /**
   * How the step turns done. "data": the server says so (a row exists). "viewed": there is no row to read, so the step is done once the
   * visitor has had its anchor in view on the right page (the persona too when `needsPersona`); remembered until the data is restored.
   */
  check: "data" | "viewed";
  needsPersona?: boolean;
}

export interface Scenario {
  id: ScenarioId;
  title: string;
  subtitle: string;
  steps: ScenarioStep[];
}

const EMMA = { persona: "emma.wilson@corvane.example", personaName: "Emma Wilson" };
const LUKAS = { persona: "lukas.brenner@corvane.example", personaName: "Lukas Brenner" };
const ADRIAN = { persona: "adrian.koh@corvane.example", personaName: "Adrian Koh" };

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  1: {
    id: 1,
    title: "The night Sev-1, the morning after",
    subtitle: "ISS-1042: every name check for Banca Monte dei Paschi di Siena failed overnight.",
    steps: [
      {
        id: "s1-home",
        title: "Start on Home as Emma Wilson",
        text: "Emma is in Customer Success and talks to the customer this morning. Her issue and her next action are at the top of Home.",
        ...EMMA,
        page: "home",
        anchor: "home-issues",
        check: "viewed",
        needsPersona: true,
      },
      {
        id: "s1-issue",
        title: "Open ISS-1042",
        text: "Read Your next action, then the Action plan in process order. It shows who did what overnight.",
        ...EMMA,
        page: "issue",
        anchor: "action-plan",
        check: "viewed",
        needsPersona: true,
      },
      {
        id: "s1-log",
        title: "Read the Communication log",
        text: "Kevin Lim told the customer during the night. The handover to Emma is recorded, so she starts with the full story.",
        ...EMMA,
        page: "issue",
        anchor: "communication-log",
        check: "viewed",
      },
      {
        id: "s1-compliance",
        title: "Look at the Compliance card",
        text: "The Compliance card and the customer obligations show why the regulator deadline matters for this bank.",
        ...EMMA,
        page: "issue",
        anchor: "compliance-card",
        check: "viewed",
      },
      {
        id: "s1-update",
        title: "Send the Update",
        text: "Send the Update from the message panel, then record it. The log and the next action change at once.",
        optional: true,
        ...EMMA,
        page: "issue",
        anchor: "message-panel",
        check: "data",
      },
    ],
  },
  2: {
    id: 2,
    title: "A partner bank goes down",
    subtitle: "Lloyds Bank plc is degraded on UK CoP in GB. Every customer that relies on it needs to hear from us.",
    steps: [
      {
        id: "s2-report",
        title: "Report the issue as Lukas Brenner",
        text: "Lukas is in Network. From Home, use Report issue: Lloyds Bank plc, Partner degraded or unavailable, UK CoP, GB.",
        ...LUKAS,
        page: "home",
        anchor: "home-issues",
        check: "data",
      },
      {
        id: "s2-degraded",
        title: "Acknowledge, then set to Degraded",
        text: "Acknowledge the issue, then set the partner to Degraded. Affected customers lists every customer with its own deadline.",
        ...LUKAS,
        page: "issue",
        anchor: "affected-customers",
        check: "data",
      },
      {
        id: "s2-linked",
        title: "Create linked issues",
        text: "Create one issue per affected customer. Each one has its own communicator, so every customer hears from one person.",
        ...LUKAS,
        page: "issue",
        anchor: "linked-issues",
        check: "data",
      },
      {
        id: "s2-notify",
        title: "Notify Revolut Ltd as Adrian Koh",
        text: "On Adrian's Home, the next action reads Notify Revolut Ltd. Record the notification and the deadline clears.",
        ...ADRIAN,
        page: "home",
        anchor: "home-issues",
        check: "data",
      },
      {
        id: "s2-resolve",
        title: "Resolve once, as Lukas",
        text: "Resolve the partner issue. Every linked issue resolves with it.",
        ...LUKAS,
        page: "issue",
        anchor: "linked-issues",
        check: "data",
      },
    ],
  },
};

export const SCENARIO_END = "See how it was built";

/** Which steps the data says are done. Steps with check "viewed" are not in here: the browser decides those. */
export function doneFromData(state: OnboardingState | null): Record<string, boolean> {
  if (!state) return {};
  const s2 = state.scenario2;
  return {
    "s1-update": state.scenario1.updateRecorded,
    "s2-report": s2.issueId !== null,
    "s2-degraded": s2.issueId !== null && s2.acknowledged && s2.degraded,
    "s2-linked": s2.linkedCount > 0,
    "s2-notify": s2.revolutNotified,
    "s2-resolve": s2.resolved,
  };
}

/** The page a step opens, or null when its issue does not exist yet. */
export function stepHref(step: ScenarioStep, scenario: ScenarioId, state: OnboardingState | null): string | null {
  if (step.page === "home") return "/";
  const issueId = scenario === 1 ? state?.scenario1.issueId : state?.scenario2.issueId;
  return issueId ? `/issues/${issueId}` : null;
}

export type NoteKey = "next-action" | "time-column" | "action-plan" | "owner-communicator" | "linked-issues";

/** "Why this?" notes: the decision, then the principle it serves. Two sentences each. */
export const NOTES: Record<NoteKey, { title: string; text: string }> = {
  "next-action": {
    title: "Your next action",
    text: "The top of every issue shows one step for you, with its deadline and one button, or says nothing waits on you and names who is next. This serves the principle that everyone sees their next action.",
  },
  "time-column": {
    title: "Time",
    text: "Each row shows the time left on the step that matters to you, and it turns red when the deadline is near or has passed. This serves the principle of a visible deadline on every step.",
  },
  "action-plan": {
    title: "Action plan",
    text: "The plan lists every step in the order the process needs it, with the steps you can do now first and the later ones marked as waiting. This serves the principle that information is easy to find and use: the whole path, and who did what, is on one page.",
  },
  "owner-communicator": {
    title: "Owner and Communicator",
    text: "Each issue names one owner who fixes it and one communicator who speaks to the customer. This serves the principle of one owner and one voice to the customer, so a customer never hears from four teams.",
  },
  "linked-issues": {
    title: "Linked issues",
    text: "A partner outage creates one linked issue per affected customer, each with its own communicator and deadline, and resolving the partner issue resolves them all. This serves the principle that everyone sees their next action, because nobody has to work out who is affected.",
  },
};
