import { describe, expect, it } from "vitest";

import { placeBesideDialog, placeBubble, type Box } from "@/lib/onboarding/placement";

const bubble = { width: 288, height: 96 };
const overlaps = (p: { left: number; top: number }, b: Box) => p.left < b.left + b.width && p.left + bubble.width > b.left && p.top < b.top + b.height && p.top + bubble.height > b.top;
const inside = (p: { left: number; top: number }, w: number, h: number) => p.left >= 8 && p.top >= 8 && p.left + bubble.width <= w - 8 && p.top + bubble.height <= h - 8;

/** A dialog (or drawer), the field the bubble points at, the footer's buttons and the next move's target, as they sit at 1280 x 800. */
interface Scene {
  name: string;
  dialog: Box;
  target: Box;
  footer: Box;
  next: Box;
}

const scenes: Scene[] = [
  {
    name: "Resolve: the Solution field, with Resolve issue next",
    dialog: { left: 400, top: 110, width: 480, height: 580 },
    target: { left: 424, top: 430, width: 432, height: 88 },
    footer: { left: 400, top: 620, width: 480, height: 70 },
    next: { left: 716, top: 636, width: 140, height: 36 },
  },
  {
    name: "Report issue drawer: the Description field",
    dialog: { left: 640, top: 0, width: 640, height: 800 },
    target: { left: 664, top: 480, width: 592, height: 100 },
    footer: { left: 640, top: 730, width: 640, height: 70 },
    next: { left: 1120, top: 744, width: 136, height: 36 },
  },
  {
    name: "Share draft: the Summary field, with Share draft next",
    dialog: { left: 400, top: 140, width: 480, height: 520 },
    target: { left: 424, top: 400, width: 432, height: 130 },
    footer: { left: 400, top: 590, width: 480, height: 70 },
    next: { left: 744, top: 606, width: 112, height: 36 },
  },
  {
    name: "Record notification: the Channel select, with Record notification next",
    dialog: { left: 400, top: 80, width: 480, height: 640 },
    target: { left: 424, top: 230, width: 200, height: 36 },
    footer: { left: 400, top: 650, width: 480, height: 70 },
    next: { left: 690, top: 666, width: 166, height: 36 },
  },
];

describe("a bubble in a dialog or drawer", () => {
  const usable = { width: 1280, height: 800 };

  for (const s of scenes) {
    it(`${s.name}: outside the dialog, covering neither the footer, the next target nor its own field`, () => {
      const p = placeBesideDialog(s.target, s.dialog, bubble, usable, [s.footer, s.next]);
      expect(p, "a place outside the dialog").not.toBeNull();
      expect(["right", "left"]).toContain(p!.side);
      expect(overlaps(p!, s.dialog), "outside the dialog").toBe(false);
      for (const b of [s.footer, s.next, s.target]) expect(overlaps(p!, b)).toBe(false);
      expect(inside(p!, usable.width, usable.height)).toBe(true);
    });
  }

  it("a drawer against the right edge puts it on the left", () => {
    const s = scenes[1];
    expect(placeBesideDialog(s.target, s.dialog, bubble, usable, [s.footer, s.next])!.side).toBe("left");
  });

  it("a centred dialog puts it on the right when there is room, and on the left when the right is full", () => {
    const s = scenes[0];
    expect(placeBesideDialog(s.target, s.dialog, bubble, usable, [s.footer, s.next])!.side).toBe("right");
    const narrow = { width: 1000, height: 800 }; // right of the dialog: 1000 - 892 is too little
    expect(placeBesideDialog(s.target, s.dialog, bubble, narrow, [s.footer, s.next])!.side).toBe("left");
  });

  it("with no room beside a dialog it goes above the field, still clear of the footer and the next target", () => {
    const s = scenes[0];
    const tight = { width: 520, height: 800 };
    const wide: Scene = { ...s, dialog: { left: 20, top: 110, width: 480, height: 580 }, target: { left: 44, top: 430, width: 432, height: 88 }, footer: { left: 20, top: 620, width: 480, height: 70 }, next: { left: 336, top: 636, width: 140, height: 36 } };
    const p = placeBesideDialog(wide.target, wide.dialog, bubble, tight, [wide.footer, wide.next]);
    expect(p?.side).toBe("above");
    for (const b of [wide.footer, wide.next, wide.target]) expect(overlaps(p!, b)).toBe(false);
  });

  it("placeBubble keeps off the boxes it is told to avoid, on the page as in a dialog", () => {
    const t = { left: 100, top: 300, width: 120, height: 36 };
    const next = { left: 240, top: 300, width: 120, height: 36 }; // just to the right of the target
    const p = placeBubble(t, bubble, { width: 920, height: 800 }, [next]);
    expect(overlaps(p, next)).toBe(false);
    expect(overlaps(p, t)).toBe(false);
    expect(p.side).not.toBe("right");
  });
});
