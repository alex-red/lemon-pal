import { countryName } from "@/lib/shipping";
import type { Fulfillment, PostalAddress, StorefrontAccent } from "@/lib/types";
import { cn } from "./cn";
import { BoxIcon, CheckIcon, ClockIcon, LemonIcon, PinIcon } from "./icons";
import { Pill } from "./status";

// The banner wash when a store has no photo. Text on lemon stays dark in both themes.
const washes: Record<StorefrontAccent, string> = {
  lemon: "bg-linear-to-br from-lemon to-lemon-deep text-[oklch(0.23_0.03_85)]",
  leaf: "bg-linear-to-br from-leaf to-leaf/70 text-on-accent",
  berry: "bg-linear-to-br from-berry to-berry/70 text-on-accent",
};

/**
 * The top of an online store: a 3:1 banner, the title and the intro. The editor's preview renders the same
 * component, so what the seller sees is what the buyer gets.
 */
export function StorefrontHeader({
  title,
  intro,
  bannerUrl,
  accent,
  closed = false,
  className,
}: {
  title: string;
  intro?: string;
  bannerUrl?: string | null;
  accent: StorefrontAccent;
  /** Shows a Closed pill. The page still lists items, so buyers know what to come back for. */
  closed?: boolean;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-5", className)}>
      <div className={cn("relative aspect-[3/1] overflow-hidden rounded-card shadow-card ring-[0.5px] ring-hairline", !bannerUrl && washes[accent])}>
        {bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a small seller photo served by our own route
          <img src={bannerUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <LemonIcon aria-hidden className="absolute top-1/2 right-[6%] -translate-y-1/2 text-[min(9rem,22vw)] opacity-30" />
        )}
      </div>
      <div className="flex flex-col gap-2 px-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="font-display text-large-title font-semibold text-balance [overflow-wrap:anywhere]">{title || "Your store"}</h1>
          {closed ? (
            <Pill icon={<ClockIcon />}>Closed for now</Pill>
          ) : null}
        </div>
        {intro ? <p className="max-w-2xl text-body whitespace-pre-line text-ink-2">{intro}</p> : null}
      </div>
    </header>
  );
}

const fulfillmentStatus = {
  to_ship: { tone: "pool", icon: <BoxIcon />, label: "To ship" },
  shipped: { tone: "leaf", icon: <CheckIcon strokeWidth={2.25} />, label: "Shipped" },
  to_collect: { tone: "lemon", icon: <PinIcon />, label: "To pick up" },
  collected: { tone: "leaf", icon: <CheckIcon strokeWidth={2.25} />, label: "Picked up" },
} as const;

/** Where an online order is: waiting to ship or be collected, or done. Color, icon and word together. */
export function FulfillmentPill({ fulfillment, className }: { fulfillment: Pick<Fulfillment, "status">; className?: string }) {
  const s = fulfillmentStatus[fulfillment.status];
  return (
    <Pill tone={s.tone} icon={s.icon} className={className}>
      {s.label}
    </Pill>
  );
}

/** A postal address laid out the way a label is written. */
export function AddressBlock({ recipient, address, className }: { recipient?: string; address: PostalAddress; className?: string }) {
  const town = [address.city, [address.region, address.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return (
    <address className={cn("text-body not-italic leading-snug", className)}>
      {recipient ? <span className="block font-semibold">{recipient}</span> : null}
      <span className="block">{address.line1}</span>
      {address.line2 ? <span className="block">{address.line2}</span> : null}
      {town ? <span className="block">{town}</span> : null}
      <span className="block text-ink-2">{countryName(address.country, "en")}</span>
    </address>
  );
}

/** One line of text for copying an address into a shipping label tool. */
export function addressText(recipient: string | undefined, address: PostalAddress): string {
  return [
    recipient,
    address.line1,
    address.line2,
    [address.city, [address.region, address.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    countryName(address.country, "en"),
  ]
    .filter(Boolean)
    .join("\n");
}
