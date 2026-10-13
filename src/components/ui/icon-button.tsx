import * as React from "react";

import { cn } from "@/lib/utils";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string;
}

// Brief 5.1.6 Icon button spec: 32px square, radius 4px, aria-label required.
const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-sm border-0 bg-transparent text-text-secondary transition-colors hover:bg-tint hover:text-primary",
        className,
      )}
      {...props}
    />
  ),
);
IconButton.displayName = "IconButton";

export { IconButton };
