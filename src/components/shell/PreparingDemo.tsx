"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

// Shown instead of the page while the demo restores itself (idle rule, src/server/demo-idle.ts) or while the visitor's clock catches up
// with a restore. It asks the server to prepare the demo, which waits for a running restore or runs one, and then renders the page.
export function PreparingDemo() {
  const router = useRouter();
  const [failed, setFailed] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/demo/prepare", { method: "POST" })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) router.refresh();
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center text-text" role="status" aria-live="polite">
      <h1 className="text-[20px] font-semibold">{failed ? "The demo is not ready yet" : "Preparing a fresh demo..."}</h1>
      <p className="max-w-md text-body text-text-secondary">
        {failed ? "It took longer than expected." : "The demo data is being restored. This takes a few seconds."}
      </p>
      {failed && <Button
          onClick={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </Button>}
    </main>
  );
}
