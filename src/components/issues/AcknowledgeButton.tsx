"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

/** Brief M21 AC1. Owner only, status New. */
export function AcknowledgeButton({ issueId, version }: { issueId: string; version: number }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function acknowledge() {
    setPending(true);
    try {
      const res = await apiRequest(`/api/issues/${issueId}/acknowledge`, "POST", { version });
      if (!res.ok) {
        toast.error(res.kind === "issue_forbidden" ? res.message : "Action not saved. Try again.");
        return;
      }
      toast.success("Issue acknowledged");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button data-onboarding="acknowledge" loading={pending} onClick={() => void acknowledge()}>
      Acknowledge
    </Button>
  );
}
