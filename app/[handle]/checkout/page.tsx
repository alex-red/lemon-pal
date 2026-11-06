import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowUturnIcon, Button, EyeIcon, Glass, PageTransition, Pill, WalletIcon } from "@/components/kit";
import { handleProblem } from "@/lib/handles";
import { CartError, type CartEntry } from "@/lib/sales";
import { SESSION_COOKIE, sessionUserId } from "@/lib/session-token";
import { kindOf } from "@/lib/stands";
import { store } from "@/lib/store";
import { priceOnlineOrder } from "@/lib/storefront";
import { OrderSummary } from "../../pay/order-summary";

export const metadata = { title: "Checkout preview · Lemon Pal", robots: { index: false } };

type Props = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ cart?: string | string[]; method?: string | string[] }>;
};

/** "sleepy-cat.3,frog-hat.1" into cart entries. Anything malformed is dropped. */
function parseCart(text: string | string[] | undefined): CartEntry[] {
  if (typeof text !== "string") return [];
  return text
    .split(",")
    .slice(0, 24)
    .map((part) => /^([A-Za-z0-9_-]{1,80})\.(\d{1,2})$/.exec(part))
    .filter((match) => match !== null)
    .map((match) => ({ itemId: match[1], quantity: Number(match[2]) }))
    .filter((entry) => entry.quantity >= 1);
}

// The seller's look at the buyer's pay page, from a customer preview of their store.
// It prices the cart exactly like a real order but never saves a sale and never loads PayPal.
export default async function CheckoutPreviewPage({ params, searchParams }: Props) {
  await connection();
  const { handle } = await params;
  if (handleProblem(handle)) notFound();
  const storefront = await store.getStorefrontBySlug(handle);
  const stand = storefront ? await store.getStand(storefront.standId) : null;
  if (!storefront || !stand || kindOf(stand) !== "online") notFound();
  // Only the store's own seller previews. Anyone else goes to the real store.
  if ((await sessionUserId((await cookies()).get(SESSION_COOKIE)?.value)) !== stand.ownerId) redirect(`/${handle}`);

  const query = await searchParams;
  const method = query.method === "ship" ? "ship" : "pickup";
  const storeUrl = `/${storefront.slug}?preview=1`;
  let order: ReturnType<typeof priceOnlineOrder> | null = null;
  let problem: string | null = null;
  try {
    // A closed store can still be previewed, so price it as if it were open.
    order = priceOnlineOrder(stand, { ...storefront, open: true }, parseCart(query.cart), method);
  } catch (error) {
    if (!(error instanceof CartError)) throw error;
    problem = error.message;
  }

  return (
    <PageTransition>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 pt-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <Glass className="sticky top-[max(0.75rem,env(safe-area-inset-top))] z-30 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[26px] py-1.5 pr-1.5 pl-3">
          <Pill tone="lemon" icon={<EyeIcon />}>
            Checkout preview
          </Pill>
          <Link
            href={storeUrl}
            transitionTypes={["nav-back"]}
            className="pressable focus-ring inline-flex h-11 items-center gap-2 rounded-full px-4 text-callout font-semibold text-ink hover:bg-fill-2"
          >
            <ArrowUturnIcon className="text-[1.1em]" /> Back to the store
          </Link>
        </Glass>

        {order ? (
          <>
            <OrderSummary
              eyebrow="You’re paying"
              title={storefront.title || stand.name}
              currency={stand.currency}
              lines={order.lines}
              totalCents={order.totalCents}
              shippingCents={order.shippingCents}
              fulfillment={order.fulfillment}
              pickupNote={storefront.pickupNote}
            />
            <div className="flex flex-col items-center gap-3 pt-2">
              {/* Where the PayPal button goes for a buyer. Off here, so nothing is ordered or charged. */}
              <Button variant="filled" size="xl" icon={<WalletIcon />} disabled className="w-full">
                Pay with PayPal
              </Button>
              <p className="text-center text-subhead text-ink-2">
                Payment is off in preview. This order wasn&rsquo;t saved, and the buyer&rsquo;s PayPal button goes here.
              </p>
            </div>
          </>
        ) : (
          <p role="alert" className="text-center text-body text-ink-2">
            {problem ?? "Add something to the cart first."}
          </p>
        )}
      </main>
    </PageTransition>
  );
}
