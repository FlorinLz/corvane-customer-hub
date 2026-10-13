import * as React from "react";

import { cn } from "@/lib/utils";

// Brief 5.1.6 Card: white, 1px border, radius 8px, padding 16px, no shadow.
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-md border border-border bg-surface p-4", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-3 flex min-h-8 items-center gap-2", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-section", className)} {...props} />;
}
