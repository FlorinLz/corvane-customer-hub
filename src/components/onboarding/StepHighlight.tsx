"use client";

import * as React from "react";

import { parseTarget } from "@/lib/onboarding/content";

/** The first element on the page for a `target` entry that is visible (it has a size), or null. */
export function findTarget(raw: string, root: ParentNode = document): HTMLElement | null {
  const spec = parseTarget(raw);
  const scopes = spec.scope ? Array.from(root.querySelectorAll<HTMLElement>(`[data-onboarding="${spec.scope}"]`)) : [root];
  for (const scope of scopes) {
    for (const el of Array.from(scope.querySelectorAll<HTMLElement>(`[data-onboarding="${spec.name}"]`))) {
      if (spec.text && !(el.textContent ?? "").includes(spec.text)) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
  }
  return null;
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Rect {
  right: number;
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * The ring and tag over the element a scenario step asks the visitor to click or read. It is an overlay (fixed, no pointer events) that
 * follows the element, so the page never reflows. It shows the first of `targets` that is on the page and not dismissed; a click on the
 * element dismisses that target (the next one, for example a dialog's submit button, takes over), Esc dismisses them all.
 * Decorative: the tag is aria-hidden and the target keeps its own accessible name.
 */
export function StepHighlight({
  stepId,
  targets,
  dismissed,
  tag,
  onDismiss,
  onDismissAll,
}: {
  stepId: string;
  targets: string[];
  dismissed: string[];
  tag: string;
  onDismiss: (raw: string) => void;
  onDismissAll: () => void;
}) {
  const [found, setFound] = React.useState<{ raw: string; el: HTMLElement } | null>(null);
  const [rect, setRect] = React.useState<Rect | null>(null);
  const live = React.useMemo(() => targets.filter((t) => !dismissed.includes(t)), [targets, dismissed]);
  const scrolledFor = React.useRef<string | null>(null);

  // Which target is on the page: asked again a few times a second, because dialogs and pages open and close without telling us.
  React.useEffect(() => {
    const look = () => {
      for (const raw of live) {
        const el = findTarget(raw);
        if (el) {
          setFound((prev) => (prev && prev.raw === raw && prev.el === el ? prev : { raw, el }));
          return;
        }
      }
      setFound(null);
    };
    look();
    const timer = setInterval(look, 250);
    return () => clearInterval(timer);
  }, [live]);

  // Follow the element: scroll, resize and layout changes move it, and the overlay moves with it.
  React.useEffect(() => {
    if (!found) return;
    let frame = 0;
    const follow = () => {
      const r = found.el.getBoundingClientRect();
      setRect((prev) => (prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height ? prev : { top: r.top, left: r.left, right: r.right, width: r.width, height: r.height }));
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [found]);

  // Into view once per target, unless it already is.
  React.useEffect(() => {
    if (!found || scrolledFor.current === `${stepId}:${found.raw}`) return;
    scrolledFor.current = `${stepId}:${found.raw}`;
    const r = found.el.getBoundingClientRect();
    if (r.top < 80 || r.bottom > window.innerHeight - 24) found.el.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
  }, [found, stepId]);

  // A click on the highlighted element, or Esc, takes the highlight away.
  React.useEffect(() => {
    if (!found) return;
    const onClick = (e: MouseEvent) => {
      if (e.target instanceof Node && found.el.contains(e.target)) onDismiss(found.raw);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismissAll();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [found, onDismiss, onDismissAll]);

  if (!found || !rect) return null;
  const PAD = 3;
  const tagBelow = rect.top < 36;
  // A small target with empty space to its right (a text button in a dialog) gets the tag beside it, so the tag never covers the text above it.
  const tagBeside = rect.width < 180 && rect.right + 110 < window.innerWidth - 400;
  return (
    <div
      data-onboarding-highlight={found.raw}
      data-step={stepId}
      style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
      className="ch-highlight pointer-events-none fixed z-[70] rounded-md border-2 border-link-text"
    >
      <span aria-hidden="true" className={`absolute whitespace-nowrap rounded-sm bg-link-text px-1.5 py-0.5 text-chip font-semibold text-white ${tagBeside ? "left-full top-1/2 ml-2 -translate-y-1/2" : tagBelow ? "left-0 top-full mt-1" : "-top-6 left-0"}`}>
        {tag}
      </span>
    </div>
  );
}
