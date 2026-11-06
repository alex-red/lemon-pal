import { env } from "@/lib/env";
import { readPayPalReceipt } from "@/lib/paypal-mcp";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";
import { ownedSale } from "@/lib/session";

const allow = createRateLimiter({ limit: 30, windowMs: 60_000 });

export async function GET(request: Request, { params }: { params: Promise<{ saleId: string }> }) {
  if (!env.paypalReceiptCheck()) return Response.json({ error: "PayPal receipt checks are off." }, { status: 404 });
  if (!allow(clientKey(request))) return Response.json({ error: "Too many receipt checks. Try again in a minute." }, { status: 429 });

  const { saleId } = await params;
  // Only a receipt on one of the seller's own stands.
  const sale = (await ownedSale(saleId))?.sale;
  if (!sale) return Response.json({ error: "Receipt not found." }, { status: 404 });
  if (sale.demo) return Response.json({ error: "This sample receipt has no PayPal payment." }, { status: 409 });
  if ((sale.status !== "paid" && sale.status !== "refunded") || !sale.paypalOrderId || !sale.paypalCaptureId) {
    return Response.json({ error: "This receipt has no recorded PayPal capture." }, { status: 409 });
  }

  try {
    const payment = await readPayPalReceipt(sale.paypalOrderId, sale.paypalCaptureId, request.signal);
    return Response.json({
      ...payment,
      receiptCents: sale.totalCents,
      receiptCurrency: sale.currency,
      matchesReceipt: payment.currency === sale.currency && payment.capturedCents === sale.totalCents,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "PayPal Sandbox couldn't verify this receipt right now." }, { status: 502 });
  }
}
