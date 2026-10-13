"use client";

import { Button } from "@/components/ui/button";

/** Brief 6.13.9 issue-flow States: "Couldn't load this issue. Retry". */
export default function IssuePageError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-3 px-6 py-16 text-center">
      <p className="text-body">Couldn&apos;t load this issue.</p>
      <Button variant="secondary" onClick={() => retry()}>
        Retry
      </Button>
    </div>
  );
}
