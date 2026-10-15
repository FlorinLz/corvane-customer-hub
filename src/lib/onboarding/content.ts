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
  panel: "ch_onboarding_panel_v2",
} as const;

/** The opening of the welcome card from anywhere (the demo bar's "?"). */
export const OPEN_WELCOME_EVENT = "ch:onboarding-open-welcome";

/** The welcome modal, in three steps (src/components/onboarding/WelcomeModal.tsx). */
export const WELCOME = {
  step1: {
    title: "Welcome to Customer Hub",
    paragraphs: [
      "A personal portfolio project. The company and the data are fictional; the problem is real: critical operational work spread across inboxes, chats and spreadsheets, with deadlines nobody can see.",
      "This MVP, built with Claude Code, shows how an internal tool can bring that work into one place and automate the routine parts. It focuses on incident management: from the first report to the root cause report, across four teams.",
    ],
  },
  step2: {
    title: "Customer Hub",
    paragraphs: [
      "Corvane checks payee names between banks before money moves. When a check fails, Ops, Customer Success, Network and Compliance each have a part to play, and the customer needs one clear answer, on time.",
      "Customer Hub puts customers, partners and incidents in one place, built on five principles:",
    ],
    principles: ["Anyone can report an issue", "Information easy to find and use", "One owner, one voice to the customer", "Everyone sees their next action", "A visible deadline on every step"],
  },
  step3: {
    title: "See it in action",
    cards: {
      1: { label: "Scenario 1 \u00b7 2 min, plus an optional 3 min chapter", title: "The night Sev-1, the morning after", text: "A bank's name checks failed overnight. At 10:05 Customer Success picks it up and briefs the customer." },
      2: { label: "Scenario 2 \u00b7 4 min", title: "A partner bank goes down", text: "Lloyds reports trouble on its side. Report it once, tell every affected customer, resolve once." },
    },
    explore: "Explore on my own",
    note: "Switch person any time with View as in the dark bar. The demo resets itself after 20 minutes without changes.",
  },
  next: "Next",
  back: "Back",
  howBuilt: "How it was built",
  decisions: "Design decisions",
} as const;

export const MOBILE_NOTICE = "Customer Hub is built for desktop. Open it on a laptop for the full demo.";

export type ScenarioId = 1 | 2;
/** Scenario 1 has two chapters; scenario 2 has one. */
export type ChapterId = "1a" | "1b" | "2";

