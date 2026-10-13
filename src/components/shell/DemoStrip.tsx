import { DemoClock } from "@/components/shell/DemoClock";
import { ViewAsSwitcher } from "@/components/shell/ViewAsSwitcher";

// Brief 5.2 layout region 1: demo strip, only when DEMO_MODE=true. No demo
// data banner anywhere else in the app. The strip has no 1024px override,
// so the padding stays flat (unlike the top bar). The fictional-data notice
// sits at the right, before the "View as" switcher.
export function DemoStrip({ currentEmail, serverNow }: { currentEmail: string; serverNow: Date }) {
  return (
    <div className="flex h-8 items-center gap-3 whitespace-nowrap bg-primary-dark px-6 text-meta text-white">
      <span className="shrink-0 font-semibold">Demo mode</span>
      <DemoClock serverNow={serverNow} />
      {/* The notice takes the space between the clock and "View as" and gives way first: it truncates, with the full text as its title. */}
      <span className="min-w-0 flex-1 truncate text-right text-white/70" title="Demo with fictional data. Bank names are illustrative; the incidents are invented.">
        Demo with fictional data. Bank names are illustrative; the incidents are invented.
      </span>
      <label htmlFor="view-as" className="shrink-0 text-white/85">
        View as
      </label>
      <ViewAsSwitcher id="view-as" currentEmail={currentEmail} />
    </div>
  );
}
