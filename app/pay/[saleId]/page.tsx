import { notFound } from "next/navigation";
import { connection } from "next/server";
import { formatMoney } from "@/lib/money";
import { store } from "@/lib/store";

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
        <p className="mt-8 text-center text-3xl font-bold text-leaf">Paid. Thank you!</p>
      ) : (
        // TODO: mount PayPal JS SDK buttons: createOrder → POST /api/sales/[id]/order, onApprove → POST /api/sales/[id]/capture
        <p className="mt-8 rounded-xl border border-dashed p-6 text-center opacity-60">PayPal checkout goes here.</p>
      )}
    </main>
  );
}
