"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BoxIcon,
  Button,
  Card,
  ChartIcon,
  CheckIcon,
  ExclamationIcon,
  GroupedList,
  LemonQR,
  LinkIcon,
  ListIcon,
  ListRow,
  Money,
  PhotoIcon,
  Pill,
  PinIcon,
  QrCodeIcon,
  SegmentedControl,
  Sheet,
  Spinner,
  StorefrontHeader,
  Switch,
  TextArea,
  TextField,
  Toolbar,
  EyeIcon,
  XmarkIcon,
} from "@/components/kit";
import { handleProblem, HANDLE_MAX } from "@/lib/handles";
import { centsText, currencyMark, parseCents, type Cents } from "@/lib/money";
import { countryName, parseCountries } from "@/lib/shipping";
import type { PublicStorefront } from "@/lib/storefront";
import { standApi } from "@/lib/stands";
import type { StorefrontAccent } from "@/lib/types";
import { bannerFrom } from "../banner-photo";
import { StickerDemoButton } from "../sticker-demo";

type EditorItem = {
  id: string;
  name: string;
  priceCents: Cents;
  emoji?: string;
  image?: string;
  online: boolean;
  ships: boolean;
};

type Props = {
  standId: string;
  /** A demo account, which can load the sticker shop demo. */
  stickerDemo: boolean;
  /** The stand switcher, shown above the title. */
  switcher: ReactNode;
  origin: string;
  currency: string;
  /** Whether the stand has a confirmed catalog. Without one there's nothing to sell. */
  published: boolean;
  initial: PublicStorefront;
  /** Whether the storefront exists yet, or this is a first draft. */
  saved: boolean;
  items: EditorItem[];
};

type Form = {
  slug: string;
  title: string;
  intro: string;
  accent: StorefrontAccent;
  open: boolean;
  pickup: boolean;
  pickupNote: string;
  shipping: boolean;
  flatRate: string;
  freeOver: string;
  countries: string;
};

type SaveState = { kind: "idle" | "saving" | "saved" } | { kind: "error"; message: string; field?: string };

const INTRO_MAX = 280;

