import { notFound } from "next/navigation";
import { connection } from "next/server";
import { env } from "@/lib/env";
import { GroupedList, LemonIcon, ListRow, Money, PaidMoment, SaleStatusPill } from "@/components/kit";
import { formatMoney } from "@/lib/money";
import { store } from "@/lib/store";
import { Checkout } from "./checkout";

// Buyer checkout opened from the QR code. Keep this page small: it loads on a phone over cell data.
export default async function PayPage({ params }: { params: Promise<{ saleId: string }> }) {
  await connection();
  const { saleId } = await params;
  const sale = await store.getSale(saleId);
  if (!sale) notFound();
  const stand = await store.getStand(sale.standId);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 pt-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <header className="flex flex-col items-center gap-3 text-center">
        <span className="grid size-14 place-items-center rounded-[18px] bg-lemon text-[2rem] shadow-card">
          <LemonIcon className="text-[oklch(0.23_0.03_85)]" />
        </span>
        <div className="flex flex-col gap-0.5">
          <p className="text-footnote font-semibold text-ink-2">You’re paying</p>
          <h1 className="font-display text-large-title font-semibold text-balance">{stand?.name || "LemonPal"}</h1>
        </div>
        <Money cents={sale.totalCents} currency={sale.currency} size="hero" />
      </header>

      <GroupedList header="Your order">
        {sale.lines.map((line) => (
          <ListRow
            key={line.itemId}
            icon={line.emoji ? <span className="text-[1.1rem]">{line.emoji}</span> : undefined}
            title={line.name}
            subtitle={`${line.quantity} × ${formatMoney(line.unitPriceCents, sale.currency)}`}
            trailing={formatMoney(line.unitPriceCents * line.quantity, sale.currency)}
          />
        ))}
      </GroupedList>

      {sale.status === "paid" ? (
        <PaidMoment
          cents={sale.totalCents}
          currency={sale.currency}
          caption="Thank you! PayPal will email you a receipt."
          className="pt-4"
        />
      ) : sale.status === "canceled" ? (
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <SaleStatusPill status="canceled" />
          <p className="text-body text-ink-2">The seller canceled this sale. Ask them for a new code.</p>
        </div>
      ) : (
        <Checkout
          saleId={sale.id}
          clientId={env.paypalClientId()}
          sdkUrl={env.paypalSdkUrl()}
          currency={sale.currency}
          totalCents={sale.totalCents}
        />
      )}
    </main>
  );
}
