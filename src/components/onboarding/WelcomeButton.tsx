"use client";

import { OPEN_WELCOME_EVENT } from "@/lib/onboarding/content";

/** The "?" in the demo bar: shows the welcome card again. */
export function WelcomeButton() {
  return (
    <button
      type="button"
      data-onboarding="welcome-button"
      aria-label="About this demo"
      title="About this demo"
      onClick={() => window.dispatchEvent(new Event(OPEN_WELCOME_EVENT))}
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-white/50 text-meta font-semibold text-white hover:bg-white/15 max-[899px]:hidden"
    >
      ?
    </button>
  );
}
