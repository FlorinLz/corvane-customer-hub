import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/**
 * Primary buttons were rendering black text on the brand teal background
 * (reported live: the "Close" button in a dialog footer). Root cause:
 * tailwind.config.ts's own fontSize scale names its sizes "page",
 * "section", "subsection", "body", "meta", "chip" (brief 5.1.3) --
 * generating text-body/text-meta/etc utility classes that plain
 * tailwind-merge has no way to tell apart from a text-COLOR class, so it
 * put e.g. "text-white" and "text-body" in the same conflict group and
 * kept only whichever came last in cva()'s own merged string (the size
 * class, since cva always orders variant classes before size classes) --
 * silently dropping the colour, leaving the button to fall back to
 * globals.css's own `body { color: ... }` (near-black). Fixed once, at
 * the cn() level (src/lib/utils.ts), by registering these six names
 * under tailwind-merge's real "font-size" group -- every component that
 * combines a text colour utility with one of them benefits, not just
 * Button.
 */
describe("cn() does not drop a text colour utility behind a custom font-size utility", () => {
  it.each(["page", "section", "subsection", "body", "meta", "chip"])("text-%s", (sizeName) => {
    const merged = cn("text-white", `text-${sizeName}`);
    const classes = merged.split(" ");
    expect(classes).toContain("text-white");
    expect(classes).toContain(`text-${sizeName}`);
  });

  it("keeps a secondary-style colour (text-primary) alongside a custom size utility", () => {
    const classes = cn("text-primary", "text-body").split(" ");
    expect(classes).toContain("text-primary");
    expect(classes).toContain("text-body");
  });

  it("still lets a LATER text colour win over an EARLIER one (real conflicts still resolve)", () => {
    const classes = cn("text-white", "text-danger").split(" ");
    expect(classes).not.toContain("text-white");
    expect(classes).toContain("text-danger");
  });
});

describe("buttonVariants() keeps every variant's own text colour, at both button sizes", () => {
  const colorByVariant = {
    primary: "text-white",
    secondary: "text-primary",
    destructive: "text-white",
    "destructive-secondary": "text-danger",
    text: "text-primary",
  } as const;

  for (const [variant, colorClass] of Object.entries(colorByVariant)) {
    for (const size of ["md", "lg"] as const) {
      it(`${variant} / ${size} includes ${colorClass}`, () => {
        const classes = buttonVariants({ variant: variant as keyof typeof colorByVariant, size }).split(" ");
        expect(classes).toContain(colorClass);
      });
    }
  }
});
