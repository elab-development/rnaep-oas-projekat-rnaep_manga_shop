import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * ADR-0014 defines custom `@utility` classes in globals.css that tailwind-merge
 * has no way to know about. Left unconfigured, its fallback validators guess
 * from the prefix: `border-chip` / `border-box` / `border-emphasis` (border
 * *widths*) get read as border *colors* and so collide with `border-foreground`
 * — whichever comes last wins and the other is silently dropped. Same trap for
 * `bg-dots` (a background *image*) vs any `bg-*` color.
 *
 * Registering each in its true group makes cn() order-independent: a width and a
 * color are different groups (both kept), while two widths still conflict (last
 * wins, as intended). This is the fix; reordering classes only masks it.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "border-w": [{ border: ["chip", "box", "emphasis"] }],
      "bg-image": [{ bg: ["dots"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
