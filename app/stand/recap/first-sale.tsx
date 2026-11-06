"use client";

import { createContext, use, useState, type ReactNode } from "react";
import { FirstSalePill } from "@/components/kit";

type FirstSale = { seconds: number | null; setSeconds: (seconds: number | null) => void };

const FirstSaleContext = createContext<FirstSale | null>(null);

/** Shares the time to first sale from the recap's polling with the page header, so there's one poll. */
export function FirstSaleProvider({ children }: { children: ReactNode }) {
  const [seconds, setSeconds] = useState<number | null>(null);
  return <FirstSaleContext value={{ seconds, setSeconds }}>{children}</FirstSaleContext>;
}

export function useSetFirstSale() {
  return use(FirstSaleContext)?.setSeconds;
}

export function FirstSaleBadge() {
  const seconds = use(FirstSaleContext)?.seconds;
  return seconds != null ? <FirstSalePill seconds={seconds} className="animate-pop" /> : null;
}
