"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Button,
  Card,
  ChartIcon,
  CheckIcon,
  DonationPoster,
  ExclamationIcon,
  EyeIcon,
  GroupedList,
  HeartIcon,
  LemonQR,
  ListRow,
  Money,
  PhotoIcon,
  Pill,
  PlusIcon,
  QrCodeIcon,
  QuoteIcon,
  SegmentedControl,
  Spinner,
  Switch,
  TextArea,
  TextField,
  Toolbar,
  XmarkIcon,
} from "@/components/kit";
import { LABEL_MAX, MAX_PRESETS, settingsProblem, THANKS_MAX } from "@/lib/donations";
import { handleProblem, HANDLE_MAX } from "@/lib/handles";
import { centsText, currencyMark, parseCents } from "@/lib/money";
import type { DonationFeed } from "@/lib/donation-sales";
import { standApi } from "@/lib/stands";
import type { PublicStorefront } from "@/lib/storefront";
import type { DonationSettings, StorefrontAccent } from "@/lib/types";
import { bannerFrom } from "../../banner-photo";
import { StickerDemoButton } from "../../sticker-demo";

type Props = {
  standId: string;
  switcher: ReactNode;
  /** Opens Pal, the stand assistant. */
  assistant?: ReactNode;
  /** The address donors see, for the handle field and the link. */
  origin: string;
  /** The address in the QR code: in development, the network address. */
  qrOrigin: string;
  currency: string;
  initial: PublicStorefront;
  donation: DonationSettings;
  /** Whether the page exists yet, or this is a first draft. */
  saved: boolean;
  /** A demo account, which can load the fundraiser demo. */
  demoAccount: boolean;
};

type Form = {
  slug: string;
  title: string;
  intro: string;
  accent: StorefrontAccent;
  open: boolean;
  presets: string[];
  allowCustom: boolean;
  min: string;
  max: string;
  buttonLabel: string;
  thanks: string;
  goal: string;
  notes: boolean;
  showNotes: boolean;
};

type SaveState = { kind: "idle" | "saving" | "saved" } | { kind: "error"; message: string; field?: string };

const INTRO_MAX = 280;
const LABELS = ["Donate", "Tip", "Give", "Chip in"];

