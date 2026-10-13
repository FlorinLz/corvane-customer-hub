import * as React from "react";

import { cn } from "@/lib/utils";

// The cbx style: 16px, primary-filled when checked.
const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      type="checkbox"
      ref={ref}
      className={cn("size-4 shrink-0 rounded-sm border border-border-strong text-primary accent-primary", className)}
      {...props}
    />
  ),
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
