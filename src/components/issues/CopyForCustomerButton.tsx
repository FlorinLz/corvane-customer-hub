"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/** Brief M18 AC9: "<ID> is with our <Team> team (<owner>). <communicator> will keep you updated." */
export function CopyForCustomerButton({ text, partner = false }: { text: string; partner?: boolean }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy");
    }
  }

  return (
    <Button variant="secondary" onClick={() => void copy()}>
      Copy for the {partner ? "partner" : "customer"}
    </Button>
  );
}
