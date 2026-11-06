"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DraftItem } from "@/lib/types";

type Row = { key: number; name: string; price: string; needsCheck: boolean };

let nextKey = 1;

function toRow(item: DraftItem): Row {
  return {
    key: nextKey++,
    name: item.name,
    price: item.priceCents === null ? "" : (item.priceCents / 100).toFixed(2),
    needsCheck: item.priceCents === null || item.confidence === "low",
  };
}

/** "2.5", "$2.50", "2" → cents. null if it isn't a plain positive amount. */
function parsePrice(text: string): number | null {
  const match = text.trim().replace(/^\$/, "").match(/^(\d{1,4})(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return cents > 0 ? cents : null;
}

/** Phone photos are often larger than the model's 5 MB image limit, so shrink before upload. */
async function shrinkPhoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

export function Setup() {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<"reading" | "publishing" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setRows(null);
    setPreview(URL.createObjectURL(file));
    setBusy("reading");
    try {
      const form = new FormData();
      form.append("photo", await shrinkPhoto(file), "sign.jpg");
      const res = await fetch("/api/stand/sign", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't read the sign.");
      const items = json.items as DraftItem[];
      if (items.length === 0) throw new Error("No prices found in that photo. Try a closer, straighter shot.");
      setRows(items.map(toRow));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function update(key: number, change: Partial<Row>) {
    setRows((current) => current?.map((row) => (row.key === key ? { ...row, ...change } : row)) ?? null);
  }

  const invalid = rows?.some((row) => !row.name.trim() || parsePrice(row.price) === null) ?? true;

  async function publish() {
    if (!rows || invalid) return;
    setBusy("publishing");
    setError(null);
    const res = await fetch("/api/stand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: rows.map((row) => ({ name: row.name.trim(), priceCents: parsePrice(row.price) })) }),
    });
    if (res.ok) return router.push("/stand/register");
    setBusy(null);
    setError((await res.json().catch(() => ({}))).error ?? "Couldn't publish the stand.");
  }

  async function useSample() {
    setBusy("publishing");
    await fetch("/api/stand", { method: "DELETE" });
    router.push("/stand/register");
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-3xl border-4 border-dashed border-lemon-deep bg-lemon/30 p-8 text-center">
        <span className="text-xl font-semibold">{rows ? "Retake photo" : "📷 Photograph your sign"}</span>
        <span className="opacity-70">or choose a photo you already took</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={busy !== null}
          onChange={(e) => onPhoto(e.target.files?.[0])}
        />
      </label>

      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
        <img src={preview} alt="Your price sign" className="max-h-64 self-center rounded-2xl object-contain" />
      ) : null}

      {busy === "reading" ? <p className="text-center text-lg">🍋 Reading your sign…</p> : null}
      {error ? <p className="text-center text-red-600">{error}</p> : null}

      {rows ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Check your items</h2>
          {rows.some((row) => row.needsCheck) ? (
            <p className="opacity-80">Items marked ⚠️ were hard to read. Check or enter their prices.</p>
          ) : null}
          {rows.map((row) => {
            const priceOk = parsePrice(row.price) !== null;
            return (
              <div key={row.key} className="flex items-center gap-2">
                <span className="w-6 text-center" aria-hidden>
                  {row.needsCheck ? "⚠️" : ""}
                </span>
                <input
                  aria-label="Item name"
                  value={row.name}
                  onChange={(e) => update(row.key, { name: e.target.value })}
                  className="min-w-0 flex-1 rounded-xl border-2 bg-transparent px-3 py-2 text-lg"
                />
                <span className="text-lg">$</span>
                <input
                  aria-label={`Price for ${row.name || "item"}`}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={row.price}
                  onChange={(e) => update(row.key, { price: e.target.value })}
                  className={`w-24 rounded-xl border-2 bg-transparent px-3 py-2 text-lg ${priceOk ? "" : "border-red-500"}`}
                />
                <button
                  aria-label={`Remove ${row.name || "item"}`}
                  onClick={() => setRows((current) => current?.filter((r) => r.key !== row.key) ?? null)}
                  className="rounded-xl px-3 py-2 text-xl"
                >
                  ✕
                </button>
              </div>
            );
          })}
          <button
            onClick={() => setRows((current) => [...(current ?? []), { key: nextKey++, name: "", price: "", needsCheck: false }])}
            className="self-start rounded-xl border-2 px-4 py-2"
          >
            + Add item
          </button>
          <button
            onClick={publish}
            disabled={invalid || busy !== null}
            className="mt-2 rounded-2xl bg-foreground px-6 py-4 text-xl text-background disabled:opacity-40"
          >
            {busy === "publishing" ? "Publishing…" : "Publish stand"}
          </button>
        </section>
      ) : null}

      <button onClick={useSample} disabled={busy !== null} className="self-center text-sm underline opacity-70">
        Use the sample lemonade stand instead
      </button>
    </div>
  );
}
