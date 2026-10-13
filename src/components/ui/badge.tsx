import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Brief 5.1.5 chip variants and 5.1.6 Chip / badge spec.
const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-pill border border-transparent px-2 text-chip font-medium leading-4 h-[22px]",
  {
    variants: {
      variant: {
        success: "bg-success text-white",
        due: "bg-due text-white",
        "due-outline": "bg-white text-due border-due",
        danger: "bg-danger text-white",
        "danger-outline": "bg-white text-danger border-danger",
        neutral: "bg-neutral-100 text-text",
        "neutral-outline": "bg-white text-text-secondary border-neutral-500",
        muted: "bg-tint text-text-secondary border-neutral-500 border-dashed",
        brand: "bg-primary text-white",
        selected: "bg-selected text-primary",
        "scheme-eu": "bg-scheme-euvop text-white",
        "scheme-uk": "bg-scheme-ukcop text-white",
        admin: "bg-highlight text-primary",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}

export { Badge, badgeVariants };
