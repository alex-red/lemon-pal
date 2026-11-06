import { handleProblem } from "@/lib/handles";
import { requestStand, standNotFound } from "@/lib/session";
import { store } from "@/lib/store";

// Live availability for the editor's handle field: ?check=sunny-side.
export async function GET(request: Request) {
  const handle = (new URL(request.url).searchParams.get("check") ?? "").trim().toLowerCase();
  const problem = handleProblem(handle);
  if (problem) return Response.json({ available: false, problem });
  const [owner, stand] = await Promise.all([store.getStorefrontBySlug(handle), requestStand(request)]);
  if (!stand) return standNotFound();
  const available = !owner || owner.standId === stand.id;
  return Response.json(
    { available, problem: available ? null : "Another store already has that name." },
    { headers: { "Cache-Control": "no-store" } },
  );
}
