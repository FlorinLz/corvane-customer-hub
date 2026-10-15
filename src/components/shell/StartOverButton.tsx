"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";

/**
 * "Start over" in the demo bar, shown only to a visitor with their own copy of the demo. Opens an app dialog (never a browser confirm). Confirming
 * restores their schema from the snapshot, gives them a new arrival and loads Home: a full page load, so the browser's clock and the scenario panel
 * start again from the new server state.
 */
export function StartOverButton() {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function startOver() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/demo/start-over", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      // A full page load on purpose: the browser's demo clock offset is written by an inline script, which only runs on a document load.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/";
    } catch {
      setPending(false);
      setError("Could not start over. Try again.");
    }
  }

  return (
    <>
      <button
        type="button"
        data-onboarding="start-over"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-sm border border-white/50 px-2 text-meta text-white hover:bg-white/15 max-[899px]:hidden"
      >
        Start over
      </button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <DialogHeader>Start over?</DialogHeader>
          <DialogBody>
            <p className="text-body">Your copy of the demo goes back to Monday 10:05. Changes you made are removed.</p>
            {error && (
              <p role="alert" className="text-meta text-danger">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button loading={pending} onClick={() => void startOver()}>
              Start over
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