/** Sets up a donation stand's page: what people see, which amounts they can give, and their notes. Saves as you type. */
export function DonationEditor({ standId, switcher, assistant, origin, qrOrigin, currency, initial, donation, saved, demoAccount }: Props) {
  const [form, setForm] = useState<Form>(() => ({
    slug: initial.slug,
    title: initial.title,
    intro: initial.intro,
    accent: initial.accent,
    open: initial.open,
    presets: donation.presetsCents.map((cents) => centsText(cents)),
    allowCustom: donation.allowCustom,
    min: centsText(donation.minCents),
    max: centsText(donation.maxCents),
    buttonLabel: donation.buttonLabel,
    thanks: donation.thanks,
    goal: centsText(donation.goalCents),
    notes: donation.notes,
    showNotes: donation.showNotes,
  }));
  const [banner, setBanner] = useState<{ preview: string | null; data: string | null; version: number }>({
    preview: initial.bannerUrl,
    data: null,
    version: 0,
  });
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [savedSlug, setSavedSlug] = useState<string | null>(saved ? initial.slug : null);
  const [remote, setRemote] = useState<{ slug: string; available: boolean; problem: string | null } | null>(null);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const fileInput = useRef<HTMLInputElement>(null);

  function change(patch: Partial<Form>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  // The handle, checked here first and then with the server, as in the store editor.
  const slugLocalProblem = handleProblem(form.slug);
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

  // Amounts as the server will store them, or the first thing that needs fixing.
  const presetValues = form.presets.map(parseCents);
  const minCents = parseCents(form.min);
  const maxCents = parseCents(form.max);
  const goalCents = parseCents(form.goal);
  const settings: DonationSettings | null =
    presetValues.every((v) => v !== null && !Number.isNaN(v)) && minCents !== null && !Number.isNaN(minCents) && maxCents !== null && !Number.isNaN(maxCents) && !Number.isNaN(goalCents)
      ? {
          presetsCents: [...(presetValues as number[])].sort((a, b) => a - b),
          allowCustom: form.allowCustom,
          minCents,
          maxCents,
          buttonLabel: form.buttonLabel.trim(),
          thanks: form.thanks.trim(),
          goalCents: goalCents || null,
          notes: form.notes,
          showNotes: form.showNotes,
        }
      : null;
  const fieldError = (field: string) => (save.kind === "error" && save.field === field ? save.message : null);
  const settingsIssue = settings ? settingsProblem(settings, currency) : null;
  const amountsError =
    presetValues.some((v) => v === null || Number.isNaN(v))
      ? "Enter each amount, such as 5 or 7.50."
      : settingsIssue?.field === "presets"
        ? settingsIssue.message
        : fieldError("presets");
  const minError = minCents === null || Number.isNaN(minCents) ? "Enter the smallest gift." : settingsIssue?.field === "min" ? settingsIssue.message : null;
  const maxError = maxCents === null || Number.isNaN(maxCents) ? "Enter the largest gift." : settingsIssue?.field === "max" ? settingsIssue.message : null;
  const goalError = Number.isNaN(goalCents) ? "Enter an amount, or leave it blank." : null;
  const labelError = settingsIssue?.field === "label" ? settingsIssue.message : null;
  const titleError = !form.title.trim() ? "Give your page a title." : null;

  // Everything but the photo, as the server will store it, compared as text. null while a field needs fixing.
  const payloadKey =
    settings && !settingsIssue && !titleError
      ? JSON.stringify({
          // While a new handle is unchecked or taken, keep saving under the last good one.
          slug: slugReady ? form.slug : (savedSlug ?? initial.slug),
          title: form.title.trim(),
          intro: form.intro.trim(),
          accent: form.accent,
          open: form.open,
          donation: settings,
        })
      : null;

  // Saves a moment after the seller stops typing. Nothing is saved until they change something, so just looking
  // never claims a handle.
  const lastSaved = useRef<{ key: string | null; bannerVersion: number }>({ key: saved ? payloadKey : null, bannerVersion: 0 });
  const firstKey = useRef(payloadKey);
  const requestSeq = useRef(0);
  useEffect(() => {
    if (!payloadKey) return;
    const unchanged = payloadKey === lastSaved.current.key && banner.version === lastSaved.current.bannerVersion;
    if (unchanged || (!lastSaved.current.key && payloadKey === firstKey.current && banner.version === 0)) return;
    const bannerVersion = banner.version;
    const sendBanner = bannerVersion !== lastSaved.current.bannerVersion;
    const timer = setTimeout(async () => {
      const seq = ++requestSeq.current;
      setSave({ kind: "saving" });
      const body = { ...JSON.parse(payloadKey), ...(sendBanner ? { banner: banner.data } : {}) };
      const res = await fetch(standApi("/api/stand/donation", standId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => null);
      const json = await res?.json().catch(() => null);
      if (seq !== requestSeq.current) return;
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

  const pageUrl = savedSlug ? `${origin}/${savedSlug}` : null;
  const qrUrl = `${qrOrigin}/${savedSlug ?? form.slug}`;
  const displayHost = origin.replace(/^https?:\/\//, "");
  const generalError = save.kind === "error" && !["slug", "presets", "min", "max", "label"].includes(save.field ?? "") ? save.message : null;
  const feed = useDonationFeed(standId);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-8 pb-16 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {switcher}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="font-display text-large-title font-semibold">Donation page</h1>
            <SaveStatus state={save} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {assistant}
          <Toolbar aria-label="Donation stand">
            <Link href="/stand/jar" transitionTypes={["nav-forward"]} className={toolbarLink}>
              <QrCodeIcon /> Display
            </Link>
            <Link href="/stand/recap" transitionTypes={["nav-forward"]} className={toolbarLink}>
              <ChartIcon /> Recap
            </Link>
          </Toolbar>
        </div>
      </header>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-8 lg:order-2">
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between gap-2 pl-1">
              <p className="text-footnote font-semibold uppercase tracking-[0.06em] text-ink-2">Poster preview</p>
              {savedSlug ? (
                <Link
                  href={`/${savedSlug}?preview=1`}
                  transitionTypes={["nav-forward"]}
                  className="pressable focus-ring -my-1 inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-subhead font-semibold text-peel hover:bg-fill"
                >
                  <EyeIcon className="text-[1.1em]" /> Donor page
                </Link>
              ) : null}
            </div>
            {/* The preview keeps the stacked phone layout at every width, so it fits the sidebar. */}
            <DonationPoster
              layout="stacked"
              title={form.title}
              intro={form.intro}
              bannerUrl={banner.preview}
              accent={form.accent}
              closed={!form.open}
              caption={`Scan to ${(form.buttonLabel.trim() || "donate").toLowerCase()} with PayPal`}
              goal={goalCents ? { raisedCents: feed?.raisedCents ?? 0, goalCents, currency } : null}
              code={<LemonQR value={qrUrl} label="Code for your donation page" className="size-40" />}
            />
          </Card>
          <Link
            href="/stand/jar"
            transitionTypes={["nav-forward"]}
            aria-disabled={!pageUrl || undefined}
            className="pressable focus-ring inline-flex h-14 items-center justify-center gap-2.5 rounded-full bg-ink px-7 text-headline text-on-ink shadow-card hover:bg-ink/90 aria-disabled:pointer-events-none aria-disabled:opacity-40 [&_svg]:text-[1.25em]"
          >
            <QrCodeIcon /> Show the poster
          </Link>
          {!pageUrl ? (
            <p className="-mt-2 text-center text-footnote text-ink-2">Change anything to save your page and get its code.</p>
          ) : (
            <p className="-mt-2 text-center font-mono text-footnote break-all text-ink-2">{pageUrl}</p>
          )}
          {demoAccount ? <StickerDemoButton standId={standId} fundraiser className="self-center" /> : null}
        </aside>

        <div className="flex flex-col gap-8 lg:order-1">
          <GroupedList footer={form.open ? "People can give now." : "Your page stays up, but nobody can give until this is on."}>
            <ListRow
              icon={<HeartIcon />}
              iconTone="berry"
              title="Taking gifts"
              subtitle={form.open ? "Open" : "Closed"}
              trailing={<Switch label="Taking gifts" checked={form.open} onChange={(open) => change({ open })} />}
            />
          </GroupedList>

          <section className="flex flex-col gap-5">
            <SectionTitle>Poster and page</SectionTitle>
            <TextField
              label="Page address"
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
              label="Message"
              rows={3}
              maxLength={INTRO_MAX}
              placeholder="Every dollar buys food and blankets for the animals at Elm Street Shelter."
              value={form.intro}
              onChange={(event) => change({ intro: event.target.value })}
              hint={`${form.intro.length} / ${INTRO_MAX}`}
            />
            <div className="flex flex-col gap-1.5">
              <p className="px-1 text-footnote font-semibold text-ink-2">Photo</p>
              <div className="flex flex-wrap gap-3">
                <Button variant="tinted" icon={<PhotoIcon />} onClick={() => fileInput.current?.click()}>
                  {banner.preview ? "Change photo" : "Add a photo"}
                </Button>
                {banner.preview ? (
                  <Button variant="plain" icon={<XmarkIcon />} onClick={() => setBanner((c) => ({ preview: null, data: null, version: c.version + 1 }))}>
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
                label="Page color"
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
            <SectionTitle>Amounts</SectionTitle>
            <div className="flex flex-col gap-1.5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {form.presets.map((preset, i) => (
                  <div key={i} className="flex items-end gap-1">
                    <TextField
                      className="min-w-0 flex-1"
                      label={`Amount ${i + 1}`}
                      prefix={currencyMark(currency)}
                      inputMode="decimal"
                      value={preset}
                      onChange={(event) => change({ presets: form.presets.map((p, j) => (j === i ? event.target.value : p)) })}
                    />
                    <Button
                      variant="plain"
                      iconOnly
                      aria-label={`Remove amount ${i + 1}`}
                      icon={<XmarkIcon />}
                      onClick={() => change({ presets: form.presets.filter((_, j) => j !== i) })}
                    />
                  </div>
                ))}
              </div>
              {amountsError ? (
                <p role="alert" className="px-1 text-footnote text-berry">
                  {amountsError}
                </p>
              ) : null}
              {form.presets.length < MAX_PRESETS ? (
                <Button
                  variant="tinted"
                  icon={<PlusIcon />}
                  className="self-start"
                  onClick={() => change({ presets: [...form.presets, nextPreset(presetValues)] })}
                >
                  Add an amount
                </Button>
              ) : null}
            </div>
            <GroupedList>
              <ListRow
                icon={<span className="font-price font-bold">{currencyMark(currency)}</span>}
                iconTone="pool"
                title="Any amount"
                subtitle="Donors can type their own"
                trailing={<Switch label="Let donors type their own amount" checked={form.allowCustom} onChange={(allowCustom) => change({ allowCustom })} />}
              />
            </GroupedList>
            <div className="grid gap-5 sm:grid-cols-3">
              <TextField
                label="Smallest gift"
                prefix={currencyMark(currency)}
                inputMode="decimal"
                value={form.min}
                onChange={(event) => change({ min: event.target.value })}
                error={minError ?? fieldError("min") ?? undefined}
              />
              <TextField
                label="Largest gift"
                prefix={currencyMark(currency)}
                inputMode="decimal"
                value={form.max}
                onChange={(event) => change({ max: event.target.value })}
                error={maxError ?? fieldError("max") ?? undefined}
              />
              <TextField
                label="Goal"
                prefix={currencyMark(currency)}
                inputMode="decimal"
                placeholder="Optional"
                value={form.goal}
                onChange={(event) => change({ goal: event.target.value })}
                error={goalError ?? undefined}
                hint="Shows a progress bar."
              />
            </div>
          </section>

          <section className="flex flex-col gap-5">
            <SectionTitle>Wording</SectionTitle>
            <div className="flex flex-col gap-3">
              <TextField
                label="Button"
                value={form.buttonLabel}
                maxLength={LABEL_MAX}
                onChange={(event) => change({ buttonLabel: event.target.value })}
                error={labelError ?? fieldError("label") ?? undefined}
                hint="People see it on the button and under the code. Say Tip or Pay what you want if it isn’t a charity."
              />
              <div className="flex flex-wrap gap-2">
                {LABELS.map((label) => (
                  <Button key={label} size="sm" variant={form.buttonLabel === label ? "lemon" : "tinted"} onClick={() => change({ buttonLabel: label })}>
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            <TextArea
              label="Thank-you message"
              rows={2}
              maxLength={THANKS_MAX}
              value={form.thanks}
              onChange={(event) => change({ thanks: event.target.value })}
              hint="Shown once a gift is paid."
            />
          </section>

          <section className="flex flex-col gap-5">
            <SectionTitle>Notes</SectionTitle>
            <GroupedList footer="Links, emails, phone numbers and @handles are refused, and swearing is masked. You can hide any note.">
              <ListRow
                icon={<QuoteIcon />}
                iconTone="lemon"
                title="Ask for a note"
                subtitle="Up to 140 characters"
                trailing={<Switch label="Let donors leave a note" checked={form.notes} onChange={(notes) => change({ notes })} />}
              />
              <ListRow
                icon={<QrCodeIcon />}
                iconTone="ink"
                title="Show notes on the poster"
                subtitle="The latest few, on the display screen"
                trailing={<Switch label="Show notes on the display" checked={form.showNotes} onChange={(showNotes) => change({ showNotes })} />}
              />
            </GroupedList>
            <NotesModeration feed={feed} currency={currency} />
          </section>

          {generalError ? (
            <p role="alert" className="text-subhead font-semibold text-berry">
              {generalError}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}

/** A sensible next amount: double the largest so far. */
function nextPreset(values: (number | null)[]): string {
  const largest = Math.max(0, ...values.filter((v): v is number => v !== null && !Number.isNaN(v)));
  return centsText(largest ? largest * 2 : 500);
}

/** Recent gifts with notes, newest first, each with a switch to hide it from the poster. */
function NotesModeration({ feed, currency }: { feed: (DonationFeed & { setHidden: (id: string, hidden: boolean) => void }) | null; currency: string }) {
  const withNotes = feed?.recent.filter((gift) => gift.note) ?? [];
  if (!feed) return null;
  if (withNotes.length === 0) return <p className="px-1 text-subhead text-ink-2">Notes from donors show up here.</p>;
  return (
    <GroupedList header="Recent notes">
      {withNotes.slice(0, 12).map((gift) => (
        <ListRow
          key={gift.id}
          icon={<QuoteIcon />}
          iconTone={gift.noteHidden ? "ink" : "lemon"}
          title={<span className={gift.noteHidden ? "text-ink-3 line-through" : undefined}>{gift.note}</span>}
          subtitle={
            <>
              <Money cents={gift.amountCents} currency={currency} size="inline" className="font-normal" />
              {gift.from ? ` from ${gift.from}` : ""}
              {gift.noteHidden ? " · Hidden" : ""}
            </>
          }
          trailing={<Switch label={`Show “${gift.note}” on the poster`} checked={!gift.noteHidden} onChange={(show) => feed.setHidden(gift.id, !show)} />}
        />
      ))}
    </GroupedList>
  );
}

/** The stand's gifts, refreshed every 20 seconds, with a way to hide a note that updates at once. */
function useDonationFeed(standId: string) {
  const [feed, setFeed] = useState<DonationFeed | null>(null);
  useEffect(() => {
    let live = true;
    async function load() {
      const res = await fetch(standApi("/api/stand/donations", standId), { cache: "no-store" }).catch(() => null);
      const json = res?.ok ? ((await res.json()) as DonationFeed) : null;
      if (live && json) setFeed(json);
    }
    void load();
    const timer = setInterval(load, 20_000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [standId]);

  async function setHidden(id: string, hidden: boolean) {
    const toggle = (value: boolean) =>
      setFeed((current) => current && { ...current, recent: current.recent.map((g) => (g.id === id ? { ...g, noteHidden: value } : g)) });
    toggle(hidden);
    const res = await fetch(`/api/stand/donations/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteHidden: hidden }),
    }).catch(() => null);
    if (!res?.ok) toggle(!hidden);
  }

  return feed ? { ...feed, setHidden } : null;
}

const toolbarLink =
  "pressable focus-ring inline-flex h-11 items-center gap-2 rounded-full px-5 text-callout font-semibold text-ink hover:bg-fill-2 [&_svg]:text-[1.15em] max-[24rem]:px-4 max-[24rem]:[&_svg]:hidden";

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
