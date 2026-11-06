import Link from "next/link";
import { ArrowUturnIcon, EyeIcon, Glass, Pill } from "@/components/kit";

/** Floats over the seller's own store while they look at it the way a buyer would. */
export function PreviewBar({ open, donation = false }: { open: boolean; donation?: boolean }) {
  return (
    <Glass className="sticky top-[max(0.75rem,env(safe-area-inset-top))] z-30 mb-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[26px] py-1.5 pr-1.5 pl-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 py-1">
        <Pill tone="lemon" icon={<EyeIcon />}>
          Customer preview
        </Pill>
        <span className="text-footnote text-ink-2">
          {donation
            ? open
              ? "Donors see this page. The button is off while you preview."
              : "Donors see this page as closed."
            : open
              ? "Try the cart. Checkout shows the pay page without taking payment."
              : "Buyers see this store as closed. You can still try the cart."}
        </span>
      </div>
      <Link
        href={donation ? "/stand/jar/edit" : "/stand/store"}
        transitionTypes={["nav-back"]}
        className="pressable focus-ring inline-flex h-11 items-center gap-2 rounded-full px-4 text-callout font-semibold text-ink hover:bg-fill-2"
      >
        <ArrowUturnIcon className="text-[1.1em]" /> Back to editor
      </Link>
    </Glass>
  );
}
