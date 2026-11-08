import type { ReactNode } from "react";
import { PalProvider } from "./pal/pal";

// Pal, the stand assistant, lives here so a chat carries on as the seller moves between screens.
// Page transitions stay in each page.tsx.
export default function StandLayout({ children }: { children: ReactNode }) {
  return <PalProvider>{children}</PalProvider>;
}
