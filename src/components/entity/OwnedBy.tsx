import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Brief 5.1.7 "Owned by <Team>" lock pattern. Milestone 3 renders every
 * tab read-only for every viewer (milestone 4 adds the real permission
 * matrix and the dynamic show/hide), so this is a static label rather
 * than one driven by the signed-in user's rights yet.
 */
export function OwnedBy({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-meta text-text-secondary", className)}>
      <Lock className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}
