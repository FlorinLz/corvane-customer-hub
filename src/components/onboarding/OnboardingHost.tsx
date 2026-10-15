"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronDown, ChevronRight, ChevronUp, Circle, X } from "lucide-react";

import { apiGet } from "@/lib/api-client";
import {
  CONTINUE_LABEL,
  EVENT_DATE_TOKEN,
  EVENT_TIME_TOKEN,
  EXAMPLE_LINK_TOKEN,
  FINISH_LABEL,
  OPEN_WELCOME_EVENT,
  SCENARIOS,
  SCENARIO_END,
  START_HERE_URL,
  STORAGE_KEYS,
  chapterOf,
  currentStepIndex,
  doneFromData,
  splitBold,
  type Chapter,
  type ChapterId,
  type OnboardingState,
  type ScenarioId,
  type ScenarioStep,
} from "@/lib/onboarding/content";
import { matches, pickMove, routeOf, skipAhead, type EngineInput, type Move, type RouteIds } from "@/lib/onboarding/engine";
import { fieldIsFilled, fillField } from "@/lib/onboarding/field";
import { exampleDraftLink } from "@/components/onboarding/example-link";
import { MoveGuide, findTarget, type GuideBubble } from "@/components/onboarding/MoveGuide";
import { DEMO_USERS, TEAM_LABELS, type Team } from "@/lib/demo-users";
import { now } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
import { readStorage, useIsClient, useIsDesktop, writeStorage } from "@/components/onboarding/storage";
import { cn } from "@/lib/utils";

const POLL_MS = 3_000;
/** A guide must stay the same this long before its bubble shows. */
const GUIDE_SETTLE_MS = 400;
/** How long a move whose target is missing is waited for (the page may still be loading) before it is skipped. */
const WAIT_BEFORE_SKIP_MS = 3_000;
const PANEL_WIDTH = 360;

interface PanelPref {
  scenario: ScenarioId | null;
  chapter: ChapterId;
  collapsed: boolean;
  /** Chapters whose prologue the visitor folded away. */
  closedPrologues: ChapterId[];
  /** Chapters whose prologue the visitor opened again after it folded itself away (it does that once the first step is done). */
  openedPrologues: ChapterId[];
}

const NO_PANEL: PanelPref = { scenario: null, chapter: "1a", collapsed: false, closedPrologues: [], openedPrologues: [] };
const FIRST_CHAPTER: Record<ScenarioId, ChapterId> = { 1: "1a", 2: "2" };

function readPanel(): PanelPref {
  try {
    const p = JSON.parse(readStorage(STORAGE_KEYS.panel) ?? "null") as Partial<PanelPref> | null;
    if (p && (p.scenario === 1 || p.scenario === 2)) {
      const chapter = SCENARIOS[p.scenario].chapters.some((c) => c.id === p.chapter) ? (p.chapter as ChapterId) : FIRST_CHAPTER[p.scenario];
      return { scenario: p.scenario, chapter, collapsed: !!p.collapsed, closedPrologues: Array.isArray(p.closedPrologues) ? p.closedPrologues : [], openedPrologues: Array.isArray(p.openedPrologues) ? p.openedPrologues : [] };
    }
  } catch {
    // fall through
  }
  return NO_PANEL;
}

/** The steps the browser has seen, kept until the next restore (the server's seedVersion changes). */
function readSeen(seedVersion: number): string[] {
  try {
    const s = JSON.parse(readStorage(STORAGE_KEYS.seen) ?? "null") as { seedVersion?: number; ids?: string[] } | null;
    if (s && s.seedVersion === seedVersion && Array.isArray(s.ids)) return s.ids;
  } catch {
    // fall through
  }
  return [];
}

/**
 * The welcome card (first visit, and again from the demo bar's "?") and the scenario panel. Both sit outside the page's flow: the card is
 * a small fixed box that never covers a dialog, the panel reserves its 360 px by padding the body (html[data-onboarding-panel], globals.css),
 * so the app is never hidden behind either. Demo only.
 */