/** What the server reports about the data (src/server/queries/onboarding.ts). */
export interface OnboardingState {
  /** DemoMeta.seedVersion: a restore starts every scenario again. */
  seedVersion: number;
  scenario1: {
    issueId: string | null;
    updateRecorded: boolean;
    /** Chapter 2: each is true once the data says so. */
    resolved: boolean;
    confirmed: boolean;
    draftShared: boolean;
    approved: boolean;
    sent: boolean;
  };
  scenario2: {
    /** Lloyds Bank plc, the entity page the impact step opens. */
    partnerEntityId: string | null;
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
  /** The persona the step is told from (a DEMO_USERS email). */
  persona: string;
  personaName: string;
  /** Where "Take me there" goes: Home, the scenario's issue page, or the partner's entity page (its Partner tab). */
  page: "home" | "issue" | "entity";
  /** data-onboarding value scrolled to after the jump. */
  anchor: string;
  /**
   * How the step turns done. "data": the server says so (a row exists). "viewed": there is no row to read, so the step is done once the
   * visitor has had its anchor in view on the right page (the persona too when `needsPersona`); remembered until the data is restored.
   */
  check: "data" | "viewed";
  needsPersona?: boolean;
}

/** What the end of a chapter offers: the next chapter and a way out, or the link to the README. */
export type ChapterAction = "continue" | "finish" | "built";

export interface Chapter {
  id: ChapterId;
  scenario: ScenarioId;
  /** Shown in the panel header for scenario 1's two chapters. */
  title: string | null;
  prologue: string[];
  /** Scenario 2: the message that starts it, shown under the prologue. */
  signal?: { from: string; subject: string; body: string; footnote: string };
  steps: ScenarioStep[];
  end: { text: string; actions: ChapterAction[] };
}

export interface Scenario {
  id: ScenarioId;
  title: string;
  chapters: Chapter[];
}

const EMMA = { persona: "emma.wilson@corvane.example", personaName: "Emma Wilson" };
const LUKAS = { persona: "lukas.brenner@corvane.example", personaName: "Lukas Brenner" };
const ADRIAN = { persona: "adrian.koh@corvane.example", personaName: "Adrian Koh" };
const KEVIN = { persona: "kevin.lim@corvane.example", personaName: "Kevin Lim" };
const MEI = { persona: "mei.chen@corvane.example", personaName: "Mei Chen" };

export const CONTINUE_LABEL = "Continue: Closing the loop \u00b7 3 min";
export const FINISH_LABEL = "Finish here";

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  1: {
    id: 1,
    title: "The night Sev-1, the morning after",
    chapters: [
      {
        id: "1a",
        scenario: 1,
        title: "The morning after",
        prologue: [
          "Monday, 10:05. Emma Wilson starts her day in Customer Success. Overnight, every name check for Banca Monte dei Paschi di Siena (MPS) failed, and Kevin Lim in Ops handled it.",
          "Without one shared place, Emma would rebuild the night from Kevin's emails, a chat thread and the monitoring tool while MPS waits for news. Here is her morning in Customer Hub.",
        ],
        steps: [
          {
            id: "s1-home",
            title: "Start on Home as Emma Wilson",
            text: "Emma speaks for Corvane to MPS. ISS-1042 sits at the top of her Home, with her next action and the time left to do it.",
            ...EMMA,
            page: "home",
            anchor: "home-issues",
            check: "viewed",
            needsPersona: true,
          },
          {
            id: "s1-issue",
            title: "Open ISS-1042",
            text: "Your next action says what Emma does now. The Action plan shows the night in process order: the alert, Kevin's acknowledgement 9 minutes later, the customer told within the hour.",
            ...EMMA,
            page: "issue",
            anchor: "action-plan",
            check: "viewed",
            needsPersona: true,
          },
          {
            id: "s1-log",
            title: "Read the Communication log",
            text: "Kevin wrote to Silvia Moretti, the MPS incident contact, during the night. Emma reads exactly what was promised before she speaks to her.",
            ...EMMA,
            page: "issue",
            anchor: "communication-log",
            check: "viewed",
          },
          {
            id: "s1-compliance",
            title: "Look at the Compliance card",
            text: "MPS is a bank under DORA. Mei Chen in Compliance flagged a possible major incident: MPS may have to report it to its regulator and needs the facts from Corvane within 2 hours.",
            ...EMMA,
            page: "issue",
            anchor: "compliance-card",
            check: "viewed",
          },
          {
            id: "s1-update",
            title: "Send the Update",
            text: "Send Silvia an Update from the message panel, then record it. The log and Emma's next action change at once.",
            ...EMMA,
            page: "issue",
            anchor: "message-panel",
            check: "data",
          },
        ],
        end: {
          text: "MPS is up to date. ISS-1042 still has to be resolved, confirmed with the customer and explained in a root cause report that Compliance approves.",
          actions: ["continue", "finish"],
        },
      },
      {
        id: "1b",
        scenario: 1,
        title: "Closing the loop",
        prologue: [
          "Kevin's certificate fix holds: MPS name checks are back to normal. The MPS contract asks for a root cause report within 20 days of resolution, and Compliance approves it before it goes out. Five steps, three people, one issue.",
        ],
        steps: [
          {
            id: "s1b-resolve",
            title: "Resolve as Kevin Lim",
            text: "Switch to Kevin with View as. As owner he resolves ISS-1042. Watch the Action plan: the report steps open, each with its person and deadline.",
            ...KEVIN,
            page: "issue",
            anchor: "action-plan",
            check: "data",
          },
          {
            id: "s1b-confirm",
            title: "Confirm resolution as Emma Wilson",
            text: "Emma checks with Silvia that payments flow again and records it. The customer side is done; the report is still open.",
            ...EMMA,
            page: "issue",
            anchor: "action-plan",
            check: "data",
          },
          {
            id: "s1b-share",
            title: "Share the draft report as Kevin",
            text: "Kevin writes what failed and why, and shares the draft. The deadline is 20 days from resolution, taken from the MPS contract.",
            ...KEVIN,
            page: "issue",
            anchor: "action-plan",
            check: "data",
          },
          {
            id: "s1b-approve",
            title: "Approve as Mei Chen",
            text: "Mei reads the draft with the regulator in mind. She approves it, or asks for changes and it goes back to Kevin with her reason.",
            ...MEI,
            page: "issue",
            anchor: "action-plan",
            check: "data",
          },
          {
            id: "s1b-send",
            title: "Send the approved report as Kevin",
            text: "Kevin sends the approved report to MPS. ISS-1042 closes on its own: every step is done, and nothing is left on anyone's Home.",
            ...KEVIN,
            page: "issue",
            anchor: "action-plan",
            check: "data",
          },
        ],
        end: {
          text: "From a monitoring alert at night to an approved report: Ops, Customer Success and Compliance, each person seeing only their next step.",
          actions: ["built"],
        },
      },
    ],
  },
  2: {
    id: 2,
    title: "A partner bank goes down",
    chapters: [
      {
        id: "2",
        scenario: 2,
        title: null,
        prologue: [
          "Lloyds Bank plc is one of Corvane's partner banks: it answers UK Confirmation of Payee checks for customers such as Revolut. When Lloyds slows down, all of those customers see failed checks, and each is owed a notice within its own contract deadline. Lukas Brenner in Network looks after partners.",
        ],
        signal: {
          from: "Paul Grant, Incident contact, Lloyds Bank plc",
          subject: "CoP responses delayed",
          body: "We are seeing elevated timeouts on Confirmation of Payee responses since this morning. Our engineers are investigating. Next update within the hour.",
          footnote: "Paul became Lloyds' incident contact 20 days ago. His name is on the Lloyds page, so Lukas knows the message is genuine and whom to reply to.",
        },
        steps: [
          {
            id: "s2-impact",
            title: "Check who depends on Lloyds",
            // The real page: the Partner tab's UK CoP / GB coverage. No page lists the dependent customers by name (reported in the PR).
            text: "As Lukas, open the Lloyds Partner tab. UK CoP / GB is Active, and every customer that sends UK CoP checks through Lloyds depends on it. These are the customers waiting on Lukas.",
            ...LUKAS,
            page: "entity",
            anchor: "partner-customers",
            check: "viewed",
            needsPersona: true,
          },
          {
            id: "s2-report",
            title: "Report the issue",
            text: "From Home, use Report issue. Anyone at Corvane can report, and it takes under a minute. The hints next to the form show what to enter.",
            ...LUKAS,
            page: "home",
            anchor: "home-issues",
            check: "data",
          },
          {
            id: "s2-degraded",
            title: "Acknowledge, then set to Degraded",
            text: "Acknowledging starts the work. Degraded marks Lloyds on every customer that relies on it, and Affected customers lists each one with its own notice deadline.",
            ...LUKAS,
            page: "issue",
            anchor: "affected-customers",
            check: "data",
          },
          {
            id: "s2-linked",
            title: "Create linked issues",
            text: "One issue per affected customer, each with its own communicator. Every customer hears from one person who already knows them.",
            ...LUKAS,
            page: "issue",
            anchor: "linked-issues",
            check: "data",
          },
          {
            id: "s2-notify",
            title: "Notify Revolut Ltd as Adrian Koh",
            text: "Switch to Adrian. His Home shows Notify Revolut Ltd with the time left. Record the notification and the deadline clears.",
            ...ADRIAN,
            page: "home",
            anchor: "home-issues",
            check: "data",
          },
          {
            id: "s2-resolve",
            title: "Resolve once, as Lukas",
            text: "Paul confirms the fix. Lukas resolves the partner issue, and every linked issue resolves with it.",
            ...LUKAS,
            page: "issue",
            anchor: "linked-issues",
            check: "data",
          },
        ],
        end: { text: "One report, every affected customer told by their own contact, one resolution.", actions: ["built"] },
      },
    ],
  },
};

