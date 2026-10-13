"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

/** Brief 3.8.2 "Accept", M8 AC11. The named CSM only. No Decline in R1 (M8 AC12 is R2). */
export function AcceptHandoffButton({ handoffId }: { handoffId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function accept() {
    setPending(true);
    try {
      const res = await apiRequest(`/api/handoffs/${handoffId}/accept`, "POST");
      if (!res.ok) {
        toast.error(res.kind === "conflict" || res.kind === "deleted" ? res.message : "Action not saved");
        return;
      }
      toast.success("Handoff accepted");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button loading={pending} onClick={() => void accept()}>
      Accept
    </Button>
  );
}
