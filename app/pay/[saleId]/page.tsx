import { notFound } from "next/navigation";
import { connection } from "next/server";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { store } from "@/lib/store";
import { Checkout } from "./checkout";

// Buyer checkout opened from the QR code. Keep this page small: it loads on a phone over cell data.
export default async function PayPage({ params }: { params: Promise<{ saleId: string }> }) {
  await connection();
  const { saleId } = await params;
  const sale = await store.getSale(saleId);
  if (!sale) notFound();

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold">🍋 Your order</h1>
      <ul className="mt-4 divide-y">
        {sale.lines.map((line) => (
          <li key={line.itemId} className="flex justify-between py-2">
            <span>
              {line.quantity} × {line.name}
            </span>
            <span>{formatMoney(line.unitPriceCents * line.quantity, sale.currency)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex justify-between text-xl font-bold">
        <span>Total</span>
        <span>{formatMoney(sale.totalCents, sale.currency)}</span>
      </p>
      {sale.status === "paid" ? (
        <p className="mt-8 text-center text-3xl font-bold text-leaf">🍋 Paid. Thank you!</p>
      ) : sale.status === "canceled" ? (
        <p className="mt-8 text-center text-lg">The seller canceled this sale. Ask them for a new code.</p>
      ) : (
        <Checkout saleId={sale.id} clientId={env.paypalClientId()} sdkUrl={env.paypalSdkUrl()} currency={sale.currency} />
      )}
    </main>
  );
}
