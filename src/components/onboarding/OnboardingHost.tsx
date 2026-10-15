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
  doneFromData,
  stepHref,
  type Chapter,
  type ChapterId,
  type OnboardingState,
  type ScenarioId,
  type ScenarioStep,
} from "@/lib/onboarding/content";
import { setScenarioHints } from "@/components/onboarding/hints";
import { Button } from "@/components/ui/button";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
import { readStorage, useIsClient, useIsDesktop, writeStorage } from "@/components/onboarding/storage";
import { cn } from "@/lib/utils";

const POLL_MS = 3_000;
const PANEL_WIDTH = 360;

interface PanelPref {
  scenario: ScenarioId | null;
  chapter: ChapterId;
  collapsed: boolean;
  /** Chapters whose prologue the visitor folded away: it is open the first time. */
  closedPrologues: ChapterId[];
}

const NO_PANEL: PanelPref = { scenario: null, chapter: "1a", collapsed: false, closedPrologues: [] };
const FIRST_CHAPTER: Record<ScenarioId, ChapterId> = { 1: "1a", 2: "2" };

function readPanel(): PanelPref {
  try {
    const p = JSON.parse(readStorage(STORAGE_KEYS.panel) ?? "null") as Partial<PanelPref> | null;
    if (p && (p.scenario === 1 || p.scenario === 2)) {
      const chapter = SCENARIOS[p.scenario].chapters.some((c) => c.id === p.chapter) ? (p.chapter as ChapterId) : FIRST_CHAPTER[p.scenario];
      return { scenario: p.scenario, chapter, collapsed: !!p.collapsed, closedPrologues: Array.isArray(p.closedPrologues) ? p.closedPrologues : [] };
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
      for (const step of chapter.steps) {
        if (step.check !== "viewed" || seenRef.current.includes(step.id)) continue;
        if (step.needsPersona && currentEmail !== step.persona) continue;
        const href = stepHref(step, scenario.id, state);
        if (!href || pathname !== href) continue;
        const el = document.querySelector(`[data-onboarding="${step.anchor}"]`);
        if (el && inView(el)) found.push(step.id);
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

  async function takeMeThere(scenarioId: ScenarioId, step: ScenarioStep) {
    const href = stepHref(step, scenarioId, state);
    if (!href) return;
    setBusy(step.id);
    try {
      if (currentEmail !== step.persona) {
        const res = await fetch("/api/demo/view-as", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: step.persona }) });
        if (!res.ok) {
          toast.error("Couldn't switch user. Try again.");
          return;
        }
        toast.info(`Now viewing as ${step.personaName}`, { position: "bottom-left" });
      }
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
  const prologueOpen = !!chapter && !pref.closedPrologues.includes(chapter.id);

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
              onClick={() => setPanel({ ...pref, closedPrologues: prologueOpen ? [...pref.closedPrologues, chapter.id] : pref.closedPrologues.filter((c) => c !== chapter.id) })}
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
              const href = stepHref(step, scenario.id, state);
              return (
                <li key={step.id} data-onboarding-step={step.id} data-done={done ? "true" : "false"} className={cn("flex gap-3 border-b border-border p-4", done && "bg-tint")}>
                  <span className={cn("mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border", done ? "border-success bg-success text-white" : "border-border-strong text-text-secondary")}>
                    {done ? <Check className="size-3" aria-label="Done" /> : <Circle className="size-0" aria-hidden />}
                  </span>
                  <div className="flex flex-1 flex-col gap-1">
                    <p className="text-body-strong">
                      {i + 1}. {step.title}
                    </p>
                    <p className="text-body text-text-secondary">{step.text}</p>
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
                  </div>
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
    </>
  );
}
