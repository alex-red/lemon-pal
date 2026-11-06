import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { LemonIcon, PageTransition, StorefrontHeader } from "@/components/kit";
import { env } from "@/lib/env";
import { handleProblem } from "@/lib/handles";
import { SESSION_COOKIE, sessionUserId } from "@/lib/session-token";
import { kindOf } from "@/lib/stands";
import { store } from "@/lib/store";
import { bannerUrl, methodsOffered, onlineItems, shipsOnline } from "@/lib/storefront";
import { DonationPage } from "./donation-page";
import { PreviewBar } from "./preview-bar";
import { StoreCart } from "./store-cart";

type Params = { params: Promise<{ handle: string }> };
type PageProps = Params & { searchParams: Promise<{ preview?: string | string[] }> };

async function load(handle: string) {
  // A malformed handle can't belong to a store, so it never reaches the database.
  if (handleProblem(handle)) return null;
  const storefront = await store.getStorefrontBySlug(handle);
  const stand = storefront ? await store.getStand(storefront.standId) : null;
  // Only an online stand has a public store, and only a donation stand with settings a donation page. A storefront
  // left on a local stand stays offline.
  if (!storefront || !stand) return null;
  const kind = kindOf(stand);
  return kind === "online" || (kind === "donation" && storefront.donation) ? { storefront, stand } : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  await connection();
  const found = await load((await params).handle);
  if (!found) return { title: "Store not found · Lemon Pal" };
  const { storefront } = found;
  const origin = env.publicAppUrl();
  const banner = bannerUrl(storefront);
  const description =
    storefront.intro.slice(0, 200) ||
    (storefront.donation ? `Give to ${storefront.title} with PayPal.` : `Order from ${storefront.title} and pay with PayPal.`);
  return {
    title: `${storefront.title} · Lemon Pal`,
    description,
    openGraph: {
      title: storefront.title,
      description,
      // Link previews need an absolute URL, so the banner joins them only when the public origin is known.
      ...(origin && banner ? { images: [{ url: `${origin.replace(/\/$/, "")}${banner}`, width: 1500, height: 500 }] } : {}),
    },
  };
}

// The public online store. Buyers land here from a shared link or a printed code.
export default async function StorePage({ params, searchParams }: PageProps) {
  await connection();
  const found = await load((await params).handle);
  if (!found) notFound();
  const { storefront, stand } = found;
  // ?preview=1 adds a bar that takes the seller back to the editor. Only the store's own seller sees it: a buyer who
  // adds the parameter gets the plain page. The page itself is exactly what buyers get. The session cookie is signed,
  // and the demo seller's is only handed out past the passcode.
  const previewing =
    (await searchParams).preview === "1" &&
    (await sessionUserId((await cookies()).get(SESSION_COOKIE)?.value)) === stand.ownerId;
  if (storefront.donation) return <DonationPage storefront={storefront} stand={stand} previewing={previewing} />;
  const items = onlineItems(stand, storefront);
  const open = storefront.open && Boolean(stand.publishedAt) && items.length > 0;

  return (
    <PageTransition>
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pt-6 pb-48 sm:px-8 sm:pt-8">
        {previewing ? <PreviewBar open={open} /> : null}
        <StorefrontHeader
          title={storefront.title}
          intro={storefront.intro}
          bannerUrl={bannerUrl(storefront)}
          accent={storefront.accent}
          closed={!open}
        />
        <StoreCart
          preview={previewing}
          handle={storefront.slug}
          currency={stand.currency}
          open={open}
          methods={methodsOffered(storefront)}
          shipping={storefront.shipping}
          pickupNote={storefront.pickupNote}
          items={items.map((item) => ({
            id: item.id,
            name: item.name,
            priceCents: item.priceCents,
            emoji: item.emoji,
            image: item.image,
            deal: item.deal,
            ships: shipsOnline(item),
            soldOut: item.soldOut === true,
          }))}
        />
        <footer className="mt-12 flex justify-center">
          <Link href="/" className="focus-ring inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-footnote text-ink-2 hover:bg-fill">
            <LemonIcon className="text-[1.1em]" /> Made with Lemon Pal
          </Link>
        </footer>
      </main>
    </PageTransition>
  );
}
