"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";

// Brief 6.12.4, 4.8.4. Admin, DEMO_MODE only. Shared by the TopBar Admin
// menu and the /admin sidebar's "Reset demo data" link.
export function ResetDemoDataDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function confirmReset() {
    setPending(true);
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      if (!res.ok) {
        toast.error("Action not completed. Try again.");
        return;
      }
      onOpenChange(false);
      toast.success("Demo data reset");
      router.push("/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>Reset all demo data?</DialogHeader>
        <DialogBody>
          <p className="text-body text-text">Every change made since the last reset is lost.</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" loading={pending} onClick={() => void confirmReset()}>
            Reset demo data
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