export function StoreEditor({ standId, stickerDemo, switcher, origin, currency, published, initial, saved, items: initialItems }: Props) {
  const [form, setForm] = useState<Form>(() => ({
    slug: initial.slug,
    title: initial.title,
    intro: initial.intro,
    accent: initial.accent,
    open: initial.open,
    pickup: initial.pickup,
    pickupNote: initial.pickupNote,
    shipping: initial.shipping.enabled,
    flatRate: centsText(initial.shipping.flatRateCents),
    freeOver: centsText(initial.shipping.freeOverCents),
    countries: initial.shipping.countries.join(", "),
  }));
  const [items, setItems] = useState(initialItems);
  // The banner the preview shows, and a counter that goes up each time the seller picks or removes one.
  const [banner, setBanner] = useState<{ preview: string | null; data: string | null; version: number }>({
    preview: initial.bannerUrl,
    data: null,
    version: 0,
  });
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [savedSlug, setSavedSlug] = useState<string | null>(saved ? initial.slug : null);
  const [remote, setRemote] = useState<{ slug: string; available: boolean; problem: string | null } | null>(null);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function change(patch: Partial<Form>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  // The handle: checked here first, then with the server, which knows every other store's name.
  const slugLocalProblem = handleProblem(form.slug);
  // A first draft's suggested handle is only a guess, so it's checked like any other until the store is saved.
  const slugIsSaved = savedSlug !== null && form.slug === savedSlug;
  const slugReady = !slugLocalProblem && (slugIsSaved || (remote?.slug === form.slug && remote.available));
  const slugRemoteProblem = remote?.slug === form.slug && !remote.available ? remote.problem : null;
  const serverSlugError = save.kind === "error" && save.field === "slug" ? save.message : null;
  const slugError = slugLocalProblem ?? slugRemoteProblem ?? serverSlugError;

  useEffect(() => {
    if (handleProblem(form.slug) || form.slug === savedSlug) return;
    const slug = form.slug;
    const timer = setTimeout(async () => {
      const res = await fetch(standApi(`/api/stand/store/handle?check=${encodeURIComponent(slug)}`, standId), { cache: "no-store" }).catch(() => null);
      const json = await res?.json().catch(() => null);
      if (json) setRemote({ slug, available: Boolean(json.available), problem: json.problem ?? null });
    }, 350);
    return () => clearTimeout(timer);
  }, [form.slug, savedSlug, standId]);

  const flatRateCents = parseCents(form.flatRate);
  const freeOverCents = parseCents(form.freeOver);
  const countries = parseCountries(form.countries);
  const flatRateError = form.shipping && (flatRateCents === null || Number.isNaN(flatRateCents)) ? "Enter a shipping price, or 0 for free." : null;
  const freeOverError = form.shipping && Number.isNaN(freeOverCents) ? "Enter an amount, or leave it blank." : null;
  const countriesError = form.shipping && countries.length === 0 ? "Add at least one country code, such as US." : null;
  const titleError = !form.title.trim() ? "Give your store a title." : null;

  // Everything but the banner, as the server will store it. null while a field needs fixing.
  const payload = useMemo(() => {
    if (titleError || flatRateError || freeOverError || countriesError) return null;
    return {
      // While a new handle is unchecked or taken, keep saving under the last good one.
      slug: slugReady ? form.slug : (savedSlug ?? initial.slug),
      title: form.title.trim(),
      intro: form.intro.trim(),
      accent: form.accent,
      open: form.open,
      pickup: form.pickup,
      pickupNote: form.pickupNote.trim(),
      shipping: {
        enabled: form.shipping,
        flatRateCents: form.shipping ? (flatRateCents ?? 0) : (parseCents(form.flatRate) || 0),
        freeOverCents: freeOverCents === null || Number.isNaN(freeOverCents) ? null : freeOverCents,
        countries,
      },
      items: items.map(({ id, online, ships }) => ({ id, online, ships })),
    };
  }, [form, items, slugReady, savedSlug, initial.slug, titleError, flatRateError, freeOverError, countriesError, flatRateCents, freeOverCents, countries]);
  const payloadKey = payload ? JSON.stringify(payload) : null;

  // Saves a moment after the seller stops typing. Switches take effect at once, so there's no Save button.
  const lastSaved = useRef<{ key: string | null; bannerVersion: number }>({ key: saved ? payloadKey : null, bannerVersion: 0 });
  const firstKey = useRef(payloadKey);
  const requestSeq = useRef(0);
  useEffect(() => {
    if (!payloadKey) return;
    const unchanged = payloadKey === lastSaved.current.key && banner.version === lastSaved.current.bannerVersion;
    // A first visit saves nothing until the seller changes something, so just looking never claims a handle.
    if (unchanged || (!lastSaved.current.key && payloadKey === firstKey.current && banner.version === 0)) return;
    const bannerVersion = banner.version;
    const sendBanner = bannerVersion !== lastSaved.current.bannerVersion;
    const timer = setTimeout(async () => {
      const seq = ++requestSeq.current;
      setSave({ kind: "saving" });
      const body = { ...JSON.parse(payloadKey), ...(sendBanner ? { banner: banner.data } : {}) };
      const res = await fetch(standApi("/api/stand/store", standId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => null);
      const json = await res?.json().catch(() => null);
      if (seq !== requestSeq.current) return; // a newer save is on its way
      if (res?.ok) {
        lastSaved.current = { key: payloadKey, bannerVersion };
        setSavedSlug(body.slug);
        setSave({ kind: "saved" });
      } else {
        setSave({ kind: "error", message: json?.error ?? "Couldn’t save. Check your connection.", field: json?.field });
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [payloadKey, banner, standId]);

  async function pickBanner(file: File | undefined) {
    if (!file) return;
    setBannerError(null);
    try {
      const data = await bannerFrom(file);
      setBanner((current) => ({ preview: data, data, version: current.version + 1 }));
    } catch {
      setBannerError("That photo couldn’t be used. Try a JPEG or PNG.");
    }
  }

  function removeBanner() {
    setBanner((current) => ({ preview: null, data: null, version: current.version + 1 }));
  }

  function setItem(id: string, patch: Partial<EditorItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  const storeUrl = savedSlug ? `${origin}/${savedSlug}` : null;
  const displayHost = origin.replace(/^https?:\/\//, "");
  const openError = save.kind === "error" && save.field === "open" ? save.message : null;
  const generalError = save.kind === "error" && !["slug", "open", "countries"].includes(save.field ?? "") ? save.message : null;

  async function copyLink() {
    if (!storeUrl) return;
    await navigator.clipboard?.writeText(storeUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-8 pb-16 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {switcher}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="font-display text-large-title font-semibold">Your store</h1>
            <SaveStatus state={save} />
          </div>
        </div>
        <Toolbar aria-label="Store">
          <Link href="/stand/setup" transitionTypes={["nav-back"]} className={toolbarLink}>
            <ListIcon /> Items
          </Link>
          <Link href="/stand/orders" transitionTypes={["nav-forward"]} className={toolbarLink}>
            <BoxIcon /> Orders
          </Link>
          <Link href="/stand/recap" transitionTypes={["nav-forward"]} className={toolbarLink}>
            <ChartIcon /> Recap
          </Link>
        </Toolbar>
      </header>

      {!published ? (
        <p role="status" className="mt-6 rounded-card bg-lemon-soft px-5 py-4 text-body">
          Set up your stand’s items first, then come back to sell them online.{" "}
          <Link href="/stand/setup" className="font-semibold text-peel underline underline-offset-2">
            Set up items
          </Link>
        </p>
      ) : null}

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        {/* Preview first on phones, beside the form on wide screens. */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-8 lg:order-2">
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between gap-2 pl-1">
              <p className="text-footnote font-semibold uppercase tracking-[0.06em] text-ink-2">Preview</p>
              {/* The real page, as a buyer sees it, once the store has a saved address. */}
              {savedSlug ? (
                <Link
                  href={`/${savedSlug}?preview=1`}
                  transitionTypes={["nav-forward"]}
                  className="pressable focus-ring -my-1 inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-subhead font-semibold text-peel hover:bg-fill"
                >
                  <EyeIcon className="text-[1.1em]" /> Preview as customer
                </Link>
              ) : null}
            </div>
            <StorefrontHeader
              title={form.title}
              intro={form.intro}
              bannerUrl={banner.preview}
              accent={form.accent}
              closed={!form.open}
            />
          </Card>
          <Button variant="filled" size="lg" icon={<QrCodeIcon />} disabled={!storeUrl} onClick={() => setSharing(true)}>
            Share store
          </Button>
          {!storeUrl ? <p className="-mt-2 text-center text-footnote text-ink-2">Change anything to save your store and get its link.</p> : null}
          {stickerDemo ? <StickerDemoButton standId={standId} className="self-center" /> : null}
        </aside>

        <div className="flex flex-col gap-8 lg:order-1">
          <GroupedList
            footer={openError ?? (form.open ? "Buyers can order and pay now." : "Your page stays up, but buyers can’t order until this is on.")}
          >
            <ListRow
              icon={<CheckIcon />}
              iconTone="leaf"
              title="Taking orders"
              subtitle={form.open ? "Open" : "Closed"}
              trailing={<Switch label="Taking orders" checked={form.open} onChange={(open) => change({ open })} />}
            />
          </GroupedList>

          <section className="flex flex-col gap-5">
            <SectionTitle>Page</SectionTitle>
            <TextField
              label="Store address"
              prefix={`${displayHost}/`}
              value={form.slug}
              maxLength={HANDLE_MAX}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => change({ slug: event.target.value.toLowerCase().replace(/\s+/g, "-") })}
              error={slugError ?? undefined}
              hint={
                slugReady ? (
                  <span className="inline-flex items-center gap-1 text-leaf">
                    <CheckIcon strokeWidth={2.25} /> {slugIsSaved ? "Yours" : "Available"}
                  </span>
                ) : (
                  "Checking…"
                )
              }
            />
            <TextField label="Title" value={form.title} maxLength={60} onChange={(event) => change({ title: event.target.value })} error={titleError ?? undefined} />
            <TextArea
              label="Intro"
              rows={3}
              maxLength={INTRO_MAX}
              placeholder="Fresh-squeezed every morning. Pick up by the park gate."
              value={form.intro}
              onChange={(event) => change({ intro: event.target.value })}
              hint={`${form.intro.length} / ${INTRO_MAX}`}
            />

            <div className="flex flex-col gap-1.5">
              <p className="px-1 text-footnote font-semibold text-ink-2">Banner</p>
              <div className="flex flex-wrap gap-3">
                <Button variant="tinted" icon={<PhotoIcon />} onClick={() => fileInput.current?.click()}>
                  {banner.preview ? "Change photo" : "Add a photo"}
                </Button>
                {banner.preview ? (
                  <Button variant="plain" icon={<XmarkIcon />} onClick={removeBanner}>
                    Remove
                  </Button>
                ) : null}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(event) => {
                  void pickBanner(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <p role={bannerError ? "alert" : undefined} className={bannerError ? "px-1 text-footnote text-berry" : "px-1 text-footnote text-ink-2"}>
                {bannerError ?? "A wide photo works best. It’s cropped from the middle to 3:1. Don’t use photos of people without asking them."}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <p className="px-1 text-footnote font-semibold text-ink-2">Color</p>
              <SegmentedControl
                label="Store color"
                className="max-w-sm"
                value={form.accent}
                onChange={(accent) => change({ accent })}
                options={[
                  { value: "lemon", label: <Swatch className="bg-lemon">Lemon</Swatch> },
                  { value: "leaf", label: <Swatch className="bg-leaf">Leaf</Swatch> },
                  { value: "berry", label: <Swatch className="bg-berry">Berry</Swatch> },
                ]}
              />
            </div>
          </section>

          <section className="flex flex-col gap-5">
            <SectionTitle>Getting it to buyers</SectionTitle>
            <GroupedList>
              <ListRow
                icon={<PinIcon />}
                title="Pickup"
                subtitle="Buyers collect from you"
                trailing={<Switch label="Offer pickup" checked={form.pickup} onChange={(pickup) => change({ pickup })} />}
              />
              <ListRow
                icon={<BoxIcon />}
                iconTone="pool"
                title="Shipping"
                subtitle="You post it to them"
                trailing={<Switch label="Offer shipping" checked={form.shipping} onChange={(shipping) => change({ shipping })} />}
              />
            </GroupedList>
            {form.pickup ? (
              <TextField
                label="Pickup details"
                placeholder="Saturdays 9–1 at the farmers’ market"
                maxLength={120}
                value={form.pickupNote}
                onChange={(event) => change({ pickupNote: event.target.value })}
              />
            ) : null}
            {form.shipping ? (
              <Card className="flex flex-col gap-5 p-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <TextField
                    label="Shipping per order"
                    prefix={currencyMark(currency)}
                    inputMode="decimal"
                    value={form.flatRate}
                    onChange={(event) => change({ flatRate: event.target.value })}
                    error={flatRateError ?? undefined}
                  />
                  <TextField
                    label="Free shipping over"
                    prefix={currencyMark(currency)}
                    inputMode="decimal"
                    placeholder="Optional"
                    value={form.freeOver}
                    onChange={(event) => change({ freeOver: event.target.value })}
                    error={freeOverError ?? undefined}
                  />
                </div>
                <TextField
                  label="Ships to"
                  placeholder="US, CA"
                  autoCapitalize="characters"
                  value={form.countries}
                  onChange={(event) => change({ countries: event.target.value })}
                  error={countriesError ?? (save.kind === "error" && save.field === "countries" ? save.message : undefined)}
                  hint={countries.length ? countries.map((code) => countryName(code)).join(", ") : "Two-letter country codes, separated by commas."}
                />
                <p className="px-1 text-footnote text-ink-2">
                  PayPal asks the buyer for their address. Orders to anywhere else are stopped before they’re charged.
                </p>
              </Card>
            ) : null}
          </section>

          <section className="flex flex-col gap-5">
            <SectionTitle>What you sell online</SectionTitle>
            {items.length ? (
              <GroupedList footer={form.shipping ? "Only items marked Ships can be posted. The rest are pickup only." : undefined}>
                {items.map((item) => (
                  <ListRow
                    key={item.id}
                    icon={
                      item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- small data URL thumbnail
                        <img src={item.image} alt="" className="size-8 rounded-[9px] object-cover" />
                      ) : (
                        <span>{item.emoji ?? item.name.charAt(0).toUpperCase()}</span>
                      )
                    }
                    title={item.name}
                    subtitle={<Money cents={item.priceCents} currency={currency} className="font-normal" />}
                    trailing={
                      <span className="flex items-center gap-4">
                        <LabeledSwitch text="Online">
                          <Switch label={`Sell ${item.name} online`} checked={item.online} onChange={(online) => setItem(item.id, { online })} />
                        </LabeledSwitch>
                        {form.shipping ? (
                          <LabeledSwitch text="Ships">
                            <Switch label={`${item.name} can be shipped`} checked={item.ships} onChange={(ships) => setItem(item.id, { ships })} />
                          </LabeledSwitch>
                        ) : null}
                      </span>
                    }
                  />
                ))}
              </GroupedList>
            ) : (
              <p className="text-body text-ink-2">No items yet.</p>
            )}
          </section>

          {generalError ? (
            <p role="alert" className="text-subhead font-semibold text-berry">
              {generalError}
            </p>
          ) : null}
        </div>
      </div>

      <Sheet open={sharing} onClose={() => setSharing(false)} title="Share your store">
        {storeUrl ? (
          <div className="flex flex-col items-center gap-5">
            <div className="rounded-[34px] bg-lemon p-4 shadow-float">
              <LemonQR value={storeUrl} label={`Scan to open ${form.title}`} className="size-[min(16rem,60vw)]" />
            </div>
            <p className="font-mono text-footnote break-all text-ink-2">{storeUrl}</p>
            <div className="flex w-full flex-wrap justify-center gap-3">
              <Button variant="tinted" icon={copied ? <CheckIcon /> : <LinkIcon />} onClick={copyLink} aria-live="polite">
                {copied ? "Copied" : "Copy link"}
              </Button>
              <a href={storeUrl} target="_blank" rel="noreferrer" className={sheetLink}>
                Open store
              </a>
            </div>
            {!form.open ? <p className="text-center text-footnote text-ink-2">Turn on Taking orders when you’re ready for buyers.</p> : null}
          </div>
        ) : null}
      </Sheet>
    </main>
  );
}

const toolbarLink =
  "pressable focus-ring inline-flex h-11 items-center gap-2 rounded-full px-5 text-callout font-semibold text-ink hover:bg-fill-2 [&_svg]:text-[1.15em] max-[24rem]:px-4 max-[24rem]:[&_svg]:hidden";
const sheetLink =
  "pressable focus-ring inline-flex h-11 items-center rounded-full px-5 text-callout font-semibold text-peel hover:bg-fill";

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-title2 font-semibold">{children}</h2>;
}

function Swatch({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className={`size-3 rounded-full ring-[0.5px] ring-hairline ${className}`} />
      {children}
    </span>
  );
}

function LabeledSwitch({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="flex flex-col items-center gap-1">
      <span aria-hidden className="text-caption font-semibold text-ink-2">
        {text}
      </span>
      {children}
    </span>
  );
}

function SaveStatus({ state }: { state: SaveState }) {
  if (state.kind === "saving") {
    return (
      <Pill icon={<Spinner />} className="animate-pop">
        Saving…
      </Pill>
    );
  }
  if (state.kind === "saved") {
    return (
      <Pill tone="leaf" icon={<CheckIcon strokeWidth={2.25} />}>
        Saved
      </Pill>
    );
  }
  if (state.kind === "error") {
    return (
      <Pill tone="berry" icon={<ExclamationIcon />}>
        Not saved
      </Pill>
    );
  }
  return null;
}
