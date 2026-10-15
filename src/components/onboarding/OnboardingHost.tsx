"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronDown, ChevronRight, ChevronUp, Circle, X } from "lucide-react";

import { apiGet } from "@/lib/api-client";
import {
  CONTINUE_LABEL,
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
  stepHref,
  targetTag,
  type Chapter,
  type ChapterId,
  type OnboardingState,
  type ScenarioId,
  type ScenarioStep,
} from "@/lib/onboarding/content";
import { setScenarioHints } from "@/components/onboarding/hints";
import { StepHighlight } from "@/components/onboarding/StepHighlight";
import { DEMO_USERS, TEAM_LABELS, type Team } from "@/lib/demo-users";
import { Button } from "@/components/ui/button";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
import { readStorage, useIsClient, useIsDesktop, writeStorage } from "@/components/onboarding/storage";
import { cn } from "@/lib/utils";

const POLL_MS = 3_000;
/** How long the anchor of a "viewed" step stays in view before the step counts as done. */
const VIEWED_DWELL_MS = 1_200;
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

function inView(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.height > 0 && r.top < window.innerHeight * 0.9 && r.bottom > 80;
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
  const [seen, setSeen] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);
  const seenRef = React.useRef<string[]>([]);
  const versionRef = React.useRef<number | null>(null);
  const arrivalRef = React.useRef<{ email: string; path: string; refreshed: boolean } | null>(null);
  const panelRef = React.useRef<HTMLElement | null>(null);
  const inViewSince = React.useRef<Record<string, number>>({});
  // Steps the visitor opened by hand (a done step to read again, a later one to read ahead), per chapter.
  const [expanded, setExpanded] = React.useState<{ chapter: ChapterId; ids: string[] }>({ chapter: "1a", ids: [] });
  // Targets the visitor already clicked (or dismissed with Esc), for the current step only.
  const [dismissals, setDismissals] = React.useState<{ step: string; items: string[] }>({ step: "", items: [] });

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
      // After a restore (a new seedVersion) every scenario starts again; otherwise what this tab saw joins what storage remembers.
      const stored = readSeen(res.data.seedVersion);
      const restored = versionRef.current !== null && versionRef.current !== res.data.seedVersion;
      versionRef.current = res.data.seedVersion;
      seenRef.current = restored ? stored : Array.from(new Set([...seenRef.current, ...stored]));
      setSeen(seenRef.current);
    };
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pref.scenario, pathname]);

  // Steps without a row to read are done once their part of the page has been in view, on the right page and as the right person.
  React.useEffect(() => {
    if (pref.scenario === null || !state) return;
    const scenario = SCENARIOS[pref.scenario];
    const chapter = chapterOf(pref.chapter);
    const check = () => {
      const found: string[] = [];
      // Only the step the visitor is on can be read: later ones wait for their turn, so the panel never ticks ahead of the highlight.
      const dataDoneNow = doneFromData(state);
      const idx = currentStepIndex(chapter.steps, (id) => (chapter.steps.find((st) => st.id === id)!.check === "data" ? !!dataDoneNow[id] : seenRef.current.includes(id)));
      for (const step of idx >= 0 ? [chapter.steps[idx]] : []) {
        if (step.check !== "viewed" || seenRef.current.includes(step.id)) continue;
        if (step.needsPersona && currentEmail !== step.persona) continue;
        const href = stepHref(step, scenario.id, state);
        if (!href || pathname !== href) continue;
        const el = document.querySelector(`[data-onboarding="${step.anchor}"]`);
        // Read, not passed: it counts once it has stayed in view for a moment, which is also long enough to see the highlight on it.
        if (el && inView(el)) {
          const since = inViewSince.current[step.id] ?? Date.now();
          inViewSince.current[step.id] = since;
          if (Date.now() - since >= VIEWED_DWELL_MS) found.push(step.id);
        } else delete inViewSince.current[step.id];
      }
      if (!found.length) return;
      seenRef.current = [...seenRef.current, ...found];
      setSeen(seenRef.current);
      writeStorage(STORAGE_KEYS.seen, JSON.stringify({ seedVersion: state.seedVersion, ids: seenRef.current }));
    };
    check();
    const timer = setInterval(check, 600);
    return () => clearInterval(timer);
  }, [pref.scenario, pref.chapter, state, pathname, currentEmail]);

  const scrollToAnchor = React.useCallback((anchor: string) => {
    const started = Date.now();
    const tryScroll = () => {
      const el = document.querySelector(`[data-onboarding="${anchor}"]`);
      if (el) {
        window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 96), behavior: "smooth" });
      } else if (Date.now() - started < 5_000) {
        setTimeout(tryScroll, 200);
      }
    };
    setTimeout(tryScroll, 300);
  }, []);

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

  /** The visitor is already on the step's page as somebody else: switch the person and re-read the page. */
  async function switchHere(step: ScenarioStep) {
    setBusy(step.id);
    try {
      if (await switchPerson(step.persona)) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function takeMeThere(scenarioId: ScenarioId, step: ScenarioStep) {
    const href = stepHref(step, scenarioId, state);
    if (!href) return;
    setBusy(step.id);
    setDismissals({ step: step.id, items: [] }); // a new go: the highlight is there again
    try {
      if (currentEmail !== step.persona && !(await switchPerson(step.persona))) return;
      if (href === pathname) {
        // Already on the page: a refresh re-reads it as the new person; with the same person there is nothing to reload.
        if (currentEmail !== step.persona) router.refresh();
      } else {
        // The layout (demo bar, this panel) keeps the old person until it is refreshed, which the effect below does once the page has arrived:
        // refreshing at once would cancel the navigation.
        if (currentEmail !== step.persona) arrivalRef.current = { email: step.persona, path: href, refreshed: false };
        router.push(href);
      }
      scrollToAnchor(step.anchor);
    } finally {
      setBusy(null);
    }
  }

  function runScenario(id: ScenarioId) {
    dismissWelcome();
    setPanel({ ...pref, scenario: id, chapter: FIRST_CHAPTER[id], collapsed: false });
  }

  const scenario = pref.scenario ? SCENARIOS[pref.scenario] : null;
  const chapter: Chapter | null = scenario ? chapterOf(pref.chapter) : null;
  const dataDone = doneFromData(state);
  const isDone = (s: ScenarioStep) => (s.check === "data" ? !!dataDone[s.id] : seen.includes(s.id));
  const doneCount = chapter ? chapter.steps.filter(isDone).length : 0;
  const allDone = !!chapter && doneCount === chapter.steps.length;
  const currentIdx = chapter ? currentStepIndex(chapter.steps, (id) => isDone(chapter.steps.find((st) => st.id === id)!)) : -1;
  const currentStep = chapter && currentIdx >= 0 ? chapter.steps[currentIdx] : null;
  // The story folds itself away once the first step is done; a click on its heading overrides that either way.
  const firstDone = !!chapter && isDone(chapter.steps[0]);
  const prologueOpen = !!chapter && !pref.closedPrologues.includes(chapter.id) && (pref.openedPrologues.includes(chapter.id) || !firstDone);
  const openIds = chapter && expanded.chapter === chapter.id ? expanded.ids : [];
  const toggleStep = (id: string) => chapter && setExpanded({ chapter: chapter.id, ids: openIds.includes(id) ? openIds.filter((x) => x !== id) : [...openIds, id] });
  const dismissedNow = currentStep && dismissals.step === currentStep.id ? dismissals.items : [];
  const highlightOn = !!currentStep && !!scenario && !pref.collapsed && desktop && currentEmail === currentStep.persona && !!state;
  // A click on a button hands the highlight to the next target (a dialog's own button); a click on something to read ends it, since its other targets
  // are only for finding the page.
  const dismissOne = (raw: string) =>
    setDismissals((d) => {
      if (!currentStep) return d;
      if (currentStep.check === "viewed") return { step: currentStep.id, items: currentStep.target };
      return { step: currentStep.id, items: d.step === currentStep.id ? [...d.items, raw] : [raw] };
    });
  const dismissAll = () => currentStep && setDismissals({ step: currentStep.id, items: currentStep.target });

  // When a step ticks the next one opens, and the panel brings it into view.
  const currentKey = chapter && currentStep ? `${chapter.id}:${currentStep.id}` : null;
  React.useEffect(() => {
    if (!currentKey || !panelRef.current) return;
    const li = panelRef.current.querySelector<HTMLElement>(`[data-onboarding-step="${currentKey.split(":")[1]}"]`);
    li?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [currentKey]);

  // Hints next to a form while the step they help with is the open one (see hints.tsx).
  const reportStepOpen = chapter?.id === "2" && !dataDone["s2-report"];
  const draftStepOpen = chapter?.id === "1b" && !dataDone["s1b-share"];
  React.useEffect(() => {
    setScenarioHints({ report: reportStepOpen && !pref.collapsed, draft: draftStepOpen && !pref.collapsed });
    return () => setScenarioHints({ report: false, draft: false });
  }, [reportStepOpen, draftStepOpen, pref.collapsed]);

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
              const href = stepHref(step, scenario.id, state);
              const open = current || openIds.includes(step.id);
              const stateName = done ? "done" : current ? "current" : "later";
              const viewer = DEMO_USERS.find((u) => u.email === currentEmail);
              const wrongPerson = current && !!href && href === pathname && currentEmail !== step.persona;
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
                      {wrongPerson && (
                        <p data-onboarding="wrong-person" className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-sm bg-tint p-2 text-meta text-text">
                          <span>
                            You are viewing as {viewer?.name ?? currentEmail}. This step is {step.personaName}&rsquo;s.
                          </span>
                          <button type="button" onClick={() => void switchHere(step)} disabled={busy === step.id} className="text-link-text hover:underline">
                            Switch to {step.personaName}
                          </button>
                        </p>
                      )}
                      <div data-onboarding="do-this" className="flex flex-col gap-1">
                        <p className="text-label text-text">Do this</p>
                        <ol className="list-decimal pl-5 text-body text-text">
                          {step.doThis.map((line) => (
                            <li key={line}>
                              {splitBold(line).map((part, k) => (part.bold ? <strong key={k} className="font-semibold">{part.text}</strong> : <React.Fragment key={k}>{part.text}</React.Fragment>))}
                            </li>
                          ))}
                        </ol>
                      </div>
                      {(current || done) && (
                        <div className="mt-1">
                          <Button
                            variant="secondary"
                            loading={busy === step.id}
                            disabled={!href}
                            disabledReason={!href ? "Do the earlier step first" : undefined}
                            onClick={() => void takeMeThere(scenario.id, step)}
                          >
                            Take me there
                          </Button>
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

      {highlightOn && currentStep && (
        <StepHighlight
          key={currentStep.id}
          stepId={currentStep.id}
          targets={currentStep.target}
          dismissed={dismissedNow}
          tag={targetTag(currentStep)}
          onDismiss={dismissOne}
          onDismissAll={dismissAll}
        />
      )}
    </>
  );
}
