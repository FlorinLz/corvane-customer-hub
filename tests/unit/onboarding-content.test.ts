import { describe, expect, it } from "vitest";

import { DEMO_USERS } from "@/lib/demo-users";
import { DECISIONS_URL, MOBILE_NOTICE, NOTES, REPO_URL, SCENARIOS, START_HERE_URL, WELCOME, doneFromData, stepHref, type OnboardingState } from "@/lib/onboarding/content";

const EMPTY: OnboardingState = {
  seedVersion: 1,
  scenario1: { issueId: "i1042", updateRecorded: false },
  scenario2: { issueId: null, acknowledged: false, degraded: false, linkedCount: 0, revolutNotified: false, resolved: false },
};

const allText = () => [
  ...Object.values(WELCOME),
  MOBILE_NOTICE,
  ...Object.values(NOTES).flatMap((n) => [n.title, n.text]),
  ...Object.values(SCENARIOS).flatMap((s) => [s.title, s.subtitle, ...s.steps.flatMap((st) => [st.title, st.text])]),
];

describe("onboarding copy", () => {
  it("the welcome card has at most 60 words of text", () => {
    expect([WELCOME.title, WELCOME.intro, WELCOME.by].join(" ").split(/\s+/).length).toBeLessThanOrEqual(60);
  });

  it("uses no em dash, and each note is two sentences", () => {
    for (const t of allText()) expect(t).not.toContain("—");
    for (const n of Object.values(NOTES)) expect(n.text.split(/(?<=\.)\s+/)).toHaveLength(2);
    expect(Object.keys(NOTES)).toHaveLength(5);
  });

  it("links the repository's README Start here and DECISIONS.md", () => {
    expect(START_HERE_URL).toBe(`${REPO_URL}#start-here`);
    expect(DECISIONS_URL).toBe(`${REPO_URL}/blob/main/DECISIONS.md`);
  });

  it("every step names a demo person who exists", () => {
    for (const s of Object.values(SCENARIOS)) for (const st of s.steps) expect(DEMO_USERS.some((u) => u.email === st.persona && u.name === st.personaName)).toBe(true);
  });
});

describe("step checks", () => {
  it("nothing is done on untouched data, and nothing before the state has loaded", () => {
    expect(Object.values(doneFromData(EMPTY)).some(Boolean)).toBe(false);
    expect(doneFromData(null)).toEqual({});
  });

  it("each flag of the data turns its own step done", () => {
    const s2 = { ...EMPTY.scenario2, issueId: "p1" };
    expect(doneFromData({ ...EMPTY, scenario1: { ...EMPTY.scenario1, updateRecorded: true } })["s1-update"]).toBe(true);
    expect(doneFromData({ ...EMPTY, scenario2: s2 })).toMatchObject({ "s2-report": true, "s2-degraded": false, "s2-linked": false });
    expect(doneFromData({ ...EMPTY, scenario2: { ...s2, acknowledged: true } })["s2-degraded"]).toBe(false); // acknowledged is not Degraded
    expect(doneFromData({ ...EMPTY, scenario2: { ...s2, acknowledged: true, degraded: true } })["s2-degraded"]).toBe(true);
    expect(doneFromData({ ...EMPTY, scenario2: { ...s2, linkedCount: 3 } })["s2-linked"]).toBe(true);
    expect(doneFromData({ ...EMPTY, scenario2: { ...s2, revolutNotified: true } })["s2-notify"]).toBe(true);
    expect(doneFromData({ ...EMPTY, scenario2: { ...s2, resolved: true } })["s2-resolve"]).toBe(true);
  });

  it("Take me there opens Home, or the scenario's issue; with no issue yet, nowhere", () => {
    const [home, issue] = SCENARIOS[1].steps;
    expect(stepHref(home, 1, EMPTY)).toBe("/");
    expect(stepHref(issue, 1, EMPTY)).toBe("/issues/i1042");
    expect(stepHref(SCENARIOS[2].steps[1], 2, EMPTY)).toBeNull();
    expect(stepHref(SCENARIOS[2].steps[1], 2, { ...EMPTY, scenario2: { ...EMPTY.scenario2, issueId: "p1" } })).toBe("/issues/p1");
  });
});
