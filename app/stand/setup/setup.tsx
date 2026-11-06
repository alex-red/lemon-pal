"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Button,
  CameraIcon,
  Card,
  cn,
  ConfidencePill,
  ExclamationIcon,
  LemonIcon,
  Pill,
  PlusIcon,
  Spinner,
  TextField,
  XmarkIcon,
} from "@/components/kit";
import type { DraftItem } from "@/lib/types";

type Row = { key: number; name: string; price: string; confidence: "high" | "low" | null; unreadPrice: boolean };

let nextKey = 1;

function toRow(item: DraftItem): Row {
  return {
    key: nextKey++,
    name: item.name,
    price: item.priceCents === null ? "" : (item.priceCents / 100).toFixed(2),
    confidence: item.priceCents === null ? "low" : item.confidence,
    unreadPrice: item.priceCents === null,
  };
}

/** "2.5", "$2.50", "2" → cents. null if it isn't a plain positive amount. */
function parsePrice(text: string): number | null {
  const match = text.trim().replace(/^[^\d.]+/, "").match(/^(\d{1,4})(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return cents > 0 ? cents : null;
}

function currencySymbol(currency: string) {
  return (
    new Intl.NumberFormat(undefined, { style: "currency", currency }).formatToParts(0).find((p) => p.type === "currency")
      ?.value ?? currency
  );
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

export function Setup({ currency }: { currency: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<"reading" | "publishing" | "sample" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const symbol = currencySymbol(currency);

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

  const invalid = !rows?.length || rows.some((row) => !row.name.trim() || parsePrice(row.price) === null);
  const toCheck = rows?.filter((row) => row.confidence === "low").length ?? 0;

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
    setBusy("sample");
    await fetch("/api/stand", { method: "DELETE" });
    router.push("/stand/register");
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-7 px-5 pt-8 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-footnote font-semibold text-ink-2">
            <LemonIcon className="text-[1.1rem]" /> Create your stand
          </p>
          <h1 className="font-display text-large-title font-semibold">Snap your price sign</h1>
        </div>
        <Link
          href="/stand/register"
          className="pressable focus-ring inline-flex h-11 items-center rounded-full px-4 text-callout font-semibold text-peel hover:bg-fill"
        >
          Register
        </Link>
      </header>

      <Card className="overflow-hidden">
        <label
          className={cn(
            "flex cursor-pointer flex-col items-center gap-3 p-8 text-center",
            "has-[:focus-visible]:shadow-[inset_0_0_0_3px_var(--focus)]",
            busy ? "pointer-events-none" : "pressable",
          )}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img src={preview} alt="Your price sign" className="max-h-60 rounded-[14px] object-contain shadow-card" />
          ) : (
            <span className="grid size-16 place-items-center rounded-[20px] bg-lemon text-[2rem] text-[oklch(0.23_0.03_85)] shadow-card">
              <CameraIcon />
            </span>
          )}
          <span className="text-title3 font-semibold">{rows || preview ? "Retake photo" : "Photograph your sign"}</span>
          <span className="text-subhead text-ink-2">
            {preview ? "LemonPal reads the names and prices for you to check." : "LemonPal reads your items and prices. Or choose a photo you already took."}
          </span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={busy !== null}
            onChange={(e) => {
              void onPhoto(e.target.files?.[0]);
              e.target.value = ""; // lets the same photo be picked again
            }}
          />
        </label>
      </Card>

      <div aria-live="polite" className="flex flex-col items-center gap-2 text-center empty:hidden">
        {busy === "reading" ? (
          <p className="flex items-center gap-2 text-headline">
            <Spinner className="text-[1.2rem]" /> Reading your sign…
          </p>
        ) : null}
        {error ? (
          <div role="alert" className="flex flex-col items-center gap-2">
            <Pill tone="berry" icon={<ExclamationIcon />}>
              Not yet
            </Pill>
            <p className="text-body text-ink-2">{error}</p>
          </div>
        ) : null}
      </div>

      {rows ? (
        <section aria-labelledby="review-heading" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 px-1">
            <h2 id="review-heading" className="font-display text-title2 font-semibold">
              Check your items
            </h2>
            <p className="text-subhead text-ink-2">
              {toCheck > 0
                ? `${toCheck} ${toCheck === 1 ? "item was" : "items were"} hard to read. Check ${toCheck === 1 ? "it" : "them"} before you publish.`
                : "Everything read clearly. Fix anything that looks off."}
            </p>
          </div>

          <ul className="flex flex-col gap-3">
            {rows.map((row, i) => {
              const priceText = row.price.trim();
              const priceError = priceText && parsePrice(priceText) === null ? "Enter an amount like 2.50" : undefined;
              const priceHint = !priceText && row.unreadPrice ? "Couldn’t read this price. Enter it here." : undefined;
              return (
                <li key={row.key}>
                  <Card className="flex flex-col gap-3 p-4">
                    <div className="flex items-center justify-between gap-3">
                      {row.confidence ? <ConfidencePill confidence={row.confidence} /> : <span />}
                      <Button
                        variant="ghost"
                        iconOnly
                        aria-label={`Remove ${row.name || `item ${i + 1}`}`}
                        icon={<XmarkIcon />}
                        onClick={() => setRows((current) => current?.filter((r) => r.key !== row.key) ?? null)}
                      />
                    </div>
                    <div className="grid grid-cols-[1fr_8.5rem] items-start gap-3">
                      <TextField
                        label="Item"
                        value={row.name}
                        maxLength={60}
                        // Only flag a missing name once there's a price, so a just-added row isn't already red.
                        error={!row.name.trim() && row.price.trim() ? "Give it a name" : undefined}
                        onChange={(e) => update(row.key, { name: e.target.value })}
                      />
                      <TextField
                        label="Price"
                        prefix={symbol}
                        inputMode="decimal"
                        placeholder="0.00"
                        value={row.price}
                        hint={priceHint}
                        error={priceError}
                        onChange={(e) => update(row.key, { price: e.target.value })}
                      />
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>

          <Button
            variant="tinted"
            icon={<PlusIcon />}
            className="self-start"
            onClick={() =>
              setRows((current) => [
                ...(current ?? []),
                { key: nextKey++, name: "", price: "", confidence: null, unreadPrice: false },
              ])
            }
          >
            Add item
          </Button>

          <Button
            variant="filled"
            size="xl"
            className="mt-2 w-full"
            disabled={invalid || busy !== null}
            loading={busy === "publishing"}
            onClick={publish}
          >
            Publish stand
          </Button>
          {invalid ? (
            <p className="-mt-2 text-center text-footnote text-ink-2">Every item needs a name and a price.</p>
          ) : null}
        </section>
      ) : null}

      <Button variant="plain" className="self-center" loading={busy === "sample"} disabled={busy !== null} onClick={useSample}>
        Use the sample lemonade stand instead
      </Button>
    </main>
  );
}
