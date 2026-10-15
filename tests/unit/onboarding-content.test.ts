import { describe, expect, it } from "vitest";

import { CONTACTS } from "@seed/data/contacts";
import { ISSUES } from "@seed/data/issues";
import { OBLIGATIONS } from "@seed/data/obligations";
import { DEMO_USERS } from "@/lib/demo-users";
import {
  DECISIONS_URL,
  MOBILE_NOTICE,
  NOTES,
  REPO_URL,
  SCENARIOS,
  START_HERE_URL,
  STORAGE_KEYS,
  WELCOME,
  chapterOf,
  doneFromData,
  stepHref,
  type OnboardingState,
} from "@/lib/onboarding/content";
import { REPORT_HINTS } from "@/components/onboarding/hints";

const EMPTY: OnboardingState = {
  seedVersion: 1,
  scenario1: { issueId: "i1042", updateRecorded: false, resolved: false, confirmed: false, draftShared: false, approved: false, sent: false },
  scenario2: { partnerEntityId: "lloyds1", issueId: null, acknowledged: false, degraded: false, linkedCount: 0, revolutNotified: false, resolved: false },
};

const chapters = Object.values(SCENARIOS).flatMap((s) => s.chapters);

const allText = () => [
  ...JSON.stringify(WELCOME).split('"'),
  MOBILE_NOTICE,
  ...Object.values(REPORT_HINTS),
  ...Object.values(NOTES).flatMap((n) => [n.title, n.text]),
  ...Object.values(SCENARIOS).flatMap((s) => [
    s.title,
    ...s.chapters.flatMap((c) => [c.title ?? "", ...c.prologue, c.end.text, ...Object.values(c.signal ?? {}), ...c.steps.flatMap((st) => [st.title, st.text])]),
  ]),
];

describe("onboarding copy", () => {
  it("uses no em dash; the five notes are plain and name no principle", () => {
    for (const t of allText()) expect(t).not.toContain("—");
    expect(Object.keys(NOTES)).toHaveLength(5);
    for (const n of Object.values(NOTES)) expect(n.text.toLowerCase()).not.toContain("principle");
    expect(WELCOME.step2.principles).toHaveLength(5);
  });

  it("links the repository's README Start here and DECISIONS.md", () => {
    expect(START_HERE_URL).toBe(`${REPO_URL}#start-here`);
    expect(DECISIONS_URL).toBe(`${REPO_URL}/blob/main/DECISIONS.md`);
  });

  it("every step names a demo person who exists", () => {
    for (const c of chapters) for (const st of c.steps) expect(DEMO_USERS.some((u) => u.email === st.persona && u.name === st.personaName)).toBe(true);
  });

  it("the panel's storage key is v2, so returning visitors start clean", () => {
    expect(STORAGE_KEYS.panel).toBe("ch_onboarding_panel_v2");
  });
});

describe("scenario structure", () => {
  it("scenario 1 has chapters 1a (5 steps) and 1b (5 steps); scenario 2 has one chapter of 6 steps with a signal", () => {
    expect(SCENARIOS[1].chapters.map((c) => [c.id, c.steps.length])).toEqual([["1a", 5], ["1b", 5]]);
    expect(SCENARIOS[2].chapters.map((c) => [c.id, c.steps.length])).toEqual([["2", 6]]);
    expect(chapterOf("1a").signal).toBeUndefined();
    expect(chapterOf("2").signal).toMatchObject({ from: expect.stringContaining("Paul Grant"), subject: "CoP responses delayed" });
  });

  it("every chapter has a prologue and an end; 1a offers Continue and Finish, the others the README link", () => {
    for (const c of chapters) {
      expect(c.prologue.length).toBeGreaterThan(0);
      expect(c.end.text.length).toBeGreaterThan(0);
    }
    expect(chapterOf("1a").end.actions).toEqual(["continue", "finish"]);
    expect(chapterOf("1b").end.actions).toEqual(["built"]);
    expect(chapterOf("2").end.actions).toEqual(["built"]);
  });

  it("step ids are unique; 1a's first four and scenario 2's impact step are viewed, every other step reads data", () => {
    const steps = chapters.flatMap((c) => c.steps);
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
    const viewed = steps.filter((s) => s.check === "viewed").map((s) => s.id);
    expect(viewed).toEqual(["s1-home", "s1-issue", "s1-log", "s1-compliance", "s2-impact"]);
    expect(chapterOf("2").steps[0]).toMatchObject({ persona: "lukas.brenner@corvane.example", page: "entity", anchor: "partner-customers" });
    expect(chapterOf("1b").steps.map((s) => s.persona.split(".")[0])).toEqual(["kevin", "emma", "kevin", "mei", "kevin"]);
  });
});

