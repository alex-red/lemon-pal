import { ViewTransition, type ReactNode } from "react";

/**
 * Slides a page in and out when a link or router call tags the navigation with "nav-forward" (deeper in,
 * from the trailing edge) or "nav-back" (back out, from the leading edge). Wrap each page's content in
 * page.tsx, not a layout, since layouts stay put across navigations. Untagged navigations, like the
 * browser's own back button, don't animate.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
