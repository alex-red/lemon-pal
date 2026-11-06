"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AIGlow,
  Button,
  CameraIcon,
  Card,
  CheckIcon,
  cn,
  ConfidencePill,
  ExclamationIcon,
  GridIcon,
  ListIcon,
  Money,
  MoreBelow,
  PencilIcon,
  PhotoIcon,
  Pill,
  PlusIcon,
  ScrollEdge,
  SegmentedControl,
  scrollToReveal,
  ShimmerText,
  SparklesIcon,
  Switch,
  TagIcon,
  TextArea,
  TextField,
  useReveal,
  XmarkIcon,
} from "@/components/kit";
import { dealLabel, isValidDeal, MAX_DEAL_QUANTITY, type Deal } from "@/lib/deals";
import { cleanEmoji } from "@/lib/emoji";
import { standApi, standHome } from "@/lib/stands";
import type { CatalogItem, DraftItem, Region, SignDraft, StandKind } from "@/lib/types";
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
  /** A multi-buy price, as typed: "2" for "5.00". null when the item has no deal. */
  deal: { quantity: string; price: string } | null;
  soldOut: boolean;
  /** The published item this row edits, to show what changed. Missing for a new item. */
  before?: CatalogItem;
  /** After a read while updating: whether the sign showed this published item. */
  onSign?: boolean;
};

let nextKey = 1;

const toAmount = (cents: number) => (cents / 100).toFixed(2);

function toRow(item: DraftItem): Row {
  return {
    key: nextKey++,
    emoji: item.emoji ?? "",
    name: item.name,
    price: item.priceCents === null ? "" : (item.priceCents / 100).toFixed(2),
    confidence: item.priceCents === null ? "low" : item.confidence,
    unreadPrice: item.priceCents === null,
    deal: item.deal ? { quantity: String(item.deal.quantity), price: toAmount(item.deal.priceCents) } : null,
    soldOut: item.soldOut ?? false,
  };
}

/** A published item as an editable row, remembering how it was so the screen can show what changed. */
function fromCatalog(item: CatalogItem): Row {
  return {
    key: nextKey++,
    emoji: item.emoji ?? "",
    name: item.name,
    price: toAmount(item.priceCents),
    confidence: null,
    unreadPrice: false,
    image: item.image,
    deal: item.deal ? { quantity: String(item.deal.quantity), price: toAmount(item.deal.priceCents) } : null,
    soldOut: item.soldOut ?? false,
    before: item,
  };
}

/**
 * Lays a fresh read over the published catalog. Items the reader matched take the sign's price and sold-out mark,
 * keeping their photo, icon, and deal unless the sign shows a new one. Unmatched lines become new items. Published
 * items the sign didn't show stay as they were, flagged for the seller to decide.
 */
function mergeRead(catalog: CatalogItem[], items: DraftItem[], thumbnails: (string | undefined)[]): Row[] {
  const rows = catalog.map((item) => ({ ...fromCatalog(item), onSign: false }));
  const added: Row[] = [];
  items.forEach((item, i) => {
    const match = item.existingName?.toLowerCase();
    const row = match ? rows.find((r) => !r.onSign && r.before!.name.toLowerCase() === match) : undefined;
    if (!row) {
      added.push({ ...toRow(item), image: thumbnails[i] });
      return;
    }
    row.onSign = true;
    row.soldOut = item.soldOut ?? false;
    // An unreadable price keeps the current one, but still asks the seller to look.
    if (item.priceCents !== null) row.price = toAmount(item.priceCents);
    row.confidence = item.priceCents === null ? "low" : item.confidence;
    if (item.deal) row.deal = { quantity: String(item.deal.quantity), price: toAmount(item.deal.priceCents) };
    row.image ??= thumbnails[i];
    if (!row.emoji && item.emoji) row.emoji = item.emoji;
  });
  // What the seller needs to look at comes first: changes, then new items, then what the sign left out.
  const rank = (row: Row) => (row.confidence === "low" || (row.before && isChanged(row)) ? 0 : !row.before ? 1 : row.onSign === false ? 2 : 3);
  return [...rows, ...added].sort((a, b) => rank(a) - rank(b));
}

