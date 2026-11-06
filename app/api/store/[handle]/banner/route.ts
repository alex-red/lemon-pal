import { store } from "@/lib/store";

// Serves a store's banner as an image, so the store page stays small and link previews have a real URL.
// The URL carries the storefront's updatedAt, so a cached copy is never stale.
export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const storefront = await store.getStorefrontBySlug(handle);
  const match = storefront?.banner?.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return new Response("not found", { status: 404 });
  return new Response(Buffer.from(match[1], "base64"), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
