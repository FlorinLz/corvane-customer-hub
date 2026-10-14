"use client";

import * as React from "react";
import { X } from "lucide-react";

import { MOBILE_NOTICE, START_HERE_URL, STORAGE_KEYS } from "@/lib/onboarding/content";
import { readStorage, useIsClient, writeStorage } from "@/components/onboarding/storage";

/** Below 900 px: a dismissible notice at the top. The layouts are not rebuilt for mobile. */
export function MobileNotice() {
  const client = useIsClient();
  const [closed, setClosed] = React.useState(false);

  // Not on the server's render: the browser's storage decides.
  if (!client || closed || readStorage(STORAGE_KEYS.mobileDismissed) === "1") return null;
  return (
    <div role="status" data-onboarding="mobile-notice" className="flex items-start gap-3 bg-highlight/20 px-4 py-3 text-body text-text min-[900px]:hidden">
      <p className="flex-1">
        {MOBILE_NOTICE}{" "}
        <a href={START_HERE_URL} target="_blank" rel="noopener noreferrer" className="text-link-text underline">
          Read the README
        </a>
      </p>
      <button
        type="button"
        aria-label="Dismiss notice"
        className="-mr-1 inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-text-secondary hover:bg-tint"
        onClick={() => {
          setClosed(true);
          writeStorage(STORAGE_KEYS.mobileDismissed, "1");
        }}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
