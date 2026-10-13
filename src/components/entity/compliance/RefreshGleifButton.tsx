"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

import { apiRequest } from "@/lib/api-client";
import { Button, type ButtonProps } from "@/components/ui/button";

/** The LEI card "Refresh from GLEIF"; also the header's Ops retry when NOT_VERIFIED. */
export function RefreshGleifButton({ entityId, variant = "secondary" }: { entityId: string; variant?: ButtonProps["variant"] }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function refresh() {
    setPending(true);
    try {
      const result = await apiRequest(`/api/entities/${entityId}/gleif-refresh`, "POST");
      if (!result.ok) {
        toast.error(result.kind === "unavailable" ? "GLEIF unavailable. Try again later." : "GLEIF data not refreshed. Try again.");
        return;
      }
      toast.success("GLEIF data refreshed");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant={variant} size="md" loading={pending} onClick={() => void refresh()}>
      <RefreshCw className="size-4" aria-hidden="true" />
      Refresh from GLEIF
    </Button>
  );
}
