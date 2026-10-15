"use client";

import * as React from "react";

import { parseTarget, splitBold } from "@/lib/onboarding/content";
import type { MoveKind, RouteIds } from "@/lib/onboarding/engine";
import { placeBesideDialog, placeBubble, type Box, type Placement } from "@/lib/onboarding/placement";

/** The first visible element for a `target`. `name~@partner` picks the Home row of that issue, by id. */
export function findTarget(raw: string, ids?: RouteIds, root: ParentNode = document): HTMLElement | null {
  const spec = parseTarget(raw);
  const scopes = spec.scope ? Array.from(root.querySelectorAll<HTMLElement>(`[data-onboarding="${spec.scope}"]`)) : [root];
  for (const scope of scopes) {
    for (const el of Array.from(scope.querySelectorAll<HTMLElement>(`[data-onboarding="${spec.name}"]`))) {
      if (spec.text?.startsWith("@")) {
        const ref = spec.text.slice(1);
        const id = ids ? { partner: ids.partnerIssue, revolut: ids.revolutIssue, iss1042: ids.iss1042 }[ref] : null;
        if (!id || el.getAttribute("data-onboarding-issue") !== id) continue;
      } else if (spec.text && !(el.textContent ?? "").includes(spec.text)) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
  }
  return null;
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The bubble's text with its UI labels in bold. */
function Say({ text }: { text: string }) {
  return (
    <>
      {splitBold(text).map((p, i) => (p.bold ? <strong key={i} className="font-semibold">{p.text}</strong> : <React.Fragment key={i}>{p.text}</React.Fragment>))}
    </>
  );
}

export interface GuideBubble {
  say: string;
  counter: string;
  kind: MoveKind;
  /** For a "type": the text the move suggests. */
  suggestion?: string;
  onGotIt?: () => void;
  onFill?: (el: HTMLElement) => void;
}

interface Frame {
  target: { left: number; top: number; width: number; height: number };
  bubble: { width: number; height: number };
  placement: Placement;
}

const BUBBLE_WIDTH = 288;
const PANEL_WIDTH = 360;

/**
 * The ring and the bubble over the element a move points at. The ring is the overlay of the earlier highlight (fixed, no pointer events, so nothing
 * reflows). The bubble sits next to it with a small arrow, on the side that has room, and follows scroll and resize. It shows the first of `targets`
 * that is on the page; a pick's option comes before its select. Esc hides it. The target stays usable: the bubble never covers it.
 */
export function MoveGuide({
  moveId,
  targets,
  ids,
  bubble,
  hidden,
  avoidTargets = [],
  onTargetClick,
  onEsc,
}: {
  moveId: string;
  targets: string[];
  ids: RouteIds;
  bubble: GuideBubble;
  hidden: boolean;
  /** The targets of the moves that come next: the bubble keeps off them. */
  avoidTargets?: string[];
  onTargetClick: (raw: string) => void;
  onEsc: () => void;
}) {
  const [found, setFound] = React.useState<{ raw: string; el: HTMLElement } | null>(null);
  const [frame, setFrame] = React.useState<Frame | null>(null);
  const bubbleRef = React.useRef<HTMLDivElement>(null);
  const scrolledFor = React.useRef<string | null>(null);

  // Which target is on the page: asked again a few times a second, because dialogs and lists open and close without telling us.
  React.useEffect(() => {
    if (hidden) return;
    const look = () => {
      for (const raw of targets) {
        const el = findTarget(raw, ids);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets.join("|"), ids.iss1042, ids.partnerIssue, ids.revolutIssue, hidden]);

  // Follow the element and place the bubble, every frame while it shows.
  React.useEffect(() => {
    if (!found || hidden) return;
    let frameId = 0;
    const follow = () => {
      const r = found.el.getBoundingClientRect();
      const b = bubbleRef.current?.getBoundingClientRect();
      const bubbleSize = { width: b?.width || BUBBLE_WIDTH, height: b?.height || 80 };
      const panelOpen = document.documentElement.dataset.onboardingPanel === "open" && window.innerWidth >= 900;
      const target = { left: r.left, top: r.top, width: r.width, height: r.height };
      const box = (el: Element): Box => {
        const q = el.getBoundingClientRect();
        return { left: q.left, top: q.top, width: q.width, height: q.height };
      };
      // In a dialog or a drawer the whole window is usable (it covers the panel), and the bubble keeps off the footer and off the next targets.
      // (An option in a list opened from a dialog's select belongs to that dialog.)
      const bubbleless = '[role="dialog"]:not([data-onboarding-bubble])';
      const dialog = found.el.closest<HTMLElement>(bubbleless) ?? (found.el.closest('[role="listbox"]') ? document.querySelector<HTMLElement>(bubbleless) : null);
      const overPanel = !!dialog || r.left + r.width > window.innerWidth - PANEL_WIDTH + 4;
      const usable = { width: window.innerWidth - (panelOpen && !overPanel ? PANEL_WIDTH : 0), height: window.innerHeight };
      const avoid: Box[] = [];
      const footer = dialog?.querySelector('[data-onboarding="dialog-footer"]');
      if (footer && !footer.contains(found.el)) avoid.push(box(footer));
      for (const raw of avoidTargets) {
        const el = findTarget(raw, ids);
        if (el && el !== found.el && !found.el.contains(el)) avoid.push(box(el));
      }
      const placement = (dialog && placeBesideDialog(target, box(dialog), bubbleSize, usable, avoid)) || placeBubble(target, bubbleSize, usable, avoid);
      setFrame((prev) =>
        prev && prev.target.left === target.left && prev.target.top === target.top && prev.target.width === target.width && prev.target.height === target.height && prev.bubble.height === bubbleSize.height && prev.placement.left === placement.left && prev.placement.top === placement.top
          ? prev
          : { target, bubble: bubbleSize, placement },
      );
      frameId = requestAnimationFrame(follow);
    };
    frameId = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frameId);
  }, [found, hidden, avoidTargets.join("|")]);

  // Into view once per target, unless it already is.
  React.useEffect(() => {
    if (!found || hidden || scrolledFor.current === `${moveId}:${found.raw}`) return;
    scrolledFor.current = `${moveId}:${found.raw}`;
    const r = found.el.getBoundingClientRect();
    if (r.top < 80 || r.bottom > window.innerHeight - 24) found.el.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
  }, [found, moveId, hidden]);

  // A click on the target tells the panel; Esc hides the guide. A click on a bubble button must not reach a dialog's "click outside" rule.
  React.useEffect(() => {
    if (!found || hidden) return;
    const onClick = (e: MouseEvent) => {
      if (e.target instanceof Node && found.el.contains(e.target)) onTargetClick(found.raw);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEsc();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [found, hidden, onTargetClick, onEsc]);

  const stop = React.useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const halt = (e: Event) => e.stopPropagation();
    node.addEventListener("pointerdown", halt);
    node.addEventListener("mousedown", halt);
    bubbleRef.current = node;
  }, []);

  if (!found || hidden || !frame) return null;
  const { target, placement } = frame;
  const PAD = 3;
  const side = placement.side;
  // The arrow sits on the bubble's edge that faces the target, level with the target's centre.
  const arrowStyle: React.CSSProperties =
    side === "inside"
      ? { display: "none" }
      : side === "right" || side === "left"
      ? { top: Math.min(Math.max(target.top + target.height / 2 - placement.top, 14), frame.bubble.height - 14) - 5, [side === "right" ? "left" : "right"]: -5 }
      : { left: Math.min(Math.max(target.left + target.width / 2 - placement.left, 14), frame.bubble.width - 14) - 5, [side === "below" ? "top" : "bottom"]: -5 };

  return (
    <>
      <div
        data-onboarding-highlight={found.raw}
        data-move={moveId}
        style={{ top: target.top - PAD, left: target.left - PAD, width: target.width + PAD * 2, height: target.height + PAD * 2 }}
        className="ch-highlight pointer-events-none fixed z-[70] rounded-md border-2 border-link-text"
      />
      <div
        ref={stop}
        role="dialog"
        aria-modal="false"
        aria-label="Guide"
        data-onboarding-bubble={moveId}
        data-side={side}
        style={{ left: placement.left, top: placement.top, width: BUBBLE_WIDTH, pointerEvents: "auto" }}
        className="fixed z-[71] flex flex-col gap-2 rounded-md bg-primary p-3 text-body text-white shadow-overlay"
      >
        <span aria-hidden="true" style={arrowStyle} className="absolute size-2.5 rotate-45 bg-primary" />
        <p aria-live="polite" data-onboarding="bubble-text" className="leading-5">
          <Say text={bubble.say} />
        </p>
        {bubble.kind === "type" && bubble.suggestion && (
          <p className="break-words rounded-sm bg-white/10 px-2 py-1 text-meta">&ldquo;{bubble.suggestion}&rdquo;</p>
        )}
        <div className="flex items-center gap-2 text-meta">
          <span data-onboarding="bubble-counter" className="text-white/70">{bubble.counter}</span>
          <span className="flex-1" />
          {bubble.kind === "read" && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={bubble.onGotIt}
              className="rounded-sm bg-white px-2 py-1 font-medium text-primary hover:bg-tint-strong"
            >
              Got it
            </button>
          )}
          {bubble.kind === "type" && bubble.onFill && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => bubble.onFill?.(found.el)}
              className="rounded-sm bg-white px-2 py-1 font-medium text-primary hover:bg-tint-strong"
            >
              Fill for me
            </button>
          )}
        </div>
      </div>
    </>
  );
}
