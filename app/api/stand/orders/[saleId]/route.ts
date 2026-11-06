import { z } from "zod";
import { DEMO_STAND_ID } from "@/lib/demo";
import { toSellerOrder } from "@/lib/orders";
import { addTracking, PayPalError } from "@/lib/paypal";
import { store } from "@/lib/store";
import type { Fulfillment, Sale } from "@/lib/types";

const ActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("ship"),
    carrier: z.enum(["USPS", "UPS", "FEDEX", "DHL", "OTHER"]),
    carrierName: z.string().trim().max(60).optional(),
    tracking: z.string().trim().max(64).regex(/^[A-Za-z0-9 -]*$/).optional(),
  }),
  z.object({ action: z.literal("collect") }),
]);

type PaidOnline = Sale & { paidAt: string; fulfillment: Fulfillment };
const isPaidOnline = (s: Sale | null): s is PaidOnline =>
  Boolean(s && s.standId === DEMO_STAND_ID && s.channel === "online" && s.status === "paid" && s.paidAt && s.fulfillment);

// Marks an online order shipped (with optional tracking, passed on to PayPal) or picked up.
export async function POST(request: Request, { params }: { params: Promise<{ saleId: string }> }) {
  const parsed = ActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the carrier and tracking number." }, { status: 400 });
  const { saleId } = await params;
  const input = parsed.data;

  const existing = await store.getSale(saleId);
  if (!isPaidOnline(existing)) return Response.json({ error: "not found" }, { status: 404 });
  if (input.action === "ship" && existing.fulfillment.method !== "ship") {
    return Response.json({ error: "This order is for pickup." }, { status: 409 });
  }
  if (input.action === "collect" && existing.fulfillment.method !== "pickup") {
    return Response.json({ error: "This order ships." }, { status: 409 });
  }

  const now = new Date().toISOString();
  let sale = await store.updateSale(saleId, (s) => {
    const f = s.fulfillment;
    if (input.action === "collect" && f?.method === "pickup") {
      return { ...s, fulfillment: { ...f, status: "collected", collectedAt: now } };
    }
    if (input.action === "ship" && f?.method === "ship") {
      return {
        ...s,
        fulfillment: {
          ...f,
          status: "shipped",
          shippedAt: f.shippedAt ?? now,
          carrier: input.carrier,
          carrierName: input.carrier === "OTHER" ? input.carrierName : undefined,
          tracking: input.tracking || undefined,
          trackingSentToPayPal: false,
        },
      };
    }
    return null;
  });

  // Shipped is recorded either way. PayPal tracking is a bonus for the buyer and for seller protection.
  // A demo order has no PayPal order behind it, so its tracking stays here.
  if (input.action === "ship" && input.tracking && sale && !sale.demo) {
    let sent = false;
    try {
      await addTracking(sale, { tracking: input.tracking, carrier: input.carrier, carrierName: input.carrierName });
      sent = true;
    } catch (error) {
      console.error(error instanceof PayPalError ? error.message : error);
    }
    sale = await store.updateSale(saleId, (s) =>
      s.fulfillment?.method === "ship" ? { ...s, fulfillment: { ...s.fulfillment, trackingSentToPayPal: sent } } : null,
    );
  }
  return Response.json(isPaidOnline(sale) ? toSellerOrder(sale) : null);
}