/** What an update changes about a row, compared with the published item. */
function rowChanges(row: Row) {
  const before = row.before;
  const price = parsePrice(row.price);
  const deal = parseDeal(row);
  if (!before) return { added: true, price: null, soldOut: false, restocked: false, renamed: false, otherEdit: false };
  // A half-typed deal isn't a change yet: the form already asks for it to be finished.
  const dealChanged = row.deal
    ? deal !== null && (deal.quantity !== before.deal?.quantity || deal.priceCents !== before.deal?.priceCents)
    : Boolean(before.deal);
  return {
    added: false,
    price: price !== null && price !== before.priceCents ? { from: before.priceCents, to: price } : null,
    soldOut: row.soldOut && !before.soldOut,
    restocked: !row.soldOut && Boolean(before.soldOut),
    renamed: row.name.trim() !== before.name,
    otherEdit: dealChanged || row.emoji !== (before.emoji ?? ""),
  };
}

function isChanged(row: Row) {
  const c = rowChanges(row);
  return c.added || c.price !== null || c.soldOut || c.restocked || c.renamed || c.otherEdit;
}

/** A pasted note that raises a price, sells one item out, drops one, and adds one, for demoing an update. */
function restockNote(catalog: CatalogItem[], symbol: string): string {
  const price = (cents: number) => `${symbol}${toAmount(cents).replace(/\.00$/, "")}`;
  const lines = catalog.map((item, i) => {
    if (i === 0) return `${item.name.toLowerCase()} now ${price(item.priceCents + 100)} (was ${price(item.priceCents)})`;
    if (i === 1) return `${item.name} - SOLD OUT`;
    return `${item.name} ${price(item.priceCents)}`;
  });
  // Leave the last item off when there are enough, so one shows as not on the sign.
  if (catalog.length > 3) lines.pop();
  return ["Restock update!", ...lines, `NEW: Mystery grab bag ${price(500)}`].join("\n");
}

/** The row's deal in cents, or null when it's missing or not filled in correctly. */
function parseDeal(row: Row): Deal | null {
  if (!row.deal) return null;
  const quantity = /^\d{1,2}$/.test(row.deal.quantity.trim()) ? Number(row.deal.quantity) : NaN;
  const priceCents = parsePrice(row.deal.price);
  const unit = parsePrice(row.price);
  if (priceCents === null || unit === null) return null;
  const deal = { quantity, priceCents };
  return isValidDeal(unit, deal) ? deal : null;
}

