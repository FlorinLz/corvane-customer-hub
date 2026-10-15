import { describe, expect, it } from "vitest";

import { SCENARIOS } from "@/lib/onboarding/content";
import { hrefOf, matches, pickMove, routeOf, skipAhead, type EngineInput, type Move, type RouteIds } from "@/lib/onboarding/engine";

const ids: RouteIds = { iss1042: "i1", partnerIssue: "p1", revolutIssue: "r1", lloyds: "l1" };
const EMMA = "emma.wilson@corvane.example";
const KEVIN = "kevin.lim@corvane.example";
const LUKAS = "lukas.brenner@corvane.example";

const base = (moves: Move[], over: Partial<EngineInput> = {}): EngineInput => ({
  moves,
  stepAs: EMMA,
  viewer: EMMA,
  route: routeOf("/", ids),
  ids,
  done: new Set(),
  present: new Set(moves.map((m) => m.id)),
  valued: new Set(),
  stepDataDone: false,
  ...over,
});

const step = (id: string) =>
  Object.values(SCENARIOS)
    .flatMap((s) => s.chapters.flatMap((c) => c.steps))
    .find((st) => st.id === id)!;

describe("routeOf and matches", () => {
  it("reads the page, the tab and which scenario issue it is", () => {
    expect(routeOf("/", ids)).toEqual({ page: "home" });
    expect(routeOf("/search", ids)).toEqual({ page: "search" });
    expect(routeOf("/entities/l1/partner", ids)).toEqual({ page: "entity", tab: "partner" });
    expect(routeOf("/entities/l1", ids)).toEqual({ page: "entity", tab: "overview" });
    expect(routeOf("/issues/i1", ids)).toEqual({ page: "issue", issue: "iss1042" });
    expect(routeOf("/issues/p1", ids)).toEqual({ page: "issue", issue: "partner" });
    expect(routeOf("/issues/r1", ids)).toEqual({ page: "issue", issue: "revolut" });
    expect(routeOf("/issues/zzz", ids)).toEqual({ page: "issue", issue: "other" });
    expect(routeOf("/admin/users", ids)).toEqual({ page: "other" });
  });

  it("matches a page, and any or not-home", () => {
    expect(matches({ page: "home" }, routeOf("/", ids))).toBe(true);
    expect(matches({ page: "not-home" }, routeOf("/", ids))).toBe(false);
    expect(matches({ page: "not-home" }, routeOf("/search", ids))).toBe(true);
    expect(matches({ page: "any" }, routeOf("/admin", ids))).toBe(true);
    expect(matches({ page: "entity", tab: "partner" }, routeOf("/entities/l1/overview", ids))).toBe(false);
    expect(matches({ page: "entity" }, routeOf("/entities/l1/overview", ids))).toBe(true);
    expect(matches({ page: "issue", issue: "partner" }, routeOf("/issues/i1", ids))).toBe(false);
  });

  it("gives a path for a page that has one", () => {
    expect(hrefOf({ page: "home" }, ids)).toBe("/");
    expect(hrefOf({ page: "issue", issue: "revolut" }, ids)).toBe("/issues/r1");
    expect(hrefOf({ page: "entity", tab: "partner" }, ids)).toBe("/entities/l1/partner");
    expect(hrefOf({ page: "any" }, ids)).toBeNull();
    expect(hrefOf({ page: "issue", issue: "revolut" }, { ...ids, revolutIssue: null })).toBeNull();
  });
});

describe("pickMove: scenario 1, chapter 1a, step 1", () => {
  const moves = step("s1-home").moves;

  it("with another person, View as comes first", () => {
    expect(pickMove(base(moves, { viewer: "adrian.koh@corvane.example" }))).toMatchObject({ kind: "view-as", as: EMMA });
  });

  it("as Emma away from Home, the first move is Click Home", () => {
    expect(pickMove(base(moves, { route: routeOf("/issues/i1", ids) }))).toMatchObject({ kind: "move", move: { id: "h-home" } });
  });

  it("Click Home is skipped on the issue too, and the way into an issue is skipped once there", () => {
    const resolve = step("s1b-resolve").moves;
    const onIssue = pickMove(base(resolve, { stepAs: KEVIN, viewer: KEVIN, route: routeOf("/issues/i1", ids) }));
    expect(onIssue).toMatchObject({ kind: "move", move: { id: "r-open" } });
    const onHome = pickMove(base(resolve, { stepAs: KEVIN, viewer: KEVIN }));
    expect(onHome).toMatchObject({ kind: "move", move: { id: "s1b-resolve-in-row" } });
    const elsewhere = pickMove(base(resolve, { stepAs: KEVIN, viewer: KEVIN, route: routeOf("/search", ids) }));
    expect(elsewhere).toMatchObject({ kind: "move", move: { id: "s1b-resolve-in-home" } });
  });

  it("on Home, Click Home is skipped and the read on the row shows", () => {
    expect(pickMove(base(moves))).toMatchObject({ kind: "move", move: { id: "h-row", kind: "read" }, index: 1 });
  });

  it("after Got it there is nothing more to show", () => {
    expect(pickMove(base(moves, { done: new Set(["h-row"]) }))).toEqual({ kind: "none" });
  });
});

describe("pickMove: the off-path case", () => {
  const moves = step("s1-log").moves; // read the Communication log, on ISS-1042

  it("on another page there is no move, and Back on track names the page of the next one", () => {
    const r = pickMove(base(moves, { route: routeOf("/search", ids) }));
    expect(r).toMatchObject({ kind: "off", href: "/issues/i1" });
  });

  it("on the right issue the move shows; on another issue it is off the path", () => {
    expect(pickMove(base(moves, { route: routeOf("/issues/i1", ids) }))).toMatchObject({ kind: "move" });
    expect(pickMove(base(moves, { route: routeOf("/issues/p1", ids) }))).toMatchObject({ kind: "off" });
  });
});

