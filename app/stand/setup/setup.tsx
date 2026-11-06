"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AIGlow,
  Button,
  CameraIcon,
  Card,
  ConfidencePill,
  ExclamationIcon,
  LemonIcon,
  ListIcon,
  MoreBelow,
  PhotoIcon,
  Pill,
  PlusIcon,
  scrollToReveal,
  ShimmerText,
  SparklesIcon,
  TextArea,
  TextField,
  useReveal,
  XmarkIcon,
} from "@/components/kit";
import { cleanEmoji } from "@/lib/emoji";
import type { DraftItem, Region, SignDraft } from "@/lib/types";
import { CameraSheet, canUseLiveCamera } from "./camera-sheet";

type Row = {
  key: number;
  emoji: string;
  name: string;
  price: string;
  confidence: "high" | "low" | null;
  unreadPrice: boolean;
  /** A thumbnail cropped from the seller's photo, when the reader found where the item is. */
  image?: string;
};

let nextKey = 1;

function toRow(item: DraftItem): Row {
  return {
    key: nextKey++,
    emoji: item.emoji ?? "",
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

/** The emoji the seller typed last, so typing a new one replaces the old one. "" if there's none. */
function lastEmoji(text: string): string {
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((g) => g.segment);
  return graphemes.reverse().map((g) => cleanEmoji(g)).find(Boolean) ?? "";
}

function currencySymbol(currency: string) {
  return (
    new Intl.NumberFormat(undefined, { style: "currency", currency }).formatToParts(0).find((p) => p.type === "currency")
      ?.value ?? currency
  );
}

const emptyRow = (): Row => ({ key: nextKey++, emoji: "", name: "", price: "", confidence: null, unreadPrice: false });

/** Phone photos are often larger than the model's 5 MB image limit, so shrink before upload. */
async function shrinkPhoto(file: Blob): Promise<Blob> {
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

/**
 * Crops a square thumbnail around each region, for items read from a display rather than a written sign.
 * The square is centred on the region and grown to its longer side, so a wide shelf keeps its products in frame.
 */
async function cropThumbnails(photo: Blob, regions: (Region | undefined)[]): Promise<(string | undefined)[]> {
  if (!regions.some(Boolean)) return regions.map(() => undefined);
  try {
    const bitmap = await createImageBitmap(photo);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = THUMB_SIZE;
    const context = canvas.getContext("2d")!;
    return regions.map((region) => {
      if (!region) return undefined;
      const side = Math.min(
        Math.max(region.width * bitmap.width, region.height * bitmap.height) * 1.08,
        bitmap.width,
        bitmap.height,
      );
      const left = Math.min(Math.max((region.x + region.width / 2) * bitmap.width - side / 2, 0), bitmap.width - side);
      const top = Math.min(Math.max((region.y + region.height / 2) * bitmap.height - side / 2, 0), bitmap.height - side);
      context.drawImage(bitmap, left, top, side, side, 0, 0, THUMB_SIZE, THUMB_SIZE);
      return canvas.toDataURL("image/jpeg", 0.8);
    });
  } catch {
    return regions.map(() => undefined);
  }
}

/** Register tiles show thumbnails at about 4rem, so this stays sharp on a 3x screen. */
const THUMB_SIZE = 192;

/** Real stand photos, bundled for demos without a stand on hand. The reader finds no stand name in either. */
const DEMO_PHOTOS = [
  { id: "lemonade", label: "Lemonade Stand Sign", src: "/demo/lemonade-stand-sign.jpg", standName: "Lemonade Stand" },
  { id: "booth", label: "Messy Convention Booth", src: "/demo/convention-booth.jpg", standName: "Plush Booth" },
] as const;

type SampleChoice = { id: string; name: string; emoji: string };

export function Setup({ currency, standName, samples }: { currency: string; standName: string; samples: SampleChoice[] }) {
  const router = useRouter();
  const [name, setName] = useState(standName);
  const [preview, setPreview] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<"reading" | "publishing" | `sample:${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Where the draft came from, which changes the review copy.
  const [source, setSource] = useState<"photo" | "list" | "blank" | null>(null);
  const [camera, setCamera] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [list, setList] = useState("");
  const libraryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const symbol = currencySymbol(currency);
  const reading = busy === "reading";
  const { ref: revealList, waiting: unseenRows, showNext: showNextRow } = useReveal<HTMLUListElement>();
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  // Where the page was scrolled when a read started, so the result can be brought into view once it lands.
  const scrolledAtRead = useRef<number | null>(null);

  // When a read lands below the fold, glide to it, unless the person scrolled somewhere else while waiting.
  useEffect(() => {
    const from = scrolledAtRead.current;
    const heading = reviewHeading.current;
    scrolledAtRead.current = null;
    if (from === null || !heading || Math.abs(window.scrollY - from) > 24) return;
    heading.focus({ preventScroll: true });
    if (heading.getBoundingClientRect().top > window.innerHeight * 0.6) scrollToReveal(heading);
  }, [rows]);

  /** The in-page camera where the browser allows it, otherwise the device's own camera app or file picker. */
  function openCamera() {
    if (canUseLiveCamera()) setCamera(true);
    else cameraInput.current?.click();
  }

  /** Sends a photo or a pasted list to the reader and fills the review form with what it found. */
  async function read(kind: "photo" | "list", body: FormData, photo?: Blob) {
    setError(null);
    setRows(null);
    setBusy("reading");
    const scrolledFrom = window.scrollY;
    try {
      const res = await fetch("/api/stand/sign", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't read that.");
      const draft = json as SignDraft;
      if (draft.items.length === 0) {
        throw new Error(
          kind === "photo"
            ? "No prices found in that photo. Try a closer, straighter shot."
            : "No items with prices found. Put each item on its own line with its price.",
        );
      }
      if (draft.standName) setName(draft.standName);
      setSource(kind);
      const thumbnails = photo ? await cropThumbnails(photo, draft.items.map((item) => item.region)) : [];
      setRows(draft.items.map((item, i) => ({ ...toRow(item), image: thumbnails[i] })));
      scrolledAtRead.current = scrolledFrom;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onPhoto(photo: Blob | undefined) {
    if (!photo) return;
    setCamera(false);
    setPasting(false);
    setPreview(URL.createObjectURL(photo));
    const form = new FormData();
    form.append("photo", await shrinkPhoto(photo), "sign.jpg");
    await read("photo", form, photo);
  }

  /** Runs a bundled stand photo through the photo reader, for demos without a real stand. */
  async function readDemoPhoto(demo: (typeof DEMO_PHOTOS)[number]) {
    setBusy("reading");
    setName(demo.standName); // the photo has no stand name, so the reader won't supply one
    setError(null);
    const photo = await fetch(demo.src)
      .then((res) => (res.ok ? res.blob() : undefined))
      .catch(() => undefined);
    if (photo) return onPhoto(photo);
    setBusy(null);
    setError("Couldn't load the demo photo. Try again.");
  }

  async function readList() {
    setPreview(null);
    const form = new FormData();
    form.append("text", list);
    await read("list", form);
  }

  function startBlank() {
    setError(null);
    setPreview(null);
    setPasting(false);
    setName("");
    setSource("blank");
    setRows([emptyRow()]);
  }

  function update(key: number, change: Partial<Row>) {
    setRows((current) => current?.map((row) => (row.key === key ? { ...row, ...change } : row)) ?? null);
  }

  const invalid =
    !name.trim() || !rows?.length || rows.some((row) => !row.name.trim() || parsePrice(row.price) === null);
  const toCheck = rows?.filter((row) => row.confidence === "low").length ?? 0;

  async function publish() {
    if (!rows || invalid) return;
    setBusy("publishing");
    setError(null);
    const res = await fetch("/api/stand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        items: rows.map((row) => ({
          name: row.name.trim(),
          priceCents: parsePrice(row.price),
          emoji: row.emoji || undefined,
          image: row.image,
        })),
      }),
    });
    if (res.ok) return router.push("/stand/register");
    setBusy(null);
    setError((await res.json().catch(() => ({}))).error ?? "Couldn't publish the stand.");
  }

  async function loadSample(id: string) {
    setBusy(`sample:${id}`);
    setError(null);
    const res = await fetch(`/api/stand?sample=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) return router.push("/stand/register");
    setBusy(null);
    setError("Couldn't load the sample. Try again.");
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

      <AIGlow active={reading && !pasting}>
        <Card className="overflow-hidden">
          <button
            type="button"
            disabled={busy !== null}
            onClick={openCamera}
            className="pressable flex w-full flex-col items-center gap-3 p-8 text-center outline-none focus-visible:shadow-[inset_0_0_0_3px_var(--focus)] disabled:pointer-events-none"
          >
            {preview ? (
              <span className="relative overflow-hidden rounded-[14px] shadow-card">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                <img src={preview} alt="Your price sign" className="block max-h-60 object-contain" />
                {reading ? <span aria-hidden className="scan-band absolute inset-0" /> : null}
              </span>
            ) : (
              <span className="grid size-16 place-items-center rounded-[20px] bg-lemon text-[2rem] text-[oklch(0.23_0.03_85)] shadow-card">
                <CameraIcon />
              </span>
            )}
            <span className="text-title3 font-semibold">{preview ? "Retake photo" : "Photograph your sign"}</span>
            <span className="text-subhead text-ink-2">Lemon Pal reads your items and prices for you to check.</span>
          </button>
          <div className="flex flex-wrap justify-center gap-2 border-t border-hairline p-4">
            <Button variant="tinted" icon={<PhotoIcon />} disabled={busy !== null} onClick={() => libraryInput.current?.click()}>
              Choose a photo
            </Button>
            <Button
              variant="tinted"
              icon={<ListIcon />}
              aria-expanded={pasting}
              aria-controls="paste-list"
              disabled={busy !== null}
              onClick={() => setPasting((open) => !open)}
            >
              Paste a list
            </Button>
            <Button variant="tinted" icon={<PlusIcon />} disabled={busy !== null} onClick={startBlank}>
              Start blank
            </Button>
          </div>
          {/* The library picker has no capture hint, so phones offer saved photos. The other opens the camera app. */}
          <input
            ref={libraryInput}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              void onPhoto(e.target.files?.[0]);
              e.target.value = ""; // lets the same photo be picked again
            }}
          />
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              void onPhoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </Card>
      </AIGlow>

      {pasting ? (
        <AIGlow active={reading}>
          <Card id="paste-list" className="flex flex-col gap-4 p-5">
            <TextArea
              label="Your price list"
              rows={6}
              autoFocus
              maxLength={4000}
              value={list}
              placeholder={"Lemonade $2\nPink lemonade $2.50\nCookie $1"}
              hint="Paste a menu or type one item per line. Lemon Pal reads it like a sign."
              onChange={(e) => setList(e.target.value)}
            />
            <Button
              variant={rows ? "tinted" : "filled"}
              size="lg"
              icon={<SparklesIcon />}
              disabled={!list.trim() || busy !== null}
              loading={reading}
              onClick={readList}
            >
              Read my list
            </Button>
          </Card>
        </AIGlow>
      ) : null}

      {camera ? (
        <CameraSheet
          onCapture={(photo) => void onPhoto(photo)}
          onClose={() => setCamera(false)}
          onFallback={() => {
            setCamera(false);
            cameraInput.current?.click();
          }}
        />
      ) : null}

      <div aria-live="polite" className="flex flex-col items-center gap-2 text-center empty:hidden">
        {reading ? (
          <p className="flex items-center gap-2 text-headline">
            <SparklesIcon aria-hidden className="animate-breathe text-[1.2rem] text-peel" />
            <ShimmerText>{pasting ? "Reading your list…" : "Reading your sign…"}</ShimmerText>
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
            <h2
              id="review-heading"
              ref={reviewHeading}
              tabIndex={-1}
              className="scroll-mt-6 font-display text-title2 font-semibold outline-none"
            >
              {source === "blank" ? "Add your items" : "Check your items"}
            </h2>
            <p className="text-subhead text-ink-2">
              {source === "blank"
                ? "Name each thing you sell and give it a price. Add as many as you like."
                : toCheck > 0
                  ? `${toCheck} ${toCheck === 1 ? "item was" : "items were"} hard to read. Check ${toCheck === 1 ? "it" : "them"} before you publish.`
                  : "Everything read clearly. Fix anything that looks off."}
            </p>
          </div>

          <TextField
            label="Stand name"
            value={name}
            maxLength={40}
            placeholder="Maya’s Bake Sale"
            hint="Customers see this when they pay."
            onChange={(e) => setName(e.target.value)}
          />

          <ul ref={revealList} className="flex flex-col gap-3">
            {rows.map((row, i) => {
              const priceText = row.price.trim();
              const priceError = priceText && parsePrice(priceText) === null ? "Enter an amount like 2.50" : undefined;
              const priceHint = !priceText && row.unreadPrice ? "Couldn’t read this price. Enter it here." : undefined;
              return (
                <li key={row.key}>
                  <Card className={row.confidence === "low" ? "attention flex flex-col gap-3 p-4" : "flex flex-col gap-3 p-4"}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {row.image ? (
                          // eslint-disable-next-line @next/next/no-img-element -- data URL cropped in the browser
                          <img
                            src={row.image}
                            alt={`Photo of ${row.name || `item ${i + 1}`}`}
                            className="size-16 shrink-0 rounded-[14px] object-cover shadow-card"
                          />
                        ) : null}
                        {row.confidence ? <ConfidencePill confidence={row.confidence} /> : null}
                      </div>
                      <Button
                        variant="ghost"
                        iconOnly
                        aria-label={`Remove ${row.name || `item ${i + 1}`}`}
                        icon={<XmarkIcon />}
                        onClick={() => setRows((current) => current?.filter((r) => r.key !== row.key) ?? null)}
                      />
                    </div>
                    {/* Narrow phones: the price drops below the name, so the name keeps a usable width. */}
                    <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-start gap-3 min-[25rem]:grid-cols-[4.25rem_minmax(0,1fr)_7.5rem] sm:grid-cols-[4.5rem_minmax(0,1fr)_8.5rem]">
                      <TextField
                        label="Icon"
                        aria-label={`Icon for ${row.name || `item ${i + 1}`}, one emoji`}
                        value={row.emoji}
                        placeholder="＋"
                        enterKeyHint="next"
                        className="[&_input]:text-center [&_input]:text-title3"
                        onChange={(e) => update(row.key, { emoji: lastEmoji(e.target.value) })}
                      />
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
                        className="col-start-2 min-[25rem]:col-start-auto"
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
            onClick={() => setRows((current) => [...(current ?? []), emptyRow()])}
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
          <MoreBelow count={unseenRows} one="item" many="items" onClick={showNextRow} />
          {invalid ? (
            <p className="-mt-2 text-center text-footnote text-ink-2">
              {name.trim() ? "Every item needs a name and a price." : "Give your stand a name, and every item a name and a price."}
            </p>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="demo-heading" className="flex flex-col items-center gap-3 text-center">
        <h2 id="demo-heading" className="text-subhead text-ink-2">
          Demo: watch Lemon Pal read a real stand.
        </h2>
        <div className="flex flex-wrap justify-center gap-2">
          {DEMO_PHOTOS.map((demo) => (
            <Button
              key={demo.id}
              variant="tinted"
              icon={<PhotoIcon />}
              disabled={busy !== null}
              onClick={() => readDemoPhoto(demo)}
            >
              {demo.label}
            </Button>
          ))}
        </div>
      </section>

      <section aria-labelledby="samples-heading" className="flex flex-col items-center gap-3 text-center">
        <h2 id="samples-heading" className="text-subhead text-ink-2">
          No sign handy? Start from a sample stand.
        </h2>
        <div className="flex flex-wrap justify-center gap-2">
          {samples.map((sample) => (
            <Button
              key={sample.id}
              variant="tinted"
              icon={<span aria-hidden>{sample.emoji}</span>}
              loading={busy === `sample:${sample.id}`}
              disabled={busy !== null}
              onClick={() => loadSample(sample.id)}
            >
              {sample.name}
            </Button>
          ))}
        </div>
      </section>
    </main>
  );
}
