"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

/** "Mark as verified" is inline, no dialog. */
export function MarkAsVerifiedButton({ contactId, version }: { contactId: string; version: number }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function verify() {
    setPending(true);
    try {
      const result = await apiRequest(`/api/contacts/${contactId}/verify`, "POST", { version });
      if (!result.ok) {
        toast.error(result.kind === "conflict" ? result.message : "Could not mark as verified. Try again.");
        return;
      }
      toast.success("Marked as verified");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="text" size="md" className="h-auto p-0 text-meta" loading={pending} onClick={() => void verify()}>
      Mark as verified
    </Button>
  );
}