/** Why a row's deal can't be published, or undefined when it's fine or the price field already explains. */
function dealError(row: Row): string | undefined {
  if (!row.deal || parseDeal(row)) return undefined;
  const quantity = Number(row.deal.quantity);
  if (!row.deal.quantity.trim() || !row.deal.price.trim()) return "Fill in both, or remove the deal";
  if (!Number.isInteger(quantity) || quantity < 2 || quantity > MAX_DEAL_QUANTITY) return `Buy 2 to ${MAX_DEAL_QUANTITY}`;
  if (parsePrice(row.deal.price) === null) return "Enter an amount like 5.00";
  if (parsePrice(row.price) === null) return undefined;
  return "A deal has to cost less than buying them one at a time";
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

const emptyRow = (): Row => ({
  key: nextKey++,
  emoji: "",
  name: "",
  price: "",
  confidence: null,
  unreadPrice: false,
  deal: null,
  soldOut: false,
});

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
    context.imageSmoothingQuality = "high";
    return regions.map((region) => {
      if (!region) return undefined;
      const side = Math.min(
        Math.max(region.width * bitmap.width, region.height * bitmap.height) * 1.08,
        bitmap.width,
        bitmap.height,
      );
      const left = Math.min(Math.max((region.x + region.width / 2) * bitmap.width - side / 2, 0), bitmap.width - side);
      const top = Math.min(Math.max((region.y + region.height / 2) * bitmap.height - side / 2, 0), bitmap.height - side);
      // A small lift for dim booth lighting. Crops enlarged past 1.5x also get a soft blur, so the photo's JPEG blocks
      // read as soft focus. Big crops stay sharp. Browsers without canvas filters draw the crop as it is.
      const enlarged = THUMB_SIZE / side;
      const blur = enlarged > 1.5 ? Math.min((enlarged - 1) * 0.35, 1.2) : 0;
      context.filter = `saturate(1.12) contrast(1.05)${blur ? ` blur(${blur.toFixed(2)}px)` : ""}`;
      // Drawn a little past the edges, so the blur doesn't pull in the canvas's empty border as a dark rim.
      context.drawImage(bitmap, left, top, side, side, -3, -3, THUMB_SIZE + 6, THUMB_SIZE + 6);
      return canvas.toDataURL("image/jpeg", 0.72);
    });
  } catch {
    return regions.map(() => undefined);
  }
}

/** Register tiles fill with the thumbnail, about 20rem across at most, so this stays sharp on a 2x screen. */
const THUMB_SIZE = 480;

/**
 * Stand photos bundled for demos without a stand on hand. The art table sign is generated: it's the video fixture,
 * with a "2 for $5" deal and a smudged price the seller has to fill in.
 */
const DEMO_PHOTOS = [
  { id: "art", label: "Art Table Sign", src: "/demo/art-table-sign.jpg", standName: "Art Table" },
  { id: "lemonade", label: "Lemonade Stand Sign", src: "/demo/lemonade-stand-sign.jpg", standName: "Lemonade Stand" },
  { id: "booth", label: "Messy Convention Booth", src: "/demo/convention-booth.jpg", standName: "Plush Booth" },
  { id: "bakery", label: "Bakery Display Case", src: "/demo/bakery-case.jpg", standName: "Bakery" },
] as const;

type SampleChoice = { id: string; name: string; emoji: string };

