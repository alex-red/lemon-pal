// Reads a price-sign photo into a draft catalog (DraftItem[]) with a vision model.
// Not implemented yet. Needs rate limiting before the judge build is public.
export async function POST() {
  return Response.json({ error: "Sign reading is not implemented yet" }, { status: 501 });
}