describe("the copy agrees with the seed", () => {
  const iss1042 = ISSUES.find((i) => i.number === 1042)!;
  const minutes = (t: { time: string }) => Number(t.time.slice(0, 2)) * 60 + Number(t.time.slice(3));
  const text = (id: string) => chapters.flatMap((c) => c.steps).find((s) => s.id === id)!.text;

  it("Kevin acknowledged 9 minutes after the alert, and the customer was told within the hour", () => {
    expect(minutes(iss1042.acknowledgedAt!) - minutes(iss1042.awareAt)).toBe(9);
    expect(minutes(iss1042.notifiedAt!) - minutes(iss1042.awareAt)).toBeLessThan(60);
    expect(iss1042.acknowledgedByKey).toBe("kevin");
    expect(text("s1-issue")).toContain("9 minutes later");
    expect(text("s1-issue")).toContain("within the hour");
  });

  it("the facts are due within 2 hours and the report 20 days after resolution", () => {
    const mps = OBLIGATIONS.find((o) => o.entity === "mps" && o.kind === "CUSTOMER_AGREEMENT")!;
    expect(mps.factsNeededHours).toBe(2);
    expect(mps.postIncidentReportDays).toBe(20);
    expect(iss1042.complianceAssessment?.assessedByKey).toBe("mei");
    expect(text("s1-compliance")).toContain("within 2 hours");
    expect(text("s1b-share")).toContain("20 days");
    expect(chapterOf("1b").prologue.join(" ")).toContain("20 days");
  });

  it("Kevin wrote to Silvia Moretti, the MPS incident contact", () => {
    expect(iss1042.communications[0]).toMatchObject({ recordedByKey: "kevin", contactName: "Silvia Moretti" });
    expect(CONTACTS.some((c) => c.entity === "mps" && c.fullName === "Silvia Moretti" && c.role === "INCIDENT")).toBe(true);
  });

  it("Paul Grant is Lloyds' primary incident contact, verified 20 days ago", () => {
    const paul = CONTACTS.find((c) => c.entity === "lloyds" && c.fullName === "Paul Grant")!;
    expect(paul).toMatchObject({ role: "INCIDENT", isPrimary: true, verifiedOffset: -20 });
    expect(chapterOf("2").signal!.footnote).toContain("20 days ago");
  });
});

describe("step checks", () => {
  it("nothing is done on untouched data, and nothing before the state has loaded", () => {
    expect(Object.values(doneFromData(EMPTY)).some(Boolean)).toBe(false);
    expect(doneFromData(null)).toEqual({});
  });

  it("each flag of scenario 1's data turns its own step done", () => {
    const s1 = EMPTY.scenario1;
    const of = (patch: Partial<typeof s1>) => doneFromData({ ...EMPTY, scenario1: { ...s1, ...patch } });
    expect(of({ updateRecorded: true })["s1-update"]).toBe(true);
    expect(of({ resolved: true })).toMatchObject({ "s1b-resolve": true, "s1b-confirm": false });
    expect(of({ confirmed: true })["s1b-confirm"]).toBe(true);
    expect(of({ draftShared: true })["s1b-share"]).toBe(true);
    expect(of({ approved: true })["s1b-approve"]).toBe(true);
    expect(of({ sent: true })["s1b-send"]).toBe(true);
  });

  it("each flag of scenario 2's data turns its own step done; the impact step is never from data", () => {
    const s2 = { ...EMPTY.scenario2, issueId: "p1" };
    const of = (patch: Partial<typeof s2>) => doneFromData({ ...EMPTY, scenario2: { ...s2, ...patch } });
    expect(doneFromData(EMPTY)).not.toHaveProperty("s2-impact");
    expect(of({})).toMatchObject({ "s2-report": true, "s2-degraded": false, "s2-linked": false });
    expect(of({ acknowledged: true })["s2-degraded"]).toBe(false); // acknowledged is not Degraded
    expect(of({ acknowledged: true, degraded: true })["s2-degraded"]).toBe(true);
    expect(of({ linkedCount: 3 })["s2-linked"]).toBe(true);
    expect(of({ revolutNotified: true })["s2-notify"]).toBe(true);
    expect(of({ resolved: true })["s2-resolve"]).toBe(true);
  });

  it("Take me there opens Home, an issue or the partner's entity page; with none yet, nowhere", () => {
    const [home, issue] = chapterOf("1a").steps;
    expect(stepHref(home, 1, EMPTY)).toBe("/");
    expect(stepHref(issue, 1, EMPTY)).toBe("/issues/i1042");
    const [impact, , degraded] = chapterOf("2").steps;
    expect(stepHref(impact, 2, EMPTY)).toBe("/entities/lloyds1/partner");
    expect(stepHref(impact, 2, { ...EMPTY, scenario2: { ...EMPTY.scenario2, partnerEntityId: null } })).toBeNull();
    expect(stepHref(degraded, 2, EMPTY)).toBeNull();
    expect(stepHref(degraded, 2, { ...EMPTY, scenario2: { ...EMPTY.scenario2, issueId: "p1" } })).toBe("/issues/p1");
  });
});
