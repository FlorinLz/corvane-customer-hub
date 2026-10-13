import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

// Brief 5.1.6 Button spec.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm font-sans font-medium transition-colors disabled:pointer-events-none disabled:bg-neutral-200 disabled:text-text-disabled disabled:border-transparent disabled:shadow-none aria-disabled:cursor-not-allowed aria-disabled:bg-neutral-200 aria-disabled:text-text-disabled aria-disabled:border-transparent aria-disabled:shadow-none aria-disabled:hover:bg-neutral-200 aria-disabled:hover:no-underline",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white hover:bg-primary-dark",
        secondary:
          "bg-transparent text-primary border border-primary hover:bg-tint-strong",
        destructive: "bg-danger text-white hover:bg-[#7A0215]",
        "destructive-secondary":
          "bg-transparent text-danger border border-danger hover:bg-[#FBEFF1]",
        text: "bg-transparent text-primary px-2 hover:underline disabled:bg-transparent aria-disabled:bg-transparent aria-disabled:hover:bg-transparent",
      },
      size: {
        md: "h-9 px-4 text-body",
        lg: "h-11 px-[19px] text-[16px] leading-6",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  /**
   * Why the button is disabled. With `disabled`, the button stays focusable (aria-disabled, not the disabled attribute) so the reason
   * shows as its tooltip and is read by screen readers; clicking does nothing. Pair it with <DisabledReason> for the visible hint.
   */
  disabledReason?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, disabledReason, onClick, title, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const soft = !!disabled && !!disabledReason && !loading;
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={(disabled || loading) && !soft}
        aria-disabled={disabled || loading || undefined}
        title={soft ? disabledReason : title}
        onClick={soft ? (e: React.MouseEvent<HTMLButtonElement>) => e.preventDefault() : onClick}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

/** The visible half of a disabled button's reason: small secondary text next to (or under) the button. */
function DisabledReason({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <span id={id} className="text-meta text-text-secondary">
      {children}
    </span>
  );
}

export { Button, DisabledReason, buttonVariants };