export function Setup({
  standId,
  kind,
  switcher,
  currency,
  standName,
  samples,
  catalog,
}: {
  standId: string;
  kind: StandKind;
  /** The stand switcher, shown above the title. */
  switcher: ReactNode;
  currency: string;
  standName: string;
  samples: SampleChoice[];
  /** The published items. When there are some, the screen opens on them for an update instead of a fresh setup. */
  catalog: CatalogItem[];
}) {
  const home = standHome(kind);
  const router = useRouter();
  const [name, setName] = useState(standName);
  // A rename from the stand switcher refreshes the page with a new standName. Follow it, or publishing would put
  // the old name back.
  const [savedName, setSavedName] = useState(standName);
  if (standName !== savedName) {
    setSavedName(standName);
    setName(standName);
  }
  const [preview, setPreview] = useState<string | null>(null);
  // Updating edits the published items in place. Starting over replaces them, as a first setup does.
  const [updating, setUpdating] = useState(catalog.length > 0);
  const [rows, setRows] = useState<Row[] | null>(() => (catalog.length > 0 ? catalog.map(fromCatalog) : null));
  const [busy, setBusy] = useState<"reading" | "publishing" | `sample:${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Where the draft came from, which changes the review copy.
  const [source, setSource] = useState<"photo" | "list" | "blank" | null>(null);
  const [camera, setCamera] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [list, setList] = useState("");
  // Full cards to edit everything, or a compact grid for scanning prices and sold-out switches. Tiles open into a
  // full card to edit the rest. The choice is remembered on this device.
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  useEffect(() => {
    try {
      // Read after hydration, so the server and first client render agree.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- a stored preference only the browser knows
      if (localStorage.getItem(LAYOUT_KEY) === "grid") setLayout("grid");
    } catch {}
  }, []);
  function chooseLayout(next: "list" | "grid") {
    setLayout(next);
    setExpanded(new Set());
    try {
      localStorage.setItem(LAYOUT_KEY, next);
    } catch {}
  }
  const toggleExpanded = (key: number) =>
    setExpanded((open) => {
      const next = new Set(open);
      if (!next.delete(key)) next.add(key);
      return next;
    });
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
    // While updating, the items stay on screen as the sign is read, then change in place.
    if (!updating) setRows(null);
    setBusy("reading");
    const scrolledFrom = window.scrollY;
    try {
      const res = await fetch(standApi("/api/stand/sign", standId), { method: "POST", body });
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
      setSource(kind);
      const thumbnails = photo ? await cropThumbnails(photo, draft.items.map((item) => item.region)) : [];
      if (updating) {
        setRows(mergeRead(catalog, draft.items, thumbnails));
      } else {
        if (draft.standName) setName(draft.standName);
        setRows(draft.items.map((item, i) => ({ ...toRow(item), image: thumbnails[i] })));
      }
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
    if (!updating) setName(demo.standName); // the photo has no stand name, so the reader won't supply one
    setError(null);
    const photo = await fetch(demo.src)
      .then((res) => (res.ok ? res.blob() : undefined))
      .catch(() => undefined);
    if (photo) return onPhoto(photo);
    setBusy(null);
    setError("Couldn't load the demo photo. Try again.");
  }

  async function readList(text = list) {
    setPreview(null);
    const form = new FormData();
    form.append("text", text);
    await read("list", form);
  }

  /** Demo: fills the paste box with a restock note made from this stand's items, and reads it. */
  async function readRestockNote() {
    const note = restockNote(catalog, symbol);
    setList(note);
    setPasting(true);
    await readList(note);
  }

  /** Leaves the published items behind and sets the stand up from scratch. Nothing changes until publishing. */
  function startOver() {
    setUpdating(false);
    setRows(null);
    setSource(null);
    setPreview(null);
    setError(null);
  }

  /** Back from starting over, to the published items as they are. */
  function keepItems() {
    setUpdating(true);
    setRows(catalog.map(fromCatalog));
    setSource(null);
    setPreview(null);
    setError(null);
    setName(savedName);
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
    !name.trim() || !rows?.length || rows.some((row) => !row.name.trim() || parsePrice(row.price) === null || (row.deal !== null && !parseDeal(row)));
  const toCheck = rows?.filter((row) => row.confidence === "low").length ?? 0;
  // What an update would change, for the summary and the save button.
  const changes = (rows ?? []).map((row) => rowChanges(row));
  const removed = updating ? catalog.filter((item) => !rows?.some((row) => row.before?.id === item.id)).length : 0;
  const summary = {
    price: changes.filter((c) => c.price).length,
    soldOut: changes.filter((c) => c.soldOut).length,
    restocked: changes.filter((c) => c.restocked).length,
    added: changes.filter((c) => c.added).length,
    notOnSign: rows?.filter((row) => row.onSign === false).length ?? 0,
  };
  const changeCount =
    (rows?.filter(isChanged).length ?? 0) + removed + (updating && name.trim() !== savedName.trim() ? 1 : 0);

  async function publish() {
    if (!rows || invalid) return;
    setBusy("publishing");
    setError(null);
    const res = await fetch(standApi("/api/stand", standId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        update: updating,
        items: rows.map((row) => ({
          name: row.name.trim(),
          priceCents: parsePrice(row.price),
          emoji: row.emoji || undefined,
          image: row.image,
          deal: parseDeal(row) ?? undefined,
          soldOut: row.soldOut || undefined,
        })),
      }),
    });
    if (res.ok) return router.push(home, { transitionTypes: ["nav-forward"] });
    setBusy(null);
    setError((await res.json().catch(() => ({}))).error ?? (updating ? "Couldn't save your changes." : "Couldn't publish the stand."));
  }

  async function loadSample(id: string) {
    setBusy(`sample:${id}`);
    setError(null);
    const res = await fetch(standApi(`/api/stand?sample=${encodeURIComponent(id)}`, standId), { method: "DELETE" }).catch(() => null);
    if (res?.ok) return router.push(home, { transitionTypes: ["nav-forward"] });
    setBusy(null);
    setError("Couldn't load the sample. Try again.");
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-7 px-5 pt-8 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-8">
      <ScrollEdge />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {switcher}
          <h1 className="font-display text-large-title font-semibold">{updating ? "Update your stand" : "Snap your price sign"}</h1>
        </div>
        <Link
          href={home}
          transitionTypes={["nav-forward"]}
          className="pressable focus-ring inline-flex h-11 items-center rounded-full px-4 text-callout font-semibold text-peel hover:bg-fill"
        >
          {kind === "online" ? "Store" : "Register"}
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
            <span className="text-title3 font-semibold">
              {preview ? "Retake photo" : updating ? "Snap your sign again" : "Photograph your sign"}
            </span>
            <span className="text-subhead text-ink-2">
              {updating
                ? "Lemon Pal spots new prices, sold-out items, and anything new for you to check."
                : "Lemon Pal reads your items and prices for you to check."}
            </span>
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
            {updating ? null : (
              <Button variant="tinted" icon={<PlusIcon />} disabled={busy !== null} onClick={startBlank}>
                Start blank
              </Button>
            )}
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
              onClick={() => readList()}
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
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <h2
                id="review-heading"
                ref={reviewHeading}
                tabIndex={-1}
                className="scroll-mt-6 font-display text-title2 font-semibold outline-none"
              >
                {updating ? "Your items" : source === "blank" ? "Add your items" : "Check your items"}
              </h2>
              <SegmentedControl
                label="Show items as"
                value={layout}
                onChange={chooseLayout}
                options={[
                  { value: "list", label: <span className="flex items-center gap-1.5"><ListIcon aria-hidden /> List</span> },
                  { value: "grid", label: <span className="flex items-center gap-1.5"><GridIcon aria-hidden /> Grid</span> },
                ]}
              />
            </div>
            <p className="text-subhead text-ink-2">
              {updating
                ? source === null
                  ? "Mark anything sold out or change a price, then save. Or snap your updated sign and Lemon Pal finds the changes."
                  : describeRead(summary, toCheck)
                : source === "blank"
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

          <ul
            ref={revealList}
            className={layout === "grid" ? "grid grid-cols-1 gap-3 min-[22rem]:grid-cols-2 sm:grid-cols-3" : "flex flex-col gap-3"}
          >
            {rows.map((row, i) => {
              const priceText = row.price.trim();
              const priceError = priceText && parsePrice(priceText) === null ? "Enter an amount like 2.50" : undefined;
              const priceHint = !priceText && row.unreadPrice ? "Couldn’t read this price. Enter it here." : undefined;
              const itemName = row.name || `item ${i + 1}`;
              if (layout === "grid" && !expanded.has(row.key)) {
                return (
                  <li key={row.key} className="min-w-0">
                    <CompactItem
                      row={row}
                      itemName={itemName}
                      currency={currency}
                      symbol={symbol}
                      updating={updating}
                      priceError={priceError}
                      onPrice={(price) => update(row.key, { price })}
                      onSoldOut={(soldOut) => update(row.key, { soldOut })}
                      onEdit={() => toggleExpanded(row.key)}
                    />
                  </li>
                );
              }
              return (
                <li key={row.key} className={layout === "grid" ? "col-span-full" : undefined}>
                  <Card className={row.confidence === "low" ? "attention flex flex-col gap-3 p-4" : "flex flex-col gap-3 p-4"}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        {row.image ? (
                          // eslint-disable-next-line @next/next/no-img-element -- data URL cropped in the browser
                          <img
                            src={row.image}
                            alt={`Photo of ${row.name || `item ${i + 1}`}`}
                            className={
                              row.soldOut
                                ? "size-16 shrink-0 rounded-[14px] object-cover opacity-50 shadow-card grayscale"
                                : "size-16 shrink-0 rounded-[14px] object-cover shadow-card"
                            }
                          />
                        ) : null}
                        {/* While updating, most items read clearly and haven't changed, so only flag the ones to check. */}
                        {row.confidence === "low" || (row.confidence && !updating) ? (
                          <ConfidencePill confidence={row.confidence} />
                        ) : null}
                        <ChangePills row={row} currency={currency} updating={updating} />
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {layout === "grid" ? (
                          <Button variant="plain" size="sm" onClick={() => toggleExpanded(row.key)}>
                            Done
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          iconOnly
                          aria-label={`Remove ${itemName}`}
                          icon={<XmarkIcon />}
                          onClick={() => setRows((current) => current?.filter((r) => r.key !== row.key) ?? null)}
                        />
                      </div>
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
                    {row.deal ? (
                      <DealFields
                        deal={row.deal}
                        symbol={symbol}
                        itemName={row.name || `item ${i + 1}`}
                        error={dealError(row)}
                        onChange={(deal) => update(row.key, { deal })}
                      />
                    ) : null}
                    {row.onSign === false && !row.soldOut ? (
                      <p className="px-1 text-footnote text-ink-2">
                        Not on your new sign. Mark it sold out, or remove it if you&rsquo;ve stopped selling it.
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {row.deal ? null : (
                        <Button
                          variant="plain"
                          size="sm"
                          icon={<TagIcon />}
                          onClick={() => update(row.key, { deal: { quantity: "2", price: "" } })}
                        >
                          Add a deal
                        </Button>
                      )}
                      {updating || row.soldOut ? (
                        <div className="ml-auto flex min-h-11 items-center gap-3">
                          <span aria-hidden className="text-subhead font-semibold text-ink-2">
                            Sold out
                          </span>
                          <Switch
                            label={`${row.name || `Item ${i + 1}`} is sold out`}
                            checked={row.soldOut}
                            onChange={(soldOut) => update(row.key, { soldOut })}
                          />
                        </div>
                      ) : null}
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
            onClick={() => {
              const row = emptyRow();
              setRows((current) => [...(current ?? []), row]);
              // A new item needs a name, so in the grid it opens as a full card.
              if (layout === "grid") setExpanded((open) => new Set(open).add(row.key));
            }}
          >
            Add item
          </Button>

          <Button
            variant="filled"
            size="xl"
            className="mt-2 w-full"
            disabled={invalid || busy !== null || (updating && changeCount === 0)}
            loading={busy === "publishing"}
            onClick={publish}
          >
            {updating
              ? changeCount === 0
                ? "No changes yet"
                : `Save ${changeCount} ${changeCount === 1 ? "change" : "changes"}`
              : "Publish stand"}
          </Button>
          <MoreBelow count={unseenRows} one="item" many="items" onClick={showNextRow} />
          {invalid ? (
            <p className="-mt-2 text-center text-footnote text-ink-2">
              {name.trim() ? "Every item needs a name and a price." : "Give your stand a name, and every item a name and a price."}
            </p>
          ) : null}
        </section>
      ) : null}

      {updating ? (
        <>
          {catalog.length >= 2 ? (
            <section aria-labelledby="restock-heading" className="flex flex-col items-center gap-3 text-center">
              <h2 id="restock-heading" className="text-subhead text-ink-2">
                Demo: watch Lemon Pal catch a price change and a sell-out.
              </h2>
              <Button variant="tinted" icon={<ListIcon />} disabled={busy !== null} onClick={readRestockNote}>
                Read a restock note
              </Button>
            </section>
          ) : null}
          <section aria-labelledby="start-over-heading" className="flex flex-col items-center gap-3 text-center">
            <h2 id="start-over-heading" className="text-subhead text-ink-2">
              Selling something completely different?
            </h2>
            <Button variant="plain" disabled={busy !== null} onClick={startOver}>
              Start over with a new sign
            </Button>
          </section>
        </>
      ) : (
        <>
          {catalog.length > 0 ? (
            <div className="flex justify-center">
              <Button variant="plain" disabled={busy !== null} onClick={keepItems}>
                Keep my current items
              </Button>
            </div>
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
        </>
      )}
    </main>
  );
}

const LAYOUT_KEY = "lemonpal.setup-layout";

/**
 * One item as a small grid tile: its picture, name, what changed, the price, and the sold-out switch. Everything else
 * (name, icon, deal, removing it) opens in the full card with Edit.
 */
function CompactItem({
  row,
  itemName,
  currency,
  symbol,
  updating,
  priceError,
  onPrice,
  onSoldOut,
  onEdit,
}: {
  row: Row;
  itemName: string;
  currency: string;
  symbol: string;
  updating: boolean;
  priceError: string | undefined;
  onPrice: (price: string) => void;
  onSoldOut: (soldOut: boolean) => void;
  onEdit: () => void;
}) {
  const deal = parseDeal(row);
  return (
    <Card className={cn("flex h-full flex-col gap-2 p-3", row.confidence === "low" && "attention")}>
      <div className="flex items-start justify-between gap-2">
        {row.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL cropped in the browser
          <img
            src={row.image}
            alt=""
            className={cn("size-12 shrink-0 rounded-[12px] object-cover shadow-card", row.soldOut && "opacity-50 grayscale")}
          />
        ) : (
          <span aria-hidden className={cn("grid size-12 place-items-center text-[2rem] leading-none", row.soldOut && "opacity-50 grayscale")}>
            {row.emoji || <span className="font-display text-title2 font-semibold text-ink-3">{row.name.trim().charAt(0).toUpperCase()}</span>}
          </span>
        )}
        <Button variant="ghost" iconOnly aria-label={`Edit ${itemName}`} icon={<PencilIcon />} onClick={onEdit} />
      </div>
      <p className="text-headline font-semibold text-balance [overflow-wrap:anywhere]">{row.name || "Unnamed item"}</p>
      <div className="flex flex-wrap gap-1.5 empty:hidden">
        {row.confidence === "low" ? <ConfidencePill confidence="low" /> : null}
        <ChangePills row={row} currency={currency} updating={updating} />
        {row.deal ? (
          deal ? (
            <Pill tone="lemon" icon={<TagIcon />}>
              {dealLabel(deal, currency)}
            </Pill>
          ) : (
            <Pill tone="berry" icon={<ExclamationIcon />}>
              Fix the deal
            </Pill>
          )
        ) : null}
      </div>
      <div className="mt-auto flex flex-col gap-2 pt-1">
        <TextField
          label="Price"
          aria-label={`Price of ${itemName}`}
          prefix={symbol}
          inputMode="decimal"
          placeholder="0.00"
          value={row.price}
          error={priceError ?? (!row.price.trim() ? "Enter a price" : undefined)}
          onChange={(e) => onPrice(e.target.value)}
        />
        {updating || row.soldOut ? (
          <div className="flex min-h-11 items-center justify-between gap-2">
            <span aria-hidden className="text-subhead font-semibold whitespace-nowrap text-ink-2">
              Sold out
            </span>
            <Switch label={`${itemName} is sold out`} checked={row.soldOut} onChange={onSoldOut} />
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/** "Lemon Pal found 2 new prices and 1 sold out." with what wasn't on the sign and what's hard to read. */
function describeRead(
  summary: { price: number; soldOut: number; restocked: number; added: number; notOnSign: number },
  toCheck: number,
): string {
  const count = (n: number, one: string, many: string) => (n > 0 ? [`${n} ${n === 1 ? one : many}`] : []);
  const found = [
    ...count(summary.price, "new price", "new prices"),
    ...count(summary.soldOut, "sold out", "sold out"),
    ...count(summary.restocked, "back in stock", "back in stock"),
    ...count(summary.added, "new item", "new items"),
  ];
  const list = found.length > 1 ? `${found.slice(0, -1).join(", ")} and ${found.at(-1)}` : found[0];
  const sentences = [list ? `Lemon Pal found ${list}.` : "Nothing changed from your sign."];
  if (summary.notOnSign > 0) {
    sentences.push(
      summary.notOnSign === 1 ? "1 item wasn’t on it, so it’s unchanged." : `${summary.notOnSign} items weren’t on it, so they’re unchanged.`,
    );
  }
  if (toCheck > 0) sentences.push(`Check ${toCheck === 1 ? "the one" : `the ${toCheck}`} marked before you save.`);
  return sentences.join(" ");
}

/** What an update does to one item, as pills: new, a price change, sold out, back in stock, not on the sign. */
function ChangePills({ row, currency, updating }: { row: Row; currency: string; updating: boolean }) {
  const change = rowChanges(row);
  return (
    <>
      {updating && change.added ? (
        <Pill tone="leaf" icon={<PlusIcon />}>
          New
        </Pill>
      ) : null}
      {change.price ? (
        <Pill tone="lemon" icon={<TagIcon />}>
          <span className="sr-only">Price from</span>
          <s className="opacity-70">
            <Money cents={change.price.from} currency={currency} size="inline" />
          </s>
          <span aria-hidden>→</span>
          <span className="sr-only">to</span>
          <Money cents={change.price.to} currency={currency} size="inline" />
        </Pill>
      ) : null}
      {row.soldOut ? (
        <Pill tone="berry" icon={<XmarkIcon />}>
          Sold out
        </Pill>
      ) : change.restocked ? (
        <Pill tone="leaf" icon={<CheckIcon />}>
          Back in stock
        </Pill>
      ) : null}
      {row.onSign === false ? (
        <Pill icon={<ExclamationIcon />}>Not on sign</Pill>
      ) : null}
      {change.renamed || change.otherEdit ? (
        <Pill icon={<PencilIcon />}>Edited</Pill>
      ) : null}
    </>
  );
}

/** A multi-buy price for one item: "Buy 2 for $5.00". The seller confirms it like a price. */
function DealFields({
  deal,
  symbol,
  itemName,
  error,
  onChange,
}: {
  deal: { quantity: string; price: string };
  symbol: string;
  itemName: string;
  error: string | undefined;
  onChange: (deal: { quantity: string; price: string } | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-[18px] bg-lemon-soft p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-subhead font-semibold text-peel">
          <TagIcon aria-hidden /> Deal
        </p>
        <Button variant="plain" size="sm" aria-label={`Remove the deal on ${itemName}`} onClick={() => onChange(null)}>
          Remove
        </Button>
      </div>
      <div className="grid grid-cols-[5rem_auto_minmax(0,9rem)] items-start gap-2">
        <TextField
          label="Buy"
          aria-label={`How many ${itemName} the deal buys`}
          inputMode="numeric"
          placeholder="2"
          value={deal.quantity}
          onChange={(e) => onChange({ ...deal, quantity: e.target.value })}
        />
        <span aria-hidden className="self-end pb-3 text-body text-ink-2">
          for
        </span>
        <TextField
          label="Deal price"
          prefix={symbol}
          inputMode="decimal"
          placeholder="0.00"
          value={deal.price}
          error={error}
          onChange={(e) => onChange({ ...deal, price: e.target.value })}
        />
      </div>
    </div>
  );
}
