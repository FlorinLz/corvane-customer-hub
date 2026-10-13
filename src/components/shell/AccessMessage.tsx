import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

// Brief 5.2 "Access and record pages": centred text block inside the page
// area, one short sentence, one or two actions. Shared by not-found.tsx,
// the Admin and wizard 403 pages, and the soft-deleted-record page
// milestone 4 adds.
export interface AccessMessageAction {
  label: string;
  href: string;
  variant?: "secondary" | "text";
}

export function AccessMessage({
  icon: Icon,
  message,
  actions,
}: {
  icon: LucideIcon;
  message: string;
  actions: AccessMessageAction[];
}) {
  return (
    <div className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-md border border-border bg-surface px-6 py-12 text-center">
      <Icon className="size-5 text-text-secondary" aria-hidden="true" />
      <p className="max-w-[360px] text-[16px] leading-6 text-text">{message}</p>
      <div className="flex gap-2">
        {actions.map((action) => (
          <Button key={action.label} asChild variant={action.variant ?? "secondary"}>
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
