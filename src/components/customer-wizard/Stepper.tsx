import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const STEPS = [
  { n: 1, long: "Entity and LEI", short: "Entity" },
  { n: 2, long: "Products, countries and commercial terms", short: "Products" },
  { n: 3, long: "Initial contacts", short: "Contacts" },
  { n: 4, long: "Handoff summary and Onboarding Manager", short: "Handoff" },
] as const;

/** The stepper: current / done / todo. */
export function Stepper({ current }: { current: number }) {
  return (
    <nav aria-label="Progress" className="flex items-center gap-2 overflow-x-auto py-2">
      {STEPS.map((step, i) => {
        const state = step.n < current ? "done" : step.n === current ? "cur" : "todo";
        return (
          <div key={step.n} className="flex items-center gap-2">
            <span className="flex items-center gap-2" aria-current={state === "cur" ? "step" : undefined}>
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-meta font-medium",
                  state === "done" && "bg-primary text-white",
                  state === "cur" && "bg-primary text-white",
                  state === "todo" && "bg-neutral-200 text-text-secondary",
                )}
              >
                {state === "done" ? <Check className="size-3.5" aria-hidden="true" /> : step.n}
              </span>
              <span className={cn("text-meta", state === "cur" ? "font-medium text-text" : "text-text-secondary")}>
                <span className="hidden sm:inline">{step.long}</span>
                <span className="sm:hidden">{step.short}</span>
              </span>
            </span>
            {i < STEPS.length - 1 && <span className="h-px w-6 shrink-0 bg-border" />}
          </div>
        );
      })}
    </nav>
  );
}
