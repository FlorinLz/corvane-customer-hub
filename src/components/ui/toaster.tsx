"use client";

import { Toaster as Sonner } from "sonner";

// Brief 5.1.6 Toast spec: bottom right, stacked, max 3 visible, 360px wide,
// 4px left rule coloured by variant, success/info auto-dismiss after 5s.
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      visibleToasts={3}
      gap={8}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex items-center gap-3 w-[360px] rounded-md bg-white shadow-overlay border-l-4 border-border p-3 pl-4 text-body text-text",
          success: "border-l-success",
          info: "border-l-link",
          error: "border-l-danger",
          closeButton: "text-text-secondary",
        },
      }}
      closeButton
    />
  );
}
