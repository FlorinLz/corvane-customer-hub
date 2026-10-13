import { describe, expect, it } from "vitest";

import { byDateText, byText, dayText, dayTimeText, doneTimeText, phraseFor, spanText, timeLeft, timelineText } from "@/lib/time-block";

// Demo day: Mon 05 Oct 2026, 10:48 CEST = 08:48Z = 16:48 SGT/MYT.
const NOW = new Date("2026-10-05T08:48:00Z");
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

describe("spanText()", () => {
  it("under 1 h in minutes", () => {
    expect(spanText(12)).toBe("12 min");
    expect(spanText(58)).toBe("58 min");
  });
  it("1 h to 24 h as hours, with minutes only when there are some", () => {
    expect(spanText(60)).toBe("1 h");
    expect(spanText(7 * 60)).toBe("7 h");
    expect(spanText(6 * 60 + 58)).toBe("6 h 58 min");
  });
  it("over 24 h as days", () => {
    expect(spanText(24 * 60)).toBe("1 day");
    expect(spanText(2 * 24 * 60 + 300)).toBe("2 days");
  });
});

describe("timeLeft()", () => {
  it("no deadline is the none state", () => {
    expect(timeLeft(null, NOW)).toEqual({ text: "No deadline", state: "none", minutes: null });
  });
  it("under an hour is soon, an hour or more is default", () => {
    expect(timeLeft(at(12), NOW)).toMatchObject({ text: "12 min", state: "soon" });
    expect(timeLeft(at(59), NOW)).toMatchObject({ text: "59 min", state: "soon" });
    expect(timeLeft(at(60), NOW)).toMatchObject({ text: "1 h", state: "default" });
    expect(timeLeft(at(7 * 60), NOW)).toMatchObject({ text: "7 h", state: "default" });
    expect(timeLeft(at(3 * 24 * 60), NOW)).toMatchObject({ text: "3 days", state: "default" });
  });
  it("overdue counts up the same way and always says Overdue", () => {
    expect(timeLeft(at(-5), NOW)).toMatchObject({ text: "Overdue 5 min", state: "over" });
    expect(timeLeft(at(-90), NOW)).toMatchObject({ text: "Overdue 1 h 30 min", state: "over" });
    expect(timeLeft(at(-2 * 24 * 60), NOW)).toMatchObject({ text: "Overdue 2 days", state: "over" });
  });
  it("the minute either side of zero is Due now, not Overdue", () => {
    expect(timeLeft(at(0), NOW)).toMatchObject({ text: "Due now", state: "soon" });
    expect(timeLeft(new Date(NOW.getTime() - 30_000), NOW)).toMatchObject({ text: "Due now", state: "soon" });
  });
});

describe("byText(): the viewer's zone, always with its label", () => {
  const due = at(-5); // 10:43 CEST = 16:43 SGT
  it("same day: time and zone label only", () => {
    expect(byText(due, NOW, "Europe/Amsterdam")).toBe("by 10:43 CEST");
    expect(byText(due, NOW, "Asia/Singapore")).toBe("by 16:43 SGT");
    expect(byText(due, NOW, "Asia/Kuala_Lumpur")).toBe("by 16:43 MYT");
  });
  it("another day: the date too", () => {
    expect(byText(at(24 * 60), NOW, "Europe/Amsterdam")).toBe("by Tue 06 Oct, 10:48 CEST");
  });
  it("same day is decided in the viewer's zone, not UTC", () => {
    const lateNowSgt = new Date("2026-10-05T15:30:00Z"); // 23:30 SGT, 17:30 CEST
    const dueNextDaySgt = new Date("2026-10-05T16:30:00Z"); // 00:30 SGT on 06 Oct, same day 18:30 CEST
    expect(byText(dueNextDaySgt, lateNowSgt, "Asia/Singapore")).toBe("by Tue 06 Oct, 00:30 SGT");
    expect(byText(dueNextDaySgt, lateNowSgt, "Europe/Amsterdam")).toBe("by 18:30 CEST");
  });
});

