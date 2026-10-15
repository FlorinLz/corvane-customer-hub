/** Where the guide bubble goes: next to its target, on the side with room, inside the viewport, never over its target, the next move's target or a dialog's footer. Pure. */

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** `inside` is for a target too big to have room beside it (a card as wide as the page): the bubble sits in its top right corner, inside the viewport. */
export type Side = "right" | "below" | "left" | "above" | "inside";

export interface Placement {
  left: number;
  top: number;
  side: Side;
}

const GAP = 12;
const EDGE = 8;

type Size = { width: number; height: number };

const overlaps = (a: Box, b: Box) => a.left < b.left + b.width - 1 && a.left + a.width > b.left + 1 && a.top < b.top + b.height - 1 && a.top + a.height > b.top + 1;

/** The bubble's box at `at`, whole inside the usable part of the window (with a margin) and clear of every box in `avoid`. */
function fits(at: { left: number; top: number }, bubble: Size, usable: Size, avoid: Box[]): boolean {
  const box = { left: at.left, top: at.top, width: bubble.width, height: bubble.height };
  const inside = box.left >= EDGE && box.top >= EDGE && box.left + box.width <= usable.width - EDGE && box.top + box.height <= usable.height - EDGE;
  return inside && !avoid.some((a) => overlaps(box, a));
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(min, v), Math.max(min, max));

/**
 * `usable` is the part of the viewport the page owns (the scenario panel takes the rest). `avoid` lists boxes the bubble must not cover besides its
 * target: the next move's target, a dialog's footer. Sides are tried in the order right, below, left, above; the first where the bubble fits whole and
 * clear wins. When none does, the bubble goes inside the target's visible top right corner.
 */
export function placeBubble(target: Box, bubble: Size, usable: Size, avoid: Box[] = []): Placement {
  const centreX = clamp(target.left + target.width / 2 - bubble.width / 2, EDGE, usable.width - bubble.width - EDGE);
  const centreY = clamp(target.top + target.height / 2 - bubble.height / 2, EDGE, usable.height - bubble.height - EDGE);
  const candidates: Placement[] = [
    { side: "right", left: target.left + target.width + GAP, top: centreY },
    { side: "below", left: centreX, top: target.top + target.height + GAP },
    { side: "left", left: target.left - GAP - bubble.width, top: centreY },
    { side: "above", left: centreX, top: target.top - GAP - bubble.height },
  ];
  const found = candidates.find((c) => fits(c, bubble, usable, [target, ...avoid]));
  if (found) return found;
  return { side: "inside", left: clamp(Math.min(target.left + target.width, usable.width) - bubble.width - 16, EDGE, usable.width - bubble.width - EDGE), top: clamp(Math.max(target.top, 0) + 16, EDGE, usable.height - bubble.height - EDGE) };
}

/**
 * For a target inside a dialog or a drawer: the bubble goes outside it, to the right of the dialog, then to the left, level with the target, so it
 * covers neither the footer buttons nor the fields below. Then above the target. Null when none of these fits (the caller falls back to placeBubble).
 */
export function placeBesideDialog(target: Box, dialog: Box, bubble: Size, usable: Size, avoid: Box[] = []): Placement | null {
  const top = clamp(target.top + target.height / 2 - bubble.height / 2, EDGE, usable.height - bubble.height - EDGE);
  const candidates: Placement[] = [
    { side: "right", left: dialog.left + dialog.width + GAP, top },
    { side: "left", left: dialog.left - GAP - bubble.width, top },
    { side: "above", left: clamp(target.left, EDGE, usable.width - bubble.width - EDGE), top: target.top - GAP - bubble.height },
  ];
  return candidates.find((c) => fits(c, bubble, usable, [target, ...avoid])) ?? null;
}
