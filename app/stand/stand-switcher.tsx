"use client";

import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useState, type FormEvent } from "react";
import {
  Button,
  ChevronDownIcon,
  GroupedList,
  LinkIcon,
  ListRow,
  PersonIcon,
  PlusIcon,
  QrCodeIcon,
  SegmentedControl,
  Sheet,
  TextField,
  cn,
} from "@/components/kit";
import type { StandSummary } from "@/lib/stands";
import type { StandKind } from "@/lib/types";

const kindIcon = { local: <QrCodeIcon />, online: <LinkIcon /> } as const;
const kindTone = { local: "ink", online: "pool" } as const;

/**
 * Says which stand the seller is on and switches to another. It sits where a page names its stand: as the title on
 * the register, as the small line above the title everywhere else. Tapping it opens a sheet of the seller's stands,
 * split into stands at events and online stores, with a way to start a new one.
 */
export function StandSwitcher({
  current,
  stands,
  userName,
  ownAccount,
  remembered = true,
  variant = "eyebrow",
}: {
  current: StandSummary;
  stands: StandSummary[];
  userName: string;
  ownAccount: boolean;
  /** false when the page opened another stand than the last one switched to, so this one becomes the last. */
  remembered?: boolean;
  variant?: "title" | "eyebrow";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The register opens a local stand and the store an online one, even when the seller last switched to the other
  // kind. Remember the stand on screen, so the recap and setup follow it.
  useEffect(() => {
    if (remembered) return;
    void fetch("/api/stand/current", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ standId: current.id }),
    }).catch(() => null);
  }, [remembered, current.id]);

  function close() {
    if (busy) return;
    setOpen(false);
    setCreating(false);
    setError(null);
  }

  async function go(next: string) {
    // Same page, other stand: reload its data in place. Another page: slide over to it.
    startTransition(() => {
      if (next === pathname) router.refresh();
      else router.push(next, { transitionTypes: ["nav-forward"] });
    });
  }

  async function switchTo(stand: StandSummary) {
    if (stand.id === current.id) return close();
    setBusy(stand.id);
    setError(null);
    const res = await fetch("/api/stand/current", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ standId: stand.id }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { home?: string; error?: string } | null;
    setBusy(null);
    if (!res?.ok || !json?.home) return setError(json?.error ?? "Couldn’t switch stands. Try again.");
    setOpen(false);
    // A page that works for either kind (the recap, setup) stays put. The register and store go to the new stand's home.
    const sharedPage = pathname === "/stand/recap" || pathname === "/stand/setup";
    await go(sharedPage ? pathname : json.home);
  }

  async function signOut() {
    setBusy("signout");
    const res = await fetch("/api/auth/signout", { method: "POST" }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { next?: string } | null;
    // A full load, so nothing from this seller's pages stays in the router's cache for whoever signs in next.
    window.location.assign(json?.next ?? "/stand/unlock");
  }

  const local = stands.filter((s) => s.kind === "local");
  const online = stands.filter((s) => s.kind === "online");
  const label = `${current.name}, ${current.kind === "online" ? "online store" : "stand at events"}. Switch stand`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={label}
        className={cn(
          "pressable focus-ring group -mx-2 inline-flex min-h-11 items-center rounded-full px-2 text-left",
          // max-w-full lets the small line truncate. The title skips it: a percentage max-width would size the header
          // from the title's narrowest width and wrap it early.
          variant === "title"
            ? "gap-2 font-display text-large-title font-semibold"
            : "max-w-full gap-1.5 text-footnote font-semibold text-ink-2 hover:text-ink",
        )}
      >
        {variant === "eyebrow" && <span className="text-[1.1rem]">{kindIcon[current.kind]}</span>}
        {/* The register's title wraps rather than cut off a long stand name. The small line above other titles truncates. */}
        <span className={variant === "title" ? undefined : "min-w-0 truncate"}>{current.name}</span>
        <ChevronDownIcon
          className={cn(
            "shrink-0 text-ink-3 transition-transform duration-300 ease-snappy group-hover:translate-y-0.5",
            variant === "title" ? "text-[0.55em]" : "text-[1em]",
          )}
        />
      </button>

      <Sheet open={open} onClose={close} title={creating ? "New stand" : "Your stands"}>
        {creating ? (
          <NewStand onCancel={() => setCreating(false)} onCreated={(next) => {
            setOpen(false);
            setCreating(false);
            void go(next);
          }} />
        ) : (
          <div className="flex flex-col gap-5">
            {local.length > 0 && (
              <GroupedList header="At events">
                {local.map((stand) => (
                  <StandRow key={stand.id} stand={stand} current={stand.id === current.id} busy={busy === stand.id} onPick={switchTo} />
                ))}
              </GroupedList>
            )}
            {online.length > 0 && (
              <GroupedList header="Online">
                {online.map((stand) => (
                  <StandRow key={stand.id} stand={stand} current={stand.id === current.id} busy={busy === stand.id} onPick={switchTo} />
                ))}
              </GroupedList>
            )}
            {error && (
              <p role="alert" className="px-1 text-footnote font-semibold text-berry">
                {error}
              </p>
            )}
            <GroupedList>
              <ListRow icon={<PlusIcon />} iconTone="lemon" title="New stand" onClick={() => setCreating(true)} />
            </GroupedList>
            <GroupedList
              header="Account"
              footer={
                ownAccount
                  ? "Signed in with PayPal. Signing out here leaves your PayPal account signed in."
                  : "Everyone using the demo shares this seller. Log in with PayPal for stands of your own."
              }
            >
              <ListRow
                icon={<PersonIcon />}
                iconTone="ink"
                title={userName}
                subtitle={busy === "signout" ? "Signing out…" : ownAccount ? "Sign out" : "Leave the demo"}
                onClick={signOut}
              />
            </GroupedList>
          </div>
        )}
      </Sheet>
    </>
  );
}

