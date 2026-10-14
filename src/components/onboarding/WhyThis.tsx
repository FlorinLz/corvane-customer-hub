"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";

import { NOTES, type NoteKey } from "@/lib/onboarding/content";
import { cn } from "@/lib/utils";

/**
 * "Why this?": a small "?" next to an element, opening a popover with a plain note.
 * Demo only: it renders nothing unless DEMO_MODE is on (NEXT_PUBLIC_DEMO_MODE, set by next.config.ts).
 * The popover is portalled and positioned from the button, so a table or card that clips its content never clips the note. Escape and a
 * click elsewhere close it.
 */
export function WhyThis({ note, className }: { note: NoteKey; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const popRef = React.useRef<HTMLDivElement>(null);
  const id = React.useId();
  const copy = NOTES[note];

  const place = React.useCallback(() => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = 300;
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left - 8, window.innerWidth - width - 8)) });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    place();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!popRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-onboarding-why={note}
        aria-label={`Why this? ${copy.title}`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-tint-strong hover:text-primary", className)}
      >
        <HelpCircle className="size-4" aria-hidden />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={popRef}
            id={id}
            role="dialog"
            aria-label={`Why this? ${copy.title}`}
            data-onboarding-popover={note}
            style={{ top: pos.top, left: pos.left }}
            className="fixed z-[60] w-[300px] rounded-md border border-border bg-white p-3 text-body text-text shadow-overlay"
          >
            <p className="text-label text-primary">Why this?</p>
            <p className="mt-1">{copy.text}</p>
          </div>,
          document.body,
        )}
    </>
  );
}
