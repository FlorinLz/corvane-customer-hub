import * as React from "react";

import { cn } from "@/lib/utils";

// Brief 5.1.6 Text input spec: 36px high, radius 4px, 1px border-strong, white fill.
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-9 w-full min-w-0 rounded-sm border border-border-strong bg-white px-3 text-body text-text placeholder:text-text-disabled",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus focus-visible:border-primary",
        "disabled:bg-tint disabled:border-neutral-300 disabled:text-text-disabled",
        "aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
