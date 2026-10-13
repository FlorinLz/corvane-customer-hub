import { AlertTriangle, Info } from "lucide-react";

import { cn } from "@/lib/utils";

const VARIANTS = {
  warning: { box: "border-due bg-white text-text", icon: "text-due" },
  danger: { box: "border-danger bg-white text-text", icon: "text-danger" },
  info: { box: "border-border bg-tint text-text", icon: "text-text-secondary" },
} as const;

/** `.banner-warning` / `.banner-danger` / `.banner-info`. */
export function Banner({ variant, children, className }: { variant: keyof typeof VARIANTS; children: React.ReactNode; className?: string }) {
  const v = VARIANTS[variant];
  return (
    <div
      role={variant === "danger" ? "alert" : undefined}
      className={cn("flex items-start gap-2 rounded-md border px-3 py-2 text-body", v.box, className)}
    >
      {variant === "info" ? <Info className={cn("mt-0.5 size-4 shrink-0", v.icon)} aria-hidden="true" /> : <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", v.icon)} aria-hidden="true" />}
      <span className="flex-1">{children}</span>
    </div>
  );
}
