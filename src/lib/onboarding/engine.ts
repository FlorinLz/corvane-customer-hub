/**
 * The guided moves: one action at a time, picked from the screen the visitor is on. Pure: no DOM, no React. The panel (OnboardingHost) feeds it the
 * route, the person, the data and what the page shows, and draws what it answers.
 */

export type MoveKind = "click" | "type" | "pick" | "read";
export type DoneWhen = "click" | "route" | "value" | "gotIt" | "data";
export type IssueRef = "iss1042" | "partner" | "revolut";

/** A page, as a move names it. `not-home` is every page but Home. */
export type Where =
  | { page: "any" }
  | { page: "home" }
  | { page: "not-home" }
  | { page: "search" }
  | { page: "entity"; tab?: "overview" | "partner" }
  | { page: "issue"; issue: IssueRef };

export interface Move {
  id: string;
  /** The page the move shows on. */
  where: Where;
  /** The person it shows for. Defaults to the step's persona. */
  as?: string;
  /** A data-onboarding value (syntax in parseTarget: `name`, `scope/name`, `name~text`). */
  target: string;
  kind: MoveKind;
  /** The bubble text: one action, at most 14 words, UI labels between ** **. */
  say: string;
  /** For a pick on a select: the bubble text while the select is closed (the target is then the select itself). */
  sayOpen?: string;
  /** For a "pick": the option's text. The bubble goes to that option once the list is open, and the move is done when the field shows it. */
  option?: string;
  /** For a "type": the suggested text; "@exampleLink" is the example link on the approved document host. */
  fill?: string;
  /** For a "type" on a field that already holds a template: this text is replaced by `fill` (the update message's placeholder line). */
  replace?: string;
  doneWhen: DoneWhen;
  /** For doneWhen "route": the page that means the move is done. */
  arrive?: Where;
  /** The move is skipped while the visitor is on this page, or on any of these ("Click Home" on Home). */
  unless?: Where | Where[];
  /** Getting somewhere: Skip ahead does not stop on it. */
  nav?: boolean;
  /** Skipped when its target is not on the page (a field that only some issues show). */
  optional?: boolean;
  /** Still shown after the step's data says it is done: the step's closing words. */
  closing?: boolean;
}

/** The ids the scenario pages have in this database. */
export interface RouteIds {
  iss1042: string | null;
  partnerIssue: string | null;
  revolutIssue: string | null;
  lloyds: string | null;
}

export interface RouteInfo {
  page: "home" | "search" | "entity" | "issue" | "other";
  tab?: string;
  issue?: IssueRef | "other";
}

export function routeOf(pathname: string, ids: RouteIds): RouteInfo {
  if (pathname === "/") return { page: "home" };
  if (pathname === "/search") return { page: "search" };
  const entity = /^\/entities\/([^/]+)(?:\/([^/]+))?/.exec(pathname);
  if (entity) return { page: "entity", tab: entity[2] ?? "overview" };
  const issue = /^\/issues\/([^/]+)/.exec(pathname);
  if (issue) {
    const id = issue[1];
    return { page: "issue", issue: id === ids.iss1042 ? "iss1042" : id === ids.partnerIssue ? "partner" : id === ids.revolutIssue ? "revolut" : "other" };
  }
  return { page: "other" };
}

export function matches(where: Where, route: RouteInfo): boolean {
  switch (where.page) {
    case "any":
      return true;
    case "home":
      return route.page === "home";
    case "not-home":
      return route.page !== "home";
    case "search":
      return route.page === "search";
    case "entity":
      return route.page === "entity" && (!where.tab || route.tab === where.tab);
    case "issue":
      return route.page === "issue" && route.issue === where.issue;
  }
}

/** The path of a page, or null when it has no one path ("any", "not-home") or its record does not exist yet. */
export function hrefOf(where: Where, ids: RouteIds): string | null {
  switch (where.page) {
    case "home":
      return "/";
    case "search":
      return "/search?q=Lloyds";
    case "entity":
      return ids.lloyds ? `/entities/${ids.lloyds}/${where.tab ?? "overview"}` : null;
    case "issue": {
      const id = where.issue === "iss1042" ? ids.iss1042 : where.issue === "partner" ? ids.partnerIssue : ids.revolutIssue;
      return id ? `/issues/${id}` : null;
    }
    default:
      return null;
  }
}

