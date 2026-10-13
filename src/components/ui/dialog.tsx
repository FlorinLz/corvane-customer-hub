"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;

function DialogContent({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex w-[480px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-surface shadow-overlay outline-none",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** The drawer style: a right-side slide-in panel, width set per instance (480px contacts, 560px notes). */
function DrawerContent({
  className,
  width = 480,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { width?: number }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex max-w-[calc(100vw-32px)] flex-col overflow-y-auto bg-surface shadow-overlay outline-none",
          "data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right",
          className,
        )}
        style={{ width }}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center gap-2 px-6 pb-2 pt-5", className)} {...props}>
      <DialogPrimitive.Title asChild>
        <h2 className="flex-1 text-section">{children}</h2>
      </DialogPrimitive.Title>
      <DialogPrimitive.Close className="inline-flex size-8 items-center justify-center rounded-sm text-text-secondary hover:bg-tint hover:text-primary" aria-label="Close">
        <X className="size-4" aria-hidden="true" />
      </DialogPrimitive.Close>
    </div>
  );
}

const DialogBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col gap-4 px-6 pb-4 pt-2", className)} {...props} />
));
DialogBody.displayName = "DialogBody";

/**
 * `reason`: why the dialog's primary button is disabled, said at the left of the footer ("Choose the channel"). The first thing still
 * missing, as short text; null or absent once the button is enabled. Every dialog with a disabled primary passes it.
 */
function DialogFooter({ className, reason, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { reason?: string | null }) {
  return (
    <div className={cn("flex items-center justify-end gap-2 border-t border-border px-6 pb-5 pt-4", className)} {...props}>
      {reason && (
        <span data-testid="dialog-blocked-reason" className="mr-auto min-w-0 text-meta text-text-secondary">
          {reason}
        </span>
      )}
      {children}
    </div>
  );
}

export { Dialog, DialogTrigger, DialogContent, DrawerContent, DialogHeader, DialogBody, DialogFooter };