export function OnboardingHost({ currentEmail }: { currentEmail: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const client = useIsClient();
  // null = not decided by anything this tab did yet: the browser's storage decides, and only after hydration.
  const [welcomeChoice, setWelcomeChoice] = React.useState<boolean | null>(null);
  const [prefChoice, setPrefChoice] = React.useState<PanelPref | null>(null);
  const desktop = useIsDesktop();
  const welcome = welcomeChoice ?? (client && readStorage(STORAGE_KEYS.welcomeDismissed) !== "1");
  const pref = prefChoice ?? (client ? readPanel() : NO_PANEL);
  const [state, setState] = React.useState<OnboardingState | null>(null);
  const [moveDone, setMoveDone] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const versionRef = React.useRef<number | null>(null);
  const arrivalRef = React.useRef<{ email: string; path: string; refreshed: boolean } | null>(null);
  const panelRef = React.useRef<HTMLElement | null>(null);
  const waitingRef = React.useRef<Record<string, number>>({});
  const sigRef = React.useRef<{ key: string | null; since: number }>({ key: null, since: 0 });
  // The guide that has been the same for a moment: a bubble that flickers while a page changes under it is not shown.
  const [stableKey, setStableKey] = React.useState<string | null>(null);
  // Steps the visitor opened by hand (a done step to read again, a later one to read ahead), per chapter.
  const [expanded, setExpanded] = React.useState<{ chapter: ChapterId; ids: string[] }>({ chapter: "1a", ids: [] });
  // The move whose guide the visitor hid with Esc.
  const [hiddenFor, setHiddenFor] = React.useState<string | null>(null);
  // What the page shows right now for the moves of the step the visitor is on (read a few times a second).
  const [dom, setDom] = React.useState<{ present: string[]; valued: string[]; optionOpen: boolean; viewAsOpen: boolean; viewer: string | null }>({ present: [], valued: [], optionOpen: false, viewAsOpen: false, viewer: null });

  React.useEffect(() => {
    const a = arrivalRef.current;
    if (!a || pathname !== a.path) return;
    if (currentEmail === a.email) arrivalRef.current = null;
    else if (!a.refreshed) {
      a.refreshed = true;
      router.refresh();
    }
  }, [pathname, currentEmail, router]);

  // First load: the card shows unless it was dismissed before. With storage blocked nothing is remembered, so it shows once per page load.
  React.useEffect(() => {
    const open = () => setWelcomeChoice(true);
    window.addEventListener(OPEN_WELCOME_EVENT, open);
    return () => window.removeEventListener(OPEN_WELCOME_EVENT, open);
  }, []);

  const setPanel = React.useCallback((next: PanelPref) => {
    setPrefChoice(next);
    writeStorage(STORAGE_KEYS.panel, JSON.stringify(next));
  }, []);

  const dismissWelcome = React.useCallback(() => {
    setWelcomeChoice(false);
    writeStorage(STORAGE_KEYS.welcomeDismissed, "1");
  }, []);

  const panelOpen = pref.scenario !== null && !pref.collapsed;
  React.useEffect(() => {
    if (panelOpen) document.documentElement.dataset.onboardingPanel = "open";
    else delete document.documentElement.dataset.onboardingPanel;
    return () => {
      delete document.documentElement.dataset.onboardingPanel;
    };
  }, [panelOpen]);

  // The data checks: read when the panel is open, again every few seconds, and after each navigation.
  React.useEffect(() => {
    if (pref.scenario === null) return;
    let cancelled = false;
    const load = async () => {
      const res = await apiGet<OnboardingState>("/api/onboarding/state");
      if (cancelled || !res.ok) return;
      setState(res.data);
      // After a restore (a new seedVersion) every scenario starts again; otherwise what this tab did joins what storage remembers.
      const stored = readSeen(res.data.seedVersion);
      const restored = versionRef.current !== null && versionRef.current !== res.data.seedVersion;
      versionRef.current = res.data.seedVersion;
      setMoveDone((prev) => (restored ? stored : Array.from(new Set([...prev, ...stored]))));
    };
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pref.scenario, pathname]);

  /** Remembers moves as done (until the next restore). */
  const markDone = React.useCallback((ids: string[]) => {
    setMoveDone((prev) => (ids.every((id) => prev.includes(id)) ? prev : Array.from(new Set([...prev, ...ids]))));
  }, []);
  const seedVersion = state?.seedVersion ?? null;
  React.useEffect(() => {
    if (seedVersion !== null) writeStorage(STORAGE_KEYS.seen, JSON.stringify({ seedVersion, ids: moveDone }));
  }, [moveDone, seedVersion]);

  const scenario = pref.scenario ? SCENARIOS[pref.scenario] : null;
  const chapter: Chapter | null = scenario ? chapterOf(pref.chapter) : null;
  const dataDone = doneFromData(state);
  const ids: RouteIds = {
    iss1042: state?.scenario1.issueId ?? null,
    partnerIssue: state?.scenario2.issueId ?? null,
    revolutIssue: state?.scenario2.revolutIssueId ?? null,
    lloyds: state?.scenario2.partnerEntityId ?? null,
  };
  const route = routeOf(pathname, ids);
  const doneSet = new Set(moveDone);
  // A step is done when its data says so (and its closing words are read), or, with no row to read, when every move is.
  const closingRead = (st: ScenarioStep) => st.moves.filter((m) => m.closing).every((m) => doneSet.has(m.id));
  const isDone = (st: ScenarioStep) => (st.check === "data" ? !!dataDone[st.id] && closingRead(st) : st.moves.every((m) => doneSet.has(m.id)));
  const doneCount = chapter ? chapter.steps.filter(isDone).length : 0;
  const allDone = !!chapter && doneCount === chapter.steps.length;
  const currentIdx = chapter ? currentStepIndex(chapter.steps, (id) => isDone(chapter.steps.find((st) => st.id === id)!)) : -1;
  const currentStep = chapter && currentIdx >= 0 ? chapter.steps[currentIdx] : null;
  const engine: EngineInput | null = currentStep
    ? {
        moves: currentStep.moves,
        stepAs: currentStep.persona,
        viewer: dom.viewer ?? currentEmail,
        route,
        ids,
        done: doneSet,
        present: new Set(dom.present),
        valued: new Set(dom.valued),
        stepDataDone: currentStep.check === "data" && !!dataDone[currentStep.id],
      }
    : null;
  const pick = engine ? pickMove(engine) : null;

  // What the page shows for the current step's moves, and the moves that are done by where the visitor is (arrived, filled, skipped).
  const stepKey = currentStep?.id ?? null;
  React.useEffect(() => {
    if (!currentStep || !state || pref.scenario === null || pref.collapsed) return;
    const moves = currentStep.moves;
    const rt = routeOf(pathname, ids);
    const base = { moves, stepAs: currentStep.persona, viewer: currentEmail, route: rt, ids, stepDataDone: false } as const;
    const tick = () => {
      const present: string[] = [];
      const valued: string[] = [];
      for (const m of moves) {
        const el = findTarget(m.target, ids);
        if (el) {
          present.push(m.id);
          if (m.doneWhen === "value" && fieldIsFilled(el, m)) valued.push(m.id);
        }
      }
      // Who View as shows: it changes the moment a person is picked, before the page has been read again as them.
      const shown = findTarget("view-as", ids)?.textContent ?? "";
      const viewer = DEMO_USERS.find((u) => shown.includes(u.name))?.email ?? null;
      const viewAs = DEMO_USERS.find((u) => u.email === currentStep.persona);
      const viewAsOpen = !!viewAs && !!findTarget(`option~${viewAs.name}`, ids);
      const pickMoveNow = pickMove({ ...base, viewer: viewer ?? currentEmail, done: new Set(moveDone), present: new Set(present), valued: new Set(valued), stepDataDone: currentStep.check === "data" && !!doneFromData(state)[currentStep.id] });
      const key = guideKeyOf(pickMoveNow, viewAsOpen);
      if (sigRef.current.key !== key) {
        sigRef.current = { key, since: Date.now() };
        setStableKey(null);
      } else if (key && Date.now() - sigRef.current.since >= GUIDE_SETTLE_MS) setStableKey(key);
      // A move whose target does not show up for a moment (nothing to offer again) is skipped: it was done some other way.
      if (pickMoveNow.kind === "waiting") {
        const since = waitingRef.current[pickMoveNow.move.id] ?? Date.now();
        waitingRef.current[pickMoveNow.move.id] = since;
        if (Date.now() - since > WAIT_BEFORE_SKIP_MS) markDone([pickMoveNow.move.id]);
      } else waitingRef.current = {};
      const optionOpen = pickMoveNow.kind === "move" && !!pickMoveNow.move.option && !!findTarget(`option~${pickMoveNow.move.option}`, ids);
      setDom((prev) => {
        const next = { present, valued, optionOpen, viewAsOpen, viewer };
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      });
      // Done by where the visitor is: remembered, so a later page does not undo it.
      const auto = moves
        .filter((m) => (m.doneWhen === "route" && m.arrive && matches(m.arrive, rt)) || (m.unless && [m.unless].flat().some((w) => matches(w, rt))) || (currentStep.check === "viewed" && valued.includes(m.id)))
        .map((m) => m.id);
      if (auto.length) markDone(auto);
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey, state, pathname, currentEmail, pref.scenario, pref.collapsed, markDone, moveDone]);

  /** Switches View as with the demo's own route. Returns false (and says so) when it fails. */
  async function switchPerson(email: string): Promise<boolean> {
    const res = await fetch("/api/demo/view-as", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    if (!res.ok) {
      toast.error("Couldn't switch user. Try again.");
      return false;
    }
    const body = (await res.json().catch(() => null)) as { data?: { name?: string; team?: Team } } | null;
    const user = DEMO_USERS.find((u) => u.email === email);
    const name = body?.data?.name ?? user?.name ?? email;
    const team = body?.data?.team ?? user?.team;
    toast.info(`You are now ${name}${team ? ` (${TEAM_LABELS[team]})` : ""}`, { position: "bottom-left" });
    return true;
  }

  /** Skip ahead: mark the way there as done, switch the person if the move is somebody else's, and open its page. */
  async function skip() {
    if (!currentStep || !engine) return;
    const r = skipAhead(engine);
    if (!r) return;
    setBusy(true);
    try {
      markDone(r.markDone);
      setHiddenFor(null);
      const switched = r.as !== currentEmail;
      if (switched && !(await switchPerson(r.as))) return;
      if (r.href && r.href !== pathname) {
        // The layout (demo bar, this panel) keeps the old person until it is refreshed, which the effect above does once the page has arrived:
        // refreshing at once would cancel the navigation.
        if (switched) arrivalRef.current = { email: r.as, path: r.href.split("?")[0], refreshed: false };
        router.push(r.href);
      } else if (switched) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function runScenario(id: ScenarioId) {
    dismissWelcome();
    setPanel({ ...pref, scenario: id, chapter: FIRST_CHAPTER[id], collapsed: false });
  }

  // The story folds itself away once the first step is done; a click on its heading overrides that either way.
  const firstDone = !!chapter && isDone(chapter.steps[0]);
  const prologueOpen = !!chapter && !pref.closedPrologues.includes(chapter.id) && (pref.openedPrologues.includes(chapter.id) || !firstDone);
  const openIds = chapter && expanded.chapter === chapter.id ? expanded.ids : [];
  const toggleStep = (id: string) => chapter && setExpanded({ chapter: chapter.id, ids: openIds.includes(id) ? openIds.filter((x) => x !== id) : [...openIds, id] });

  // What the guide says now, and where it points.
  const viewAsUser = pick?.kind === "view-as" ? DEMO_USERS.find((u) => u.email === pick.as) : undefined;
  const viewAsLabel = viewAsUser ? `${TEAM_LABELS[viewAsUser.team]} · ${viewAsUser.name}` : "";
  let guide: { key: string; targets: string[]; bubble: GuideBubble; text: string } | null = null;
  if (pick?.kind === "move" && currentStep) {
    const m = pick.move;
    const say = m.kind === "pick" && !dom.optionOpen && m.sayOpen ? m.sayOpen : m.say;
    guide = {
      key: guideKeyOf(pick, dom.viewAsOpen) ?? m.id,
      targets: m.kind === "pick" && m.option ? [`option~${m.option}`, m.target] : [m.target],
      text: say,
      bubble: {
        say,
        counter: `${pick.index + 1} of ${currentStep.moves.length}`,
        kind: m.kind,
        suggestion: m.fill ? suggestionFor(m) : undefined,
        onGotIt: () => markDone([m.id]),
        onFill: (el) => {
          fillField(el, m, resolveFill(m.fill ?? "", el));
        },
      },
    };
  } else if (pick?.kind === "view-as" && viewAsUser) {
    const text = dom.viewAsOpen ? `Pick **${viewAsLabel}**` : "Open **View as**";
    guide = {
      key: guideKeyOf(pick, dom.viewAsOpen) ?? "",
      targets: dom.viewAsOpen ? [`option~${viewAsUser.name}`] : ["view-as"],
      text,
      bubble: { say: text, counter: "View as", kind: "click" },
    };
  }
  const guideOn = !!guide && guide.key === stableKey && !pref.collapsed && desktop && !!state && pref.scenario !== null;

  const goChapter = (id: ChapterId) => {
    const sc = chapterOf(id).scenario;
    setPanel({ ...pref, scenario: sc, chapter: id, collapsed: false });
  };

  return (
    <>
      {welcome && desktop && <WelcomeModal onClose={dismissWelcome} onRun={runScenario} />}

      {scenario && chapter && pref.collapsed && (
        <button
          type="button"
          data-onboarding="scenario-tab"
          onClick={() => setPanel({ ...pref, collapsed: false })}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-body shadow-overlay max-[899px]:hidden"
        >
          <ChevronUp className="size-4" aria-hidden />
          Scenario {scenario.id}: {doneCount} of {chapter.steps.length} done
        </button>
      )}

      {scenario && chapter && !pref.collapsed && (
        <aside
          ref={panelRef}
          role="complementary"
          aria-label={`Scenario ${scenario.id}`}
          data-onboarding="scenario-panel"
          data-chapter={chapter.id}
          style={{ width: PANEL_WIDTH }}
          className="fixed inset-y-0 right-0 z-30 flex flex-col overflow-y-auto border-l border-border bg-white max-[899px]:hidden"
        >
          <div className="flex items-start gap-2 border-b border-border p-4">
            <div className="flex-1">
              <p className="text-meta text-text-secondary">
                Scenario {scenario.id} of 2{chapter.title ? ` · ${chapter.title}` : ""} · {doneCount} of {chapter.steps.length} done
              </p>
              <h2 className="mt-1 text-subsection">{scenario.title}</h2>
            </div>
            <button type="button" aria-label="Collapse the scenario panel" onClick={() => setPanel({ ...pref, collapsed: true })} className="inline-flex size-6 items-center justify-center rounded-sm text-text-secondary hover:bg-tint">
              <ChevronDown className="size-4" aria-hidden />
            </button>
            <button type="button" aria-label="Close the scenario panel" onClick={() => setPanel({ ...pref, scenario: null, collapsed: false })} className="inline-flex size-6 items-center justify-center rounded-sm text-text-secondary hover:bg-tint">
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <section data-onboarding="prologue" aria-label="Prologue" className="border-b border-border bg-tint p-4">
            <button
              type="button"
              aria-expanded={prologueOpen}
              onClick={() =>
                setPanel({
                  ...pref,
                  closedPrologues: prologueOpen ? [...pref.closedPrologues, chapter.id] : pref.closedPrologues.filter((c) => c !== chapter.id),
                  openedPrologues: prologueOpen ? pref.openedPrologues.filter((c) => c !== chapter.id) : [...pref.openedPrologues, chapter.id],
                })
              }
              className="flex w-full items-center gap-1 text-left text-label text-primary"
            >
              {prologueOpen ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
              {chapter.title ?? "The story"}
            </button>
            {prologueOpen && (
              <div className="mt-2 flex flex-col gap-2 text-body text-text">
                {chapter.prologue.map((t) => (
                  <p key={t}>{t}</p>
                ))}
                {chapter.signal && (
                  <div data-onboarding="signal-card" className="mt-1 flex flex-col gap-1 rounded-md border border-border bg-white p-3">
                    <p className="text-meta text-text-secondary">
                      From: <span className="text-text">{chapter.signal.from}</span>
                    </p>
                    <p className="text-meta text-text-secondary">
                      Subject: <span className="text-text">{chapter.signal.subject}</span>
                    </p>
                    <p className="mt-1 text-body">{chapter.signal.body}</p>
                    <p className="mt-1 text-meta text-text-secondary">{chapter.signal.footnote}</p>
                  </div>
                )}
              </div>
            )}
          </section>

          <ol className="flex flex-col">
            {chapter.steps.map((step, i) => {
              const done = isDone(step);
              const current = i === currentIdx;
              const open = current || openIds.includes(step.id);
              const stateName = done ? "done" : current ? "current" : "later";
              return (
                <li
                  key={step.id}
                  data-onboarding-step={step.id}
                  data-done={done ? "true" : "false"}
                  data-state={stateName}
                  aria-current={current ? "step" : undefined}
                  className={cn("border-b border-border", done && "bg-tint", current && "border-l-4 border-l-link-text")}
                >
                  {current ? null : (
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => toggleStep(step.id)}
                      className={cn("flex w-full items-center gap-3 p-3 text-left hover:bg-tint", !done && "px-4 text-text-secondary")}
                    >
                      <span className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-full border", done ? "border-success bg-success text-white" : "border-border-strong text-text-secondary")}>
                        {done ? <Check className="size-3" aria-label="Done" /> : <Circle className="size-0" aria-hidden />}
                      </span>
                      <span className={cn("flex-1 text-body", done ? "text-body-strong text-text" : "")}>
                        {i + 1}. {step.title}
                      </span>
                      {!done && <span className="text-meta text-text-secondary">Waiting</span>}
                    </button>
                  )}
                  {open && (
                    <div className={cn("flex flex-col gap-2 pb-4 pr-4", current ? "pl-3 pt-4" : "pl-12")} data-onboarding-open={step.id}>
                      {current && (
                        <p className="flex items-start gap-3 text-body-strong">
                          <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-link-text text-meta text-link-text" aria-hidden>
                            {i + 1}
                          </span>
                          <span>{step.title}</span>
                        </p>
                      )}
                      <p className="text-[13px] leading-5 text-text-secondary">{step.text}</p>
                      {current && pick?.kind === "off" && (
                        <div data-onboarding="off-path" className="flex flex-col items-start gap-2 rounded-sm bg-tint p-2 text-body">
                          <p>You are off the path.</p>
                          <Button variant="secondary" disabled={!pick.href} onClick={() => pick.href && router.push(pick.href)}>
                            Back on track
                          </Button>
                        </div>
                      )}
                      {current && guide && (
                        <p data-onboarding="now" className="text-body text-text" aria-live="polite">
                          <span className="font-semibold">Now: </span>
                          {splitBold(guide.text).map((part, k) => (part.bold ? <strong key={k} className="font-semibold">{part.text}</strong> : <React.Fragment key={k}>{part.text}</React.Fragment>))}
                        </p>
                      )}
                      {current && (
                        <div className="flex items-center gap-4 text-meta">
                          {guide && (
                            <button type="button" data-onboarding="show-me" onClick={() => setHiddenFor(null)} className="text-link-text hover:underline">
                              Show me
                            </button>
                          )}
                          <button type="button" data-onboarding="skip-ahead" disabled={busy} onClick={() => void skip()} className="text-link-text hover:underline">
                            Skip ahead
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {allDone && (
            <section data-onboarding="chapter-end" className="border-b border-border p-4">
              <p className="text-body">{chapter.end.text}</p>
              <div className="mt-3 flex flex-col gap-2">
                {chapter.end.actions.includes("continue") && (
                  <Button onClick={() => goChapter("1b")}>{CONTINUE_LABEL}</Button>
                )}
                {chapter.end.actions.includes("finish") && (
                  <Button variant="secondary" onClick={() => setPanel({ ...pref, scenario: null, collapsed: false })}>
                    {FINISH_LABEL}
                  </Button>
                )}
                {chapter.end.actions.includes("built") && (
                  <a href={START_HERE_URL} target="_blank" rel="noopener noreferrer" className="self-start text-meta text-link-text hover:underline">
                    {SCENARIO_END}
                  </a>
                )}
              </div>
            </section>
          )}

          <div className="mt-auto flex flex-col gap-2 p-4 text-meta">
            {chapter.id === "1a" && !allDone && dataDone["s1-update"] && (
              <button type="button" className="self-start text-link-text hover:underline" onClick={() => goChapter("1b")}>
                Go to chapter 2: Closing the loop
              </button>
            )}
            {chapter.id === "1b" && (
              <button type="button" className="self-start text-link-text hover:underline" onClick={() => goChapter("1a")}>
                Back to chapter 1: The morning after
              </button>
            )}
            <button type="button" className="self-start text-link-text hover:underline" onClick={() => goChapter(scenario.id === 1 ? "2" : "1a")}>
              Switch to scenario {scenario.id === 1 ? 2 : 1}
            </button>
            {!allDone && (
              <a href={START_HERE_URL} target="_blank" rel="noopener noreferrer" className="self-start text-link-text hover:underline">
                {SCENARIO_END}
              </a>
            )}
          </div>
        </aside>
      )}

      {guideOn && guide && (
        <MoveGuide
          key={guide.key}
          moveId={guide.key}
          targets={guide.targets}
          ids={ids}
          bubble={guide.bubble}
          hidden={hiddenFor === guide.key}
          onTargetClick={() => {
            if (pick?.kind === "move" && pick.move.doneWhen === "click") markDone([pick.move.id]);
          }}
          onEsc={() => setHiddenFor(guide.key)}
        />
      )}
    </>
  );
}

/** Which guide a pick is: a move, or one phase of View as. Null when there is none. */
function guideKeyOf(pick: ReturnType<typeof pickMove>, viewAsOpen: boolean): string | null {
  if (pick.kind === "move") return pick.move.id;
  if (pick.kind === "view-as") return `view-as:${pick.after.id}:${viewAsOpen ? "pick" : "open"}`;
  return null;
}

/** The text a "type" move suggests, as the bubble shows it. */
function suggestionFor(m: Move): string {
  const fill = m.fill ?? "";
  if (fill === EXAMPLE_LINK_TOKEN) return exampleDraftLink();
  if (fill === EVENT_DATE_TOKEN || fill === EVENT_TIME_TOKEN) return resolveFill(fill, null);
  return fill;
}

/** `fill` with its tokens resolved: the example link, or the event date or time (the field's zone, 90 minutes before the demo's now). */
function resolveFill(fill: string, el: Element | null): string {
  if (fill === EXAMPLE_LINK_TOKEN) return exampleDraftLink();
  if (fill !== EVENT_DATE_TOKEN && fill !== EVENT_TIME_TOKEN) return fill;
  const zone = el?.getAttribute("data-zone") ?? "UTC";
  const at = new Date(now().getTime() - 90 * 60_000);
  if (fill === EVENT_DATE_TOKEN) return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  return new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
}
