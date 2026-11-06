import { BoxIcon, GroupedList, LemonIcon, ListRow, Money, PinIcon, TagIcon } from "@/components/kit";
import { dealLabel, lineTotalCents } from "@/lib/deals";
import { formatMoney, type Cents } from "@/lib/money";
import type { Fulfillment, SaleLine } from "@/lib/types";

type Props = {
  /** "You're paying", or "Refunded by" once refunded. */
  eyebrow: string;
  title: string;
  currency: string;
  lines: SaleLine[];
  totalCents: Cents;
  shippingCents?: Cents;
  fulfillment?: Fulfillment;
  pickupNote?: string;
  /** A donation: one amount the donor chose, so there are no lines to list. */
  gift?: boolean;
};

/** The top of the buyer's pay page: who they're paying, the total, and every line that adds up to it. */
export function OrderSummary({ eyebrow, title, currency, lines, totalCents, shippingCents, fulfillment, pickupNote, gift = false }: Props) {
  return (
    <>
      <header className="flex flex-col items-center gap-3 text-center">
        <span className="grid size-14 place-items-center rounded-[18px] bg-lemon text-[2rem] shadow-card">
          <LemonIcon className="text-[oklch(0.23_0.03_85)]" />
        </span>
        <div className="flex flex-col gap-0.5">
          <p className="text-footnote font-semibold text-ink-2">{eyebrow}</p>
          <h1 className="font-display text-large-title font-semibold text-balance">{title}</h1>
        </div>
        <Money cents={totalCents} currency={currency} size="hero" />
      </header>

      {gift ? null : (
        <GroupedList header="Your order">
          {lines.map((line) => (
            <ListRow
              key={line.itemId}
              icon={line.emoji ? <span className="text-[1.1rem]">{line.emoji}</span> : undefined}
              title={line.name}
              subtitle={`${line.quantity} × ${formatMoney(line.unitPriceCents, currency)}`}
              trailing={formatMoney(line.unitPriceCents * line.quantity, currency)}
            />
          ))}
          {/* Each deal is its own line, so the buyer sees the saving, and the lines add up to the total. */}
          {lines
            .filter((line) => line.deal && line.discountCents)
            .map((line) => (
              <ListRow
                key={`${line.itemId}-deal`}
                icon={<TagIcon className="text-[1.1rem] text-leaf" />}
                title={`${line.name} deal`}
                subtitle={`${dealLabel(line.deal!, currency)} · ${formatMoney(lineTotalCents(line), currency)} for ${line.quantity}`}
                trailing={<span className="text-leaf">−{formatMoney(line.discountCents!, currency)}</span>}
              />
            ))}
          {fulfillment?.method === "ship" ? (
            <ListRow
              icon={<BoxIcon />}
              iconTone="pool"
              title="Shipping"
              subtitle={
                fulfillment.address
                  ? `To ${[fulfillment.address.city, fulfillment.address.region].filter(Boolean).join(", ")}`
                  : "PayPal asks where to send it"
              }
              trailing={shippingCents ? formatMoney(shippingCents, currency) : "Free"}
            />
          ) : null}
          {fulfillment?.method === "pickup" ? (
            <ListRow icon={<PinIcon />} title="Pickup" subtitle={pickupNote || "Collect it from the seller"} trailing="Free" />
          ) : null}
        </GroupedList>
      )}
    </>
  );
}
