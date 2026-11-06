import { safeNextPath, sellerPasscode } from "@/lib/seller-auth";
import { PageTransition } from "@/components/kit";
import { Unlock } from "./unlock";

export const metadata = { title: "Seller sign-in · Lemon Pal" };

export default async function UnlockPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <PageTransition>
      <Unlock next={safeNextPath(next)} configured={Boolean(sellerPasscode())} />
    </PageTransition>
  );
}
