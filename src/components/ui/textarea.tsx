import * as React from "react";

import { cn } from "@/lib/utils";

// Brief 5.1.6 ".input.textarea": same base as the text input, min-height 88px.
const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[88px] w-full rounded-sm border border-border-strong bg-white px-3 py-2 text-body text-text placeholder:text-text-disabled",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus focus-visible:border-primary",
        "disabled:bg-tint disabled:border-neutral-300 disabled:text-text-disabled",
        "aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