describe("phraseFor(): other people's deadlines on Home line 2", () => {
  it("no deadline, no phrase", () => {
    expect(phraseFor(null, NOW)).toBeNull();
  });
  it("overdue and under 1 h are markers; later is plain text", () => {
    expect(phraseFor(at(-5), NOW)).toEqual({ text: "Overdue 5 min", marker: "over" });
    expect(phraseFor(at(58), NOW)).toEqual({ text: "in 58 min", marker: "soon" });
    expect(phraseFor(at(6 * 60 + 58), NOW)).toEqual({ text: "in 6 h 58 min", marker: null });
  });
});

describe("short date form on another day: weekday, day, month, time, zone", () => {
  it("dayTimeText(): the viewer's own day is the time and zone only; another day adds 'Tue 06 Oct,'", () => {
    expect(dayTimeText(at(-5), NOW, "Asia/Kuala_Lumpur")).toBe("16:43 MYT");
    expect(dayTimeText(at(8 * 60), NOW, "Asia/Kuala_Lumpur")).toBe("Tue 06 Oct, 00:48 MYT");
    expect(dayTimeText(at(-24 * 60), NOW, "Europe/Amsterdam")).toBe("Sun 04 Oct, 10:48 CEST");
  });

  it("dayText(): the year only when it is not the year of 'now'", () => {
    expect(dayText(at(14 * 24 * 60), NOW, "Europe/Amsterdam")).toBe("Mon 19 Oct");
    expect(dayText(new Date("2027-01-04T09:00:00Z"), NOW, "Europe/Amsterdam")).toBe("Mon 04 Jan 2027");
  });

  it("September reads 'Sep', whatever the platform's own locale data says", () => {
    expect(dayText(new Date("2026-09-15T09:00:00Z"), NOW, "Europe/Amsterdam")).toBe("Tue 15 Sep");
  });

  it("byDateText(): a calendar deadline reads 'by Mon 19 Oct', no time and no zone label, in the viewer's zone", () => {
    const due = new Date(NOW.getTime() + 14 * 24 * 3_600_000); // Mon 19 Oct 10:48 CEST = 16:48 SGT
    expect(byDateText(due, NOW, "Europe/Amsterdam")).toBe("by Mon 19 Oct");
    expect(byDateText(due, NOW, "Asia/Singapore")).toBe("by Mon 19 Oct");
    // 23:30 UTC on the 18th is already the 19th in Singapore.
    expect(byDateText(new Date("2026-10-18T23:30:00Z"), NOW, "Asia/Singapore")).toBe("by Mon 19 Oct");
    expect(byDateText(new Date("2026-10-18T23:30:00Z"), NOW, "Europe/Amsterdam")).toBe("by Mon 19 Oct");
    expect(byDateText(new Date("2026-10-18T21:30:00Z"), NOW, "Europe/London")).toBe("by Sun 18 Oct");
  });
});

describe("Timeline and Done times: always with the date", () => {
  it("timelineText(): weekday, day, month, then time and zone, even on the viewer's own day", () => {
    expect(timelineText(at(-125), NOW, "Europe/Amsterdam")).toBe("Mon 05 Oct, 08:43 CEST");
    expect(timelineText(at(-125), NOW, "Asia/Kuala_Lumpur")).toBe("Mon 05 Oct, 14:43 MYT");
    expect(timelineText(at(-24 * 60), NOW, "Asia/Singapore")).toBe("Sun 04 Oct, 16:48 SGT");
  });

  it("doneTimeText(): the day, then time and zone", () => {
    expect(doneTimeText(new Date("2026-10-05T09:20:00Z"), "Asia/Singapore")).toBe("Mon 05 Oct, 17:20 SGT");
    expect(doneTimeText(new Date("2026-10-05T08:21:00Z"), "Europe/Amsterdam")).toBe("Mon 05 Oct, 10:21 CEST");
  });
});
