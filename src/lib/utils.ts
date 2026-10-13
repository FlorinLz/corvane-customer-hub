import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Primary-button text was rendering near-black instead of white (and
 * secondary buttons near-black instead of the brand teal): tailwind.config.ts's
 * own fontSize scale names its sizes "page"/"section"/"subsection"/"body"/
 * "meta"/"chip" (brief 5.1.3), generating text-page/text-body/etc utility
 * classes -- but plain twMerge() has no idea those are font-SIZE classes
 * and falls back to treating "text-<anything>" as a text-COLOR class,
 * putting text-white/text-primary and text-body in the same conflict
 * group. Since cva() always places the variant's colour class before the
 * size class in the merged string (buttonVariants({variant, size}) ->
 * "... text-white ... text-body"), twMerge kept only the last one in that
 * perceived group -- text-body -- and silently dropped text-white,
 * leaving the button with no text colour of its own and falling back to
 * the inherited body colour (near-black). Registering these names under
 * the real "font-size" group here, once, fixes every component that
 * combines a text colour utility with one of these size utilities, not
 * just Button -- the bug was never about any one button's own classes.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["page", "section", "subsection", "body", "meta", "chip"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