export const SCENARIO_END = "See how it was built";

export function chapterOf(id: ChapterId): Chapter {
  for (const s of Object.values(SCENARIOS)) {
    const c = s.chapters.find((ch) => ch.id === id);
    if (c) return c;
  }
  throw new Error(`No chapter ${id}`);
}

/** Which steps the data says are done. Steps with check "viewed" are not in here: the browser decides those. */
export function doneFromData(state: OnboardingState | null): Record<string, boolean> {
  if (!state) return {};
  const s1 = state.scenario1;
  const s2 = state.scenario2;
  return {
    "s1-update": s1.updateRecorded,
    "s1b-resolve": s1.resolved,
    "s1b-confirm": s1.confirmed,
    "s1b-share": s1.draftShared,
    "s1b-approve": s1.approved,
    "s1b-send": s1.sent,
    "s2-report": s2.issueId !== null,
    "s2-degraded": s2.issueId !== null && s2.acknowledged && s2.degraded,
    "s2-linked": s2.linkedCount > 0,
    "s2-notify": s2.revolutNotified,
    "s2-resolve": s2.resolved,
  };
}

/** The page a step opens, or null when its issue or entity does not exist yet. */
export function stepHref(step: ScenarioStep, scenario: ScenarioId, state: OnboardingState | null): string | null {
  if (step.page === "home") return "/";
  if (step.page === "entity") return state?.scenario2.partnerEntityId ? `/entities/${state.scenario2.partnerEntityId}/partner` : null;
  const issueId = scenario === 1 ? state?.scenario1.issueId : state?.scenario2.issueId;
  return issueId ? `/issues/${issueId}` : null;
}

export type NoteKey = "next-action" | "time-column" | "action-plan" | "owner-communicator" | "linked-issues";

/** "Why this?" notes: plain, no principles. */
export const NOTES: Record<NoteKey, { title: string; text: string }> = {
  "next-action": { title: "Your next action", text: "One step for you, with its deadline and the button to do it. When nothing waits on you, it names who is next." },
  "time-column": { title: "Time", text: "The time left on your next deadline. It turns orange when close and red once it has passed." },
  "action-plan": { title: "Action plan", text: "Every step from report to close, in the order the work happens. Steps you can act on now come first; later ones are marked Waiting." },
  "owner-communicator": { title: "People", text: "One owner fixes the issue and one communicator speaks to the customer. Everyone else contributes." },
  "linked-issues": { title: "Linked issues", text: "When a partner fails, every customer on that service is listed with its own deadline. Resolving the partner issue resolves every linked issue." },
};
