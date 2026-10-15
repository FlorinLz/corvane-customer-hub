import { DemoClock } from "@/components/shell/DemoClock";
import { WelcomeButton } from "@/components/onboarding/WelcomeButton";
import { StartOverButton } from "@/components/shell/StartOverButton";
import { ViewAsSwitcher } from "@/components/shell/ViewAsSwitcher";

// Brief 5.2 layout region 1: demo strip, only when DEMO_MODE=true. No demo
// data banner anywhere else in the app. The strip has no 1024px override,
// so the padding stays flat (unlike the top bar). The fictional-data notice
// sits at the right, before the "View as" switcher.
const FICTIONAL = "Demo with fictional data. Bank names are illustrative; the incidents are invented.";
const RESETS = "The demo resets after 20 minutes without changes.";

// `sandbox`: the visitor has their own copy of the demo (24 hours, Start over). `shared`: sandboxes are on but one could not be made, so the visitor is
// on the shared demo with the idle restore.
export function DemoStrip({ currentEmail, serverNow, sandbox = false, shared = false }: { currentEmail: string; serverNow: Date; sandbox?: boolean; shared?: boolean }) {
  const notice = sandbox
    ? `${FICTIONAL} This copy of the demo is yours for 24 hours.`
    : shared
      ? `Shared demo: other visitors may be using it. ${FICTIONAL} ${RESETS}`
      : `${FICTIONAL} ${RESETS}`;
  return (
    <div className="flex h-8 items-center gap-3 whitespace-nowrap bg-primary-dark px-6 text-meta text-white">
      <span className="shrink-0 font-semibold">Demo mode</span>
      <DemoClock serverNow={serverNow} />
      {/* The notice takes the space between the clock and "View as" and gives way first: it truncates, with the full text as its title. */}
      <span className="min-w-0 flex-1 truncate text-right text-white/70" title={notice} data-testid="demo-notice">
        {notice}
      </span>
      {sandbox && <StartOverButton />}
      <WelcomeButton />
      <label htmlFor="view-as" className="shrink-0 text-white/85">
        View as
      </label>
      <ViewAsSwitcher id="view-as" currentEmail={currentEmail} />
    </div>
  );
}
