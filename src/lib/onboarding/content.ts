/**
 * First-visit onboarding copy (DECISIONS.md, "First-visit onboarding"). Plain data, shared by the welcome card, the scenario panel, the
 * "Why this?" notes and the tests. British English, short sentences, no em dashes.
 */

import type { IssueRef, Move, Where } from "@/lib/onboarding/engine";

export const REPO_URL = "https://github.com/FlorinLz/corvane-customer-hub";
export const START_HERE_URL = `${REPO_URL}#start-here`;
export const DECISIONS_URL = `${REPO_URL}/blob/main/DECISIONS.md`;

/** localStorage keys. A version suffix so a changed card can be shown again by bumping it. */
export const STORAGE_KEYS = {
  welcomeDismissed: "ch_onboarding_welcome_v1",
  mobileDismissed: "ch_onboarding_mobile_v1",
  seen: "ch_onboarding_moves_v1",
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
    note: "Switch person any time with View as in the dark bar. This copy of the demo is yours for 24 hours; Start over in the dark bar takes it back to Monday 10:05.",
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
    /** Revolut Ltd's linked issue under the partner issue, once the linked issues exist. */
    revolutIssueId: string | null;
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
  /**
   * How the step turns done. "data": the server says so (a row exists). "viewed": there is no row to read, so the step is done once the visitor
   * has been through its moves (the last "Got it").
   */
  check: "data" | "viewed";
  /** One action at a time, in order (src/lib/onboarding/engine.ts). The bubble on the page shows the current one. */
  moves: Move[];
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


/** The part of the update message's last open line that the person completes (src/server/issues/stage-message.ts; a unit test keeps the two the same). */
export const UPDATE_PLACEHOLDER = "[one line to complete before sending]";
/** In a move's `fill`: the example link on the approved document host, and the event date and time (the viewer's zone, 90 minutes before now). */
export const EXAMPLE_LINK_TOKEN = "@exampleLink";
export const EVENT_DATE_TOKEN = "@eventDate";
export const EVENT_TIME_TOKEN = "@eventTime";

// Move builders. A move is one action; the engine shows the first one not done whose page and person fit.
const HOME: Where = { page: "home" };
const issueAt = (issue: IssueRef): Where => ({ page: "issue", issue });
const click = (id: string, where: Where, target: string, say: string, o: Partial<Move> = {}): Move => ({ id, where, target, kind: "click", say, doneWhen: "click", ...o });
const read = (id: string, where: Where, target: string, say: string, o: Partial<Move> = {}): Move => ({ id, where, target, kind: "read", say, doneWhen: "gotIt", ...o });
const type = (id: string, where: Where, target: string, say: string, fill: string, o: Partial<Move> = {}): Move => ({ id, where, target, kind: "type", say, fill, doneWhen: "value", ...o });
const pick = (id: string, where: Where, target: string, say: string, option: string, o: Partial<Move> = {}): Move => ({ id, where, target, kind: "pick", say, option, doneWhen: "value", ...o });
/** "Click Home", skipped on Home. */
const goHome = (id: string, o: Partial<Move> = {}): Move => click(id, { page: "any" }, "home-link", "Click **Home**", { doneWhen: "route", arrive: HOME, unless: HOME, nav: true, ...o });
/** The way to an issue: Click Home (skipped on Home or on the issue), then its row on Home. Skipped altogether once the visitor is on the issue. */
const enterIssue = (id: string, issue: IssueRef, row: string): Move[] => [
  goHome(`${id}-home`, { unless: [HOME, issueAt(issue)] }),
  click(`${id}-row`, HOME, row, row.endsWith("@partner") ? "Click the partner issue row" : "Click **ISS-1042**", { doneWhen: "route", arrive: issueAt(issue), unless: issueAt(issue), nav: true }),
];
/** The Channel in a record dialog. */
const channel = (id: string, where: Where): Move => pick(id, where, "dialog-channel", "Pick **Email**", "Email", { sayOpen: "Open **Channel**, then pick **Email**." });

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
            text: "Emma speaks for Corvane to MPS. ISS-1042 is at the top of her Home, and Next actions shows who it waits on: Kevin, still investigating.",
            ...EMMA,
            check: "viewed",
            moves: [
              goHome("h-home"),
              read("h-row", HOME, "issue-row~ISS-1042", "Emma's issue. It waits on Kevin, still investigating."),
            ],
          },
          {
            id: "s1-issue",
            title: "Open ISS-1042",
            text: "Your next action shows Emma has nothing due and names who is next. The Action plan shows the night in process order: the alert, Kevin's acknowledgement 9 minutes later, the customer told within the hour.",
            ...EMMA,
            check: "viewed",
            moves: [
              click("i-open", HOME, "issue-row~ISS-1042", "Click **ISS-1042**", { doneWhen: "route", arrive: issueAt("iss1042"), nav: true }),
              read("i-next", issueAt("iss1042"), "next-action", "Nothing due for Emma. Kevin owns the next step."),
              read("i-plan", issueAt("iss1042"), "action-plan", "Overnight, in order: alert, Kevin acknowledged in 9 minutes, customer told within the hour."),
            ],
          },
          {
            id: "s1-log",
            title: "Read the Communication log",
            text: "Kevin wrote to Silvia Moretti, the MPS incident contact, during the night. Emma reads exactly what was promised before she speaks to her.",
            ...EMMA,
            check: "viewed",
            moves: [
              read("l-log", issueAt("iss1042"), "communication-log", "Kevin's message to Silvia at night. Emma reads what was promised."),
            ],
          },
          {
            id: "s1-compliance",
            title: "Look at the Compliance card",
            text: "MPS is a bank under DORA, so ISS-1042 is flagged for Compliance. Mei Chen assessed it as a possible major incident: MPS may have to report it to its regulator and needs the facts from Corvane within 2 hours, as Customer obligations shows.",
            ...EMMA,
            check: "viewed",
            moves: [
              read("c-card", issueAt("iss1042"), "compliance-card", "MPS is under DORA. Compliance assessed a possible major incident."),
              read("c-obl", issueAt("iss1042"), "customer-obligations", "MPS needs the facts from Corvane within 2 hours."),
            ],
          },
          {
            id: "s1-update",
            title: "Send the Update",
            text: "Send Silvia an Update from the message panel, then record it. The Communication log shows it at once, with Emma's name and the time.",
            ...EMMA,
            check: "data",
            moves: [
              type("u-type", issueAt("iss1042"), "message-body", "Write what Ops is doing now.", "Ops renewed the expired certificate and is watching the endpoint.", { replace: UPDATE_PLACEHOLDER }),
              click("u-copy", issueAt("iss1042"), "copy-message", "Click **Copy message**"),
              click("u-record", issueAt("iss1042"), "record-communication", "Click **Record update**"),
              channel("u-channel", issueAt("iss1042")),
              click("u-submit", issueAt("iss1042"), "record-communication-submit", "Click **Record notification**"),
            ],
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
            text: "Switch to Kevin with View as. As owner he resolves ISS-1042. Watch the Action plan: the report steps appear, each with its person and deadline.",
            ...KEVIN,
            check: "data",
            moves: [
              ...enterIssue("s1b-resolve-in", "iss1042", "issue-row~ISS-1042"),
              click("r-open", issueAt("iss1042"), "next-action/resolve", "Click **Resolve**"),
              type("r-cause", issueAt("iss1042"), "resolve-root-cause", "Write the root cause.", "The EU VoP IT endpoint certificate expired after the rotation job failed."),
              type("r-solution", issueAt("iss1042"), "resolve-solution", "Write the solution.", "Certificate renewed and the rotation job fixed. Checks are back to normal."),
              click("r-submit", issueAt("iss1042"), "resolve-submit", "Click **Resolve issue**"),
            ],
          },
          {
            id: "s1b-confirm",
            title: "Confirm resolution as Emma Wilson",
            text: "Emma checks with Silvia that payments flow again and records it. The customer side is done; the report is still open.",
            ...EMMA,
            check: "data",
            moves: [
              ...enterIssue("s1b-confirm-in", "iss1042", "issue-row~ISS-1042"),
              click("cf-goto", issueAt("iss1042"), "next-action/go-to-message", "Click **Go to the message**"),
              click("cf-open", issueAt("iss1042"), "confirm-resolution", "Click **Confirm resolution with the customer**"),
              channel("cf-channel", issueAt("iss1042")),
              click("cf-submit", issueAt("iss1042"), "confirm-resolution-submit", "Click **Confirm resolution**"),
            ],
          },
          {
            id: "s1b-share",
            title: "Share the draft report as Kevin",
            text: "Kevin writes what failed and why, and shares the draft. The deadline is 20 days from resolution, taken from the MPS contract.",
            ...KEVIN,
            check: "data",
            moves: [
              ...enterIssue("s1b-share-in", "iss1042", "issue-row~ISS-1042"),
              click("sh-open", issueAt("iss1042"), "next-action/share-draft", "Click **Share draft**"),
              type("sh-link", issueAt("iss1042"), "share-draft-link", "Use the example link on the approved host.", EXAMPLE_LINK_TOKEN),
              type("sh-summary", issueAt("iss1042"), "share-draft-summary", "Write one sentence of summary.", "Certificate expiry on the EU VoP IT endpoint: cause, impact and fixes."),
              click("sh-submit", issueAt("iss1042"), "share-draft-submit", "Click **Share draft**"),
            ],
          },
          {
            id: "s1b-approve",
            title: "Approve as Mei Chen",
            text: "Mei reads the draft with the regulator in mind. She approves it, or asks for changes and it goes back to Kevin with her reason.",
            ...MEI,
            check: "data",
            moves: [
              ...enterIssue("s1b-approve-in", "iss1042", "issue-row~ISS-1042"),
              click("ap-open", issueAt("iss1042"), "next-action/approve-report", "Click **Approve report**"),
              click("ap-submit", issueAt("iss1042"), "approve-report-submit", "Click **Approve report** to confirm."),
            ],
          },
          {
            id: "s1b-send",
            title: "Send the approved report as Kevin",
            text: "Kevin sends the approved report to MPS. ISS-1042 closes on its own: every step is done, and nothing is left on anyone's Home.",
            ...KEVIN,
            check: "data",
            moves: [
              ...enterIssue("s1b-send-in", "iss1042", "issue-row~ISS-1042"),
              click("sd-open", issueAt("iss1042"), "next-action/record-report-sent", "Click **Record report sent**"),
              channel("sd-channel", issueAt("iss1042")),
              click("sd-submit", issueAt("iss1042"), "record-report-sent-submit", "Click **Record report sent**"),
              goHome("sd-home", { closing: true }),
              read("sd-read", HOME, "home-issues", "ISS-1042 closed itself. Nothing is left on anyone's Home.", { closing: true }),
            ],
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
            text: "As Lukas, open the Lloyds Partner tab. UK CoP / GB lists every customer that sends its checks through Lloyds. These are the customers waiting on Lukas.",
            ...LUKAS,
            check: "viewed",
            moves: [
              type("im-search", { page: "any" }, "global-search", "Type **Lloyds** in the search bar.", "Lloyds", { nav: true, unless: { page: "entity" } }),
              click("im-enter", { page: "any" }, "global-search", "Press **Enter** to search.", { doneWhen: "route", arrive: { page: "search" }, unless: { page: "entity" }, nav: true }),
              click("im-result", { page: "search" }, "search-result~Lloyds Bank plc", "Click **Lloyds Bank plc**", { doneWhen: "route", arrive: { page: "entity" }, nav: true }),
              click("im-tab", { page: "entity" }, "partner-tab", "Click the **Partner** tab", { doneWhen: "route", arrive: { page: "entity", tab: "partner" }, nav: true }),
              read("im-read", { page: "entity", tab: "partner" }, "partner-customers", "These customers send checks through Lloyds. All of them are affected."),
            ],
          },
          {
            id: "s2-report",
            title: "Report the issue",
            text: "From Home, use Report issue. Anyone at Corvane can report, and it takes under a minute. The hints next to the form show what to enter.",
            ...LUKAS,
            check: "data",
            moves: [
              goHome("rp-home"),
              click("rp-open", HOME, "report-issue", "Click **Report issue**"),
              type("rp-entity", HOME, "report-entity", "Type **Lloyds**.", "Lloyds"),
              click("rp-entity-pick", HOME, "option~Lloyds Bank plc", "Pick **Lloyds Bank plc**"),
              pick("rp-type", HOME, "report-type", "Pick **Partner degraded or unavailable**", "Partner degraded or unavailable", { sayOpen: "Open **Type**, then pick **Partner degraded or unavailable**." }),
              pick("rp-coverage", HOME, "report-coverage-option~UK CoP / GB", "Pick **UK CoP / GB**", "UK CoP / GB"),
              type("rp-desc", HOME, "report-description", "Summarise Paul's message in the description.", "Lloyds reports CoP responses timing out since this morning. Engineers investigating."),
              pick("rp-reporter", HOME, "report-reporter", "Pick **Found by Corvane**", "Found by Corvane", { sayOpen: "Open **Reported at the customer by**, then pick **Found by Corvane**." }),
              pick("rp-impact", HOME, "report-impact-option~Degraded", "Pick **Degraded**", "Degraded"),
              pick("rp-breach", HOME, "report-breach-option~No", "Pick **No** for possible data breach.", "No"),
              click("rp-submit", HOME, "report-issue-submit", "Click **Report issue**"),
            ],
          },
          {
            id: "s2-degraded",
            title: "Acknowledge, then set to Degraded",
            text: "Acknowledging starts the work. Degraded marks Lloyds on every customer that relies on it, and Affected customers lists each one with its own notice deadline.",
            ...LUKAS,
            check: "data",
            moves: [
              ...enterIssue("s2-degraded-in", "partner", "issue-row~@partner"),
              click("dg-ack", issueAt("partner"), "next-action/acknowledge", "Click **Acknowledge**"),
              click("dg-set", issueAt("partner"), "set-degraded", "Click **Set to Degraded**"),
              click("dg-save", issueAt("partner"), "save-coverage-status", "Click **Save status**"),
            ],
          },
          {
            id: "s2-linked",
            title: "Create linked issues",
            text: "One issue per affected customer, each with its own communicator. Every customer hears from one person who already knows them.",
            ...LUKAS,
            check: "data",
            moves: [
              ...enterIssue("s2-linked-in", "partner", "issue-row~@partner"),
              click("ln-open", issueAt("partner"), "create-linked-issues", "Click **Create linked issues**"),
              click("ln-submit", issueAt("partner"), "create-linked-submit", "Click **Create**"),
            ],
          },
          {
            id: "s2-notify",
            title: "Notify Revolut Ltd as Adrian Koh",
            text: "Switch to Adrian. His Home shows Notify Revolut Ltd with the time left. Record the notification and the deadline clears.",
            ...ADRIAN,
            check: "data",
            moves: [
              goHome("nt-home"),
              click("nt-row", HOME, "issue-row~Notify Revolut Ltd", "Click the **Notify Revolut Ltd** row", { doneWhen: "route", arrive: issueAt("revolut"), nav: true }),
              click("nt-open", issueAt("revolut"), "record-communication", "Click **Record notification**"),
              channel("nt-channel", issueAt("revolut")),
              click("nt-submit", issueAt("revolut"), "record-communication-submit", "Click **Record notification**"),
            ],
          },
          {
            id: "s2-resolve",
            title: "Resolve once, as Lukas",
            text: "Paul confirms the fix. Lukas resolves the partner issue, and every linked issue resolves with it.",
            ...LUKAS,
            check: "data",
            moves: [
              goHome("rs-home"),
              click("rs-row", HOME, "issue-row~@partner", "Click the partner issue row", { doneWhen: "route", arrive: issueAt("partner"), nav: true }),
              click("rs-open", issueAt("partner"), "next-action/resolve", "Click **Resolve**"),
              type("rs-cause", issueAt("partner"), "resolve-root-cause", "Write the root cause.", "Lloyds CoP gateway overloaded after a configuration change on their side."),
              type("rs-solution", issueAt("partner"), "resolve-solution", "Write the solution.", "Lloyds rolled back the change. Response times are back under one second."),
              type("rs-event-date", issueAt("partner"), "resolve-event-date", "Set the event date.", EVENT_DATE_TOKEN, { optional: true }),
              type("rs-event-time", issueAt("partner"), "resolve-event-time", "Set the event time.", EVENT_TIME_TOKEN, { optional: true }),
              click("rs-submit", issueAt("partner"), "resolve-submit", "Click **Resolve issue**"),
              click("rs-cascade", issueAt("partner"), "resolve-cascade-submit", "Click **Resolve** to confirm."),
            ],
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

export type NoteKey = "next-action" | "time-column" | "action-plan" | "owner-communicator" | "linked-issues";

/** "Why this?" notes: plain, no principles. */
export const NOTES: Record<NoteKey, { title: string; text: string }> = {
  "next-action": { title: "Your next action", text: "One step for you, with its deadline and the button to do it. When nothing waits on you, it names who is next." },
  "time-column": { title: "Time", text: "The time left on your next deadline. It turns orange when close and red once it has passed." },
  "action-plan": { title: "Action plan", text: "Every step from report to close, in the order the work happens. Steps you can act on now come first; later ones are marked Waiting." },
  "owner-communicator": { title: "People", text: "One owner fixes the issue and one communicator speaks to the customer. Everyone else contributes." },
  "linked-issues": { title: "Linked issues", text: "When a partner fails, every customer on that service is listed with its own deadline. Resolving the partner issue resolves every linked issue." },
};


/** The step the visitor is on: the first one not done, or -1 when all are. */
export function currentStepIndex(steps: { id: string }[], isDone: (id: string) => boolean): number {
  return steps.findIndex((st) => !isDone(st.id));
}

/** One piece of a `doThis` line: plain text, or a UI label to show in bold. */
export interface DoThisPart {
  text: string;
  bold: boolean;
}

/** Splits "Click **Resolve** in **Your next action**." into plain and bold parts. Unmatched ** stay as text. */
export function splitBold(line: string): DoThisPart[] {
  const parts: DoThisPart[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > last) parts.push({ text: line.slice(last, m.index), bold: false });
    parts.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push({ text: line.slice(last), bold: false });
  return parts;
}

/** A parsed `target` entry. */
export interface TargetSpec {
  scope: string | null;
  name: string;
  text: string | null;
}

export function parseTarget(raw: string): TargetSpec {
  const [path, text] = raw.split("~");
  const slash = path.indexOf("/");
  return { scope: slash === -1 ? null : path.slice(0, slash), name: slash === -1 ? path : path.slice(slash + 1), text: text ?? null };
}
