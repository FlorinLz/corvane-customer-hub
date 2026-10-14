"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronDown, ChevronUp, Circle, X } from "lucide-react";

import { apiGet } from "@/lib/api-client";
import {
  DECISIONS_URL,
  OPEN_WELCOME_EVENT,
  SCENARIOS,
  SCENARIO_END,
  START_HERE_URL,
  STORAGE_KEYS,
  WELCOME,
  doneFromData,
  stepHref,
  type OnboardingState,
  type Scenario,
  type ScenarioId,
  type ScenarioStep,
} from "@/lib/onboarding/content";
import { Button } from "@/components/ui/button";
import { readStorage, useIsClient, writeStorage } from "@/components/onboarding/storage";
import { cn } from "@/lib/utils";

const POLL_MS = 3_000;
const PANEL_WIDTH = 360;

interface PanelPref {
  scenario: ScenarioId | null;
  collapsed: boolean;
}

function readPanel(): PanelPref {
  try {
    const p = JSON.parse(readStorage(STORAGE_KEYS.panel) ?? "null") as Partial<PanelPref> | null;
    if (p && (p.scenario === 1 || p.scenario === 2)) return { scenario: p.scenario, collapsed: !!p.collapsed };
  } catch {
    // fall through
  }
  return { scenario: null, collapsed: false };
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
  const welcome = welcomeChoice ?? (client && readStorage(STORAGE_KEYS.welcomeDismissed) !== "1");
  const pref = prefChoice ?? (client ? readPanel() : { scenario: null, collapsed: false });
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
    const check = () => {
      const found: string[] = [];
      for (const step of scenario.steps) {
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
  }, [pref.scenario, state, pathname, currentEmail]);

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

  async function takeMeThere(scenario: Scenario, step: ScenarioStep) {
    const href = stepHref(step, scenario.id, state);
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
    setPanel({ scenario: id, collapsed: false });
  }

  const scenario = pref.scenario ? SCENARIOS[pref.scenario] : null;
  const dataDone = doneFromData(state);
  const isDone = (s: ScenarioStep) => (s.check === "data" ? !!dataDone[s.id] : seen.includes(s.id));

  return (
    <>
      {welcome && (
        <aside
          role="complementary"
          aria-label="Welcome"
          data-onboarding="welcome-card"
          style={{ right: panelOpen ? PANEL_WIDTH + 16 : 16 }}
          className="fixed bottom-4 z-40 w-[340px] rounded-md border border-border bg-white p-4 shadow-overlay max-[899px]:hidden"
        >
          <div className="flex items-start gap-2">
            <h2 className="flex-1 text-subsection">{WELCOME.title}</h2>
            <button type="button" aria-label="Close welcome card" onClick={dismissWelcome} className="-mr-1 -mt-1 inline-flex size-6 items-center justify-center rounded-sm text-text-secondary hover:bg-tint">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <p className="mt-2 text-body">{WELCOME.intro}</p>
          <p className="mt-2 text-meta text-text-secondary">{WELCOME.by}</p>
          <div className="mt-3 flex flex-col gap-2">
            <Button onClick={() => runScenario(1)}>{WELCOME.scenario1}</Button>
            <Button variant="secondary" onClick={() => runScenario(2)}>
              {WELCOME.scenario2}
            </Button>
            <Button variant="text" onClick={dismissWelcome}>
              {WELCOME.explore}
            </Button>
          </div>
          <p className="mt-2 flex gap-4 text-meta">
            <a href={START_HERE_URL} target="_blank" rel="noopener noreferrer" className="text-link-text hover:underline">
              {WELCOME.howBuilt}
            </a>
            <a href={DECISIONS_URL} target="_blank" rel="noopener noreferrer" className="text-link-text hover:underline">
              {WELCOME.decisions}
            </a>
          </p>
        </aside>
      )}

      {scenario && pref.collapsed && (
        <button
          type="button"
          data-onboarding="scenario-tab"
          onClick={() => setPanel({ scenario: scenario.id, collapsed: false })}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-body shadow-overlay max-[899px]:hidden"
        >
          <ChevronUp className="size-4" aria-hidden />
          Scenario {scenario.id}: {scenario.steps.filter(isDone).length} of {scenario.steps.length} done
        </button>
      )}

      {scenario && !pref.collapsed && (
        <aside
          role="complementary"
          aria-label={`Scenario ${scenario.id}`}
          data-onboarding="scenario-panel"
          style={{ width: PANEL_WIDTH }}
          className="fixed inset-y-0 right-0 z-30 flex flex-col overflow-y-auto border-l border-border bg-white max-[899px]:hidden"
        >
          <div className="flex items-start gap-2 border-b border-border p-4">
            <div className="flex-1">
              <p className="text-meta text-text-secondary">
                Scenario {scenario.id} of 2 · {scenario.steps.filter(isDone).length} of {scenario.steps.length} done
              </p>
              <h2 className="mt-1 text-subsection">{scenario.title}</h2>
              <p className="mt-1 text-meta text-text-secondary">{scenario.subtitle}</p>
            </div>
            <button type="button" aria-label="Collapse the scenario panel" onClick={() => setPanel({ scenario: scenario.id, collapsed: true })} className="inline-flex size-6 items-center justify-center rounded-sm text-text-secondary hover:bg-tint">
              <ChevronDown className="size-4" aria-hidden />
            </button>
            <button type="button" aria-label="Close the scenario panel" onClick={() => setPanel({ scenario: null, collapsed: false })} className="inline-flex size-6 items-center justify-center rounded-sm text-text-secondary hover:bg-tint">
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <ol className="flex flex-col">
            {scenario.steps.map((step, i) => {
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
                      {step.optional && <span className="ml-2 text-meta font-normal text-text-secondary">Optional</span>}
                    </p>
                    <p className="text-body text-text-secondary">{step.text}</p>
                    <div className="mt-1">
                      <Button
                        variant="secondary"
                        loading={busy === step.id}
                        disabled={!href}
                        disabledReason={!href ? "Do the earlier step first" : undefined}
                        onClick={() => void takeMeThere(scenario, step)}
                      >
                        Take me there
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-auto flex flex-col gap-2 p-4 text-meta">
            <button type="button" className="self-start text-link-text hover:underline" onClick={() => setPanel({ scenario: scenario.id === 1 ? 2 : 1, collapsed: false })}>
              Switch to scenario {scenario.id === 1 ? 2 : 1}
            </button>
            <a href={START_HERE_URL} target="_blank" rel="noopener noreferrer" className="self-start text-link-text hover:underline">
              {SCENARIO_END}
            </a>
          </div>
        </aside>
      )}
    </>
  );
}