describe("pickMove: persona, data and done moves", () => {
  const moves = step("s1b-resolve").moves; // as Kevin on ISS-1042: click Resolve, two fields, submit
  const onIssue = routeOf("/issues/i1", ids);
  const kevin = (over: Partial<EngineInput> = {}) => base(moves, { stepAs: KEVIN, viewer: KEVIN, route: onIssue, ...over });

  it("walks the moves in order as the click and the fields are done", () => {
    expect(pickMove(kevin())).toMatchObject({ move: { id: "r-open" } });
    expect(pickMove(kevin({ done: new Set(["r-open"]) }))).toMatchObject({ move: { id: "r-cause" } });
    expect(pickMove(kevin({ done: new Set(["r-open"]), valued: new Set(["r-cause"]) }))).toMatchObject({ move: { id: "r-solution" } });
    expect(pickMove(kevin({ done: new Set(["r-open"]), valued: new Set(["r-cause", "r-solution"]) }))).toMatchObject({ move: { id: "r-submit" } });
  });

  it("the person differs from the step's: View as, not the move", () => {
    expect(pickMove(kevin({ viewer: EMMA }))).toMatchObject({ kind: "view-as", as: KEVIN });
  });

  it("when the data says the step is done its remaining moves are skipped", () => {
    expect(pickMove(kevin({ stepDataDone: true }))).toEqual({ kind: "none" });
  });

  it("a closed dialog offers its opening click again", () => {
    // Resolve was clicked, but the dialog is gone: its fields are not on the page, the button is.
    const r = pickMove(kevin({ done: new Set(["r-open"]), present: new Set(["r-open"]) }));
    expect(r).toMatchObject({ kind: "move", move: { id: "r-open" } });
  });

  it("a later move done means the earlier ones are behind the visitor (the field is gone once its option was picked)", () => {
    const report = step("s2-report").moves;
    const r = pickMove(base(report, { stepAs: LUKAS, viewer: LUKAS, done: new Set(["rp-home", "rp-open", "rp-entity-pick"]), present: new Set(["rp-open", "rp-type"]) }));
    expect(r).toMatchObject({ kind: "move", move: { id: "rp-type" } });
  });

  it("a move whose target is missing, with nothing to offer again, is waiting", () => {
    const r = pickMove(kevin({ present: new Set() }));
    expect(r).toMatchObject({ kind: "waiting", move: { id: "r-open" } });
  });

  it("an optional move whose field is not on the page is skipped", () => {
    const input = base(step("s2-resolve").moves, {
      stepAs: LUKAS,
      viewer: LUKAS,
      route: routeOf("/issues/p1", ids),
      done: new Set(["rs-home", "rs-row", "rs-open"]),
      valued: new Set(["rs-cause", "rs-solution"]),
      present: new Set(["rs-submit"]), // no event fields on a Sev-2 issue
    });
    expect(pickMove(input)).toMatchObject({ move: { id: "rs-submit" } });
  });

  it("the closing moves of a done step still show", () => {
    const send = step("s1b-send").moves;
    const onIssueRoute = pickMove(base(send, { stepAs: KEVIN, viewer: KEVIN, route: routeOf("/issues/i1", ids), stepDataDone: true }));
    expect(onIssueRoute).toMatchObject({ kind: "move", move: { id: "sd-home" } });
    const home = pickMove(base(send, { stepAs: KEVIN, viewer: KEVIN, route: routeOf("/", ids), stepDataDone: true }));
    expect(home).toMatchObject({ kind: "move", move: { id: "sd-read", kind: "read" } });
  });

  it("a route move is done once its page is reached, however the visitor got there", () => {
    const open = step("s1-issue").moves; // click ISS-1042 on Home, then read on the issue
    expect(pickMove(base(open, { route: routeOf("/issues/i1", ids) }))).toMatchObject({ move: { id: "i-next" } });
  });
});

describe("skip ahead", () => {
  it("from Home in scenario 2 step 1 lands on the Partner tab as Lukas, past the search and the clicks", () => {
    const r = skipAhead({ moves: step("s2-impact").moves, stepAs: LUKAS, viewer: EMMA, route: routeOf("/", ids), ids, done: new Set(), stepDataDone: false });
    expect(r?.target.id).toBe("im-read");
    expect(r?.href).toBe("/entities/l1/partner");
    expect(r?.as).toBe(LUKAS);
    expect(r?.markDone).toEqual(["im-search", "im-enter", "im-result", "im-tab"]);
  });

  it("in 1b step 1 it stops at Click Resolve on ISS-1042 as Kevin", () => {
    const r = skipAhead({ moves: step("s1b-resolve").moves, stepAs: KEVIN, viewer: EMMA, route: routeOf("/", ids), ids, done: new Set(), stepDataDone: false });
    expect(r).toMatchObject({ href: "/issues/i1", as: KEVIN, target: { id: "r-open" }, markDone: ["s1b-resolve-in-home", "s1b-resolve-in-row"] });
  });

  it("does nothing when every move is done", () => {
    expect(skipAhead({ moves: step("s1-log").moves, stepAs: EMMA, viewer: EMMA, route: routeOf("/", ids), ids, done: new Set(["l-log"]), stepDataDone: false })).toBeNull();
  });
});
