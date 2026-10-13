"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

/** Brief 3.8.2 "Confirm pickup", M3 AC12. The named Onboarding Manager only. */
export function ConfirmPickupButton({ handoffId }: { handoffId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function confirm() {
    setPending(true);
    try {
      const res = await apiRequest(`/api/handoffs/${handoffId}/confirm-pickup`, "POST");
      if (!res.ok) {
        toast.error(res.kind === "conflict" || res.kind === "deleted" ? res.message : "Action not saved");
        return;
      }
      toast.success("Pickup confirmed");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button loading={pending} onClick={() => void confirm()}>
      Confirm pickup
    </Button>
  );
}
