/** Where the guide bubble goes: next to its target, on the side with room, inside the viewport, never over the target. Pure. */

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

/**
 * `usable` is the part of the viewport the page owns (the scenario panel takes the rest). Sides are tried in the order right, below, left, above; the
 * first where the bubble fits whole wins. When none does, the bubble goes inside the target's visible top right corner.
 */
export function placeBubble(target: Box, bubble: { width: number; height: number }, usable: { width: number; height: number }): Placement {
  const room: Record<Exclude<Side, "inside">, number> = {
    right: usable.width - (target.left + target.width) - GAP - EDGE,
    below: usable.height - (target.top + target.height) - GAP - EDGE,
    left: target.left - GAP - EDGE,
    above: target.top - GAP - EDGE,
  };
  const need: Record<Exclude<Side, "inside">, number> = { right: bubble.width, below: bubble.height, left: bubble.width, above: bubble.height };
  const order: Exclude<Side, "inside">[] = ["right", "below", "left", "above"];
  const found = order.find((o) => room[o] >= need[o]);
  const side: Side = found ?? "inside";

  const clampX = (x: number) => Math.min(Math.max(EDGE, x), Math.max(EDGE, usable.width - bubble.width - EDGE));
  const clampY = (y: number) => Math.min(Math.max(EDGE, y), Math.max(EDGE, usable.height - bubble.height - EDGE));
  const centreX = target.left + target.width / 2 - bubble.width / 2;
  const centreY = target.top + target.height / 2 - bubble.height / 2;
  switch (side) {
    case "inside":
      return { side, left: clampX(Math.min(target.left + target.width, usable.width) - bubble.width - 16), top: clampY(Math.max(target.top, 0) + 16) };
    case "right":
      return { side, left: target.left + target.width + GAP, top: clampY(centreY) };
    case "left":
      return { side, left: target.left - GAP - bubble.width, top: clampY(centreY) };
    case "below":
      return { side, left: clampX(centreX), top: target.top + target.height + GAP };
    case "above":
      return { side, left: clampX(centreX), top: target.top - GAP - bubble.height };
  }
}