export interface EngineInput {
  /** The moves of the step the visitor is on. */
  moves: Move[];
  /** The step's persona: the default for a move's `as`. */
  stepAs: string;
  /** The person View as shows. */
  viewer: string;
  route: RouteInfo;
  ids: RouteIds;
  /** Moves done by a click or a "Got it", remembered. */
  done: ReadonlySet<string>;
  /** Moves whose target is on the page right now. */
  present: ReadonlySet<string>;
  /** Moves whose field already holds what they ask for. */
  valued: ReadonlySet<string>;
  /** The data says the step is done: only closing moves are left. */
  stepDataDone: boolean;
}

export type Pick =
  | { kind: "move"; move: Move; index: number }
  | { kind: "view-as"; as: string; after: Move }
  | { kind: "off"; href: string | null; next: Move }
  /** The move's target is not on the page (yet): it may be loading, so the panel waits a moment before skipping it. */
  | { kind: "waiting"; move: Move }
  | { kind: "none" };

/** Whether a move needs nothing more from the visitor: remembered, arrived, filled, not for this page, or the data is done. */
export function isMoveDone(m: Move, i: EngineInput): boolean {
  if (i.stepDataDone && !m.closing) return true;
  if (i.done.has(m.id)) return true;
  if (m.doneWhen === "route" && m.arrive && matches(m.arrive, i.route)) return true;
  if (m.doneWhen === "value" && i.valued.has(m.id)) return true;
  if (m.unless && [m.unless].flat().some((w) => matches(w, i.route))) return true;
  return false;
}

/**
 * The move to show now. The first move not done, in order; it shows when the person and the page are right. Another person: View as comes first
 * (open it, then pick the person). Another page: the visitor is off the path. A move whose target is missing is skipped when optional; if an earlier
 * click opened it (a dialog the visitor closed), that click is offered again; otherwise it is "waiting" (the page may still be loading), and the panel
 * skips it after a moment.
 */
export function pickMove(i: EngineInput): Pick {
  const { moves } = i;
  // A move after one that is remembered as done means the earlier ones are behind the visitor (a field that is gone once its option was picked).
  const lastDone = moves.reduce((last, m, k) => (i.done.has(m.id) ? k : last), -1);
  for (let idx = 0; idx < moves.length; idx++) {
    const m = moves[idx];
    if (idx < lastDone || isMoveDone(m, i)) continue;
    const as = m.as ?? i.stepAs;
    if (i.viewer !== as) return { kind: "view-as", as, after: m };
    if (!matches(m.where, i.route)) return { kind: "off", href: nextHref(moves, idx, i), next: m };
    if (!i.present.has(m.id)) {
      if (m.optional) continue;
      for (let back = idx - 1; back >= 0; back--) {
        const opener = moves[back];
        if (opener.kind === "click" && i.done.has(opener.id) && i.present.has(opener.id) && matches(opener.where, i.route)) return { kind: "move", move: opener, index: back };
      }
      return { kind: "waiting", move: m };
    }
    return { kind: "move", move: m, index: idx };
  }
  return { kind: "none" };
}

/** Where "Back on track" goes: the page of the first move from here on that names one. */
function nextHref(moves: Move[], from: number, i: EngineInput): string | null {
  for (let k = from; k < moves.length; k++) {
    const href = hrefOf(moves[k].where, i.ids);
    if (href) return href;
  }
  return null;
}

/**
 * Skip ahead: the moves to mark done and the page to open. It stops at the first move that is not navigation (a click on Home or on a search
 * result is only the way there), and goes to that move's page as that move's person.
 */
export function skipAhead(i: Omit<EngineInput, "present" | "valued">): { markDone: string[]; href: string | null; as: string; target: Move } | null {
  const full: EngineInput = { ...i, present: new Set(), valued: new Set() };
  const pending = i.moves.filter((m) => !isMoveDone(m, full));
  const target = pending.find((m) => !m.nav) ?? pending[pending.length - 1];
  if (!target) return null;
  const markDone = i.moves.slice(0, i.moves.indexOf(target)).map((m) => m.id);
  return { markDone, href: hrefOf(target.where, i.ids), as: target.as ?? i.stepAs, target };
}