function StandRow({
  stand,
  current,
  busy,
  onPick,
}: {
  stand: StandSummary;
  current: boolean;
  busy: boolean;
  onPick: (stand: StandSummary) => void;
}) {
  return (
    <ListRow
      icon={kindIcon[stand.kind]}
      iconTone={kindTone[stand.kind]}
      title={stand.name}
      subtitle={busy ? "Switching…" : stand.kind === "online" ? "Online store and orders" : "Register at events"}
      current={current}
      onClick={() => onPick(stand)}
    />
  );
}

function NewStand({ onCancel, onCreated }: { onCancel: () => void; onCreated: (next: string) => void }) {
  const [kind, setKind] = useState<StandKind>("local");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Give your stand a name.");
    setBusy(true);
    setError(null);
    const res = await fetch("/api/stand/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, name: name.trim() }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { next?: string; error?: string } | null;
    setBusy(false);
    if (!res?.ok || !json?.next) return setError(json?.error ?? "Couldn’t create the stand. Try again.");
    onCreated(json.next);
  }

  return (
    <form onSubmit={create} className="flex flex-col gap-5">
      <SegmentedControl
        label="Where it sells"
        value={kind}
        onChange={setKind}
        options={[
          { value: "local", label: "At events" },
          { value: "online", label: "Online" },
        ]}
      />
      <p className="-mt-2 px-1 text-footnote text-ink-2">
        {kind === "local"
          ? "A register for markets and fairs. Buyers scan a code and pay on their phone."
          : "A store page at your own link, for pickup and shipped orders."}
      </p>
      <TextField
        label="Stand name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={kind === "local" ? "Saturday Market" : "My Shop"}
        maxLength={40}
        autoFocus
        error={error ?? undefined}
      />
      <div className="flex flex-wrap-reverse justify-end gap-3">
        <Button variant="plain" type="button" onClick={onCancel} disabled={busy}>
          Back
        </Button>
        <Button variant="filled" type="submit" loading={busy}>
          Create and add items
        </Button>
      </div>
    </form>
  );
}
