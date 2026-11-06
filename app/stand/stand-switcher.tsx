"use client";

import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useState, type FormEvent } from "react";
import {
  Button,
  ChevronDownIcon,
  GroupedList,
  ChevronRightIcon,
  HeartIcon,
  LinkIcon,
  ListRow,
  PencilIcon,
  PersonIcon,
  PlusIcon,
  QrCodeIcon,
  SegmentedControl,
  Sheet,
  TextField,
  TrashIcon,
  cn,
} from "@/components/kit";
import { standApi, type StandSummary } from "@/lib/stands";
import { forgetDemoAccount } from "./demo-accounts";
import type { StandKind } from "@/lib/types";

const kindIcon = { local: <QrCodeIcon />, online: <LinkIcon />, donation: <HeartIcon /> } as const;
const kindTone = { local: "ink", online: "pool", donation: "berry" } as const;
const kindLabel = { local: "stand at events", online: "online store", donation: "donation stand" } as const;
const kindSubtitle = { local: "Register at events", online: "Online store and orders", donation: "One code, pay what you want" } as const;

/** What the sheet shows: the list of stands, or one of the screens it leads to. */
type View = "list" | "new" | "stand" | "account";
const viewTitle: Record<View, string> = { list: "Your stands", new: "New stand", stand: "Stand settings", account: "Account" };

/**
 * Says which stand the seller is on and switches to another. It sits where a page names its stand: as the title on
 * the register, as the small line above the title everywhere else. Tapping it opens a sheet of the seller's stands,
 * split into stands at events and online stores, with a way to start a new one, rename or delete the stand on
 * screen, and see or leave the account.
 */
export function StandSwitcher({
  current,
  stands,
  userName,
  userEmail,
  userId,
  demoAccount,
  remembered = true,
  variant = "eyebrow",
}: {
  current: StandSummary;
  stands: StandSummary[];
  userName: string;
  userEmail: string | null;
  userId: string;
  /** A demo account made on the sign-in page, rather than a PayPal login. */
  demoAccount: boolean;
  /** false when the page opened another stand than the last one switched to, so this one becomes the last. */
  remembered?: boolean;
  variant?: "title" | "eyebrow";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("list");
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
    setView("list");
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
  const donation = stands.filter((s) => s.kind === "donation");
  const label = `${current.name}, ${kindLabel[current.kind]}. Switch stand`;

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

      <Sheet open={open} onClose={close} title={viewTitle[view]}>
        {view === "new" ? (
          <NewStand onCancel={() => setView("list")} onCreated={(next) => {
            setOpen(false);
            setView("list");
            void go(next);
          }} />
        ) : view === "stand" ? (
          <StandSettings
            stand={current}
            onlyStand={stands.length <= 1}
            onBack={() => setView("list")}
            onRenamed={() => {
              setOpen(false);
              setView("list");
              startTransition(() => router.refresh());
            }}
          />
        ) : view === "account" ? (
          <Account
            name={userName}
            email={userEmail}
            userId={userId}
            demoAccount={demoAccount}
            standCount={stands.length}
            signingOut={busy === "signout"}
            onSignOut={signOut}
            onBack={() => setView("list")}
          />
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
            {donation.length > 0 && (
              <GroupedList header="Donations">
                {donation.map((stand) => (
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
              <ListRow
                icon={<PencilIcon />}
                iconTone="ink"
                title="Rename or delete"
                subtitle={current.name}
                trailing={<ChevronRightIcon className="text-ink-3" />}
                onClick={() => setView("stand")}
              />
              <ListRow icon={<PlusIcon />} iconTone="lemon" title="New stand" onClick={() => setView("new")} />
            </GroupedList>
            <GroupedList header="Account">
              <ListRow
                icon={<PersonIcon />}
                iconTone="ink"
                title={userName}
                subtitle={demoAccount ? "Demo account" : (userEmail ?? "Signed in with PayPal")}
                trailing={<ChevronRightIcon className="text-ink-3" />}
                onClick={() => setView("account")}
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
      subtitle={busy ? "Switching…" : kindSubtitle[stand.kind]}
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
          { value: "donation", label: "Donations" },
        ]}
      />
      <p className="-mt-2 px-1 text-footnote text-ink-2">
        {kind === "local"
          ? "A register for markets and fairs. Buyers scan a code and pay on their phone."
          : kind === "online"
            ? "A store page at your own link, for pickup and shipped orders."
            : "One code people scan to give what they like, with your photo, title and message."}
      </p>
      <TextField
        label="Stand name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={{ local: "Saturday Market", online: "My Shop", donation: "Shelter Fundraiser" }[kind]}
        maxLength={40}
        autoFocus
        error={error ?? undefined}
      />
      <div className="flex flex-wrap-reverse justify-end gap-3">
        <Button variant="plain" type="button" onClick={onCancel} disabled={busy}>
          Back
        </Button>
        <Button variant="filled" type="submit" loading={busy}>
          {kind === "donation" ? "Create and set up page" : "Create and add items"}
        </Button>
      </div>
    </form>
  );
}

/** Renames the stand on screen, or deletes it with everything it holds after a second, explicit tap. */
function StandSettings({
  stand,
  onlyStand,
  onBack,
  onRenamed,
}: {
  stand: StandSummary;
  onlyStand: boolean;
  onBack: () => void;
  onRenamed: () => void;
}) {
  const [name, setName] = useState(stand.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<"idle" | "confirm" | "busy">("idle");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function rename(event: FormEvent) {
    event.preventDefault();
    const next = name.trim();
    if (!next) return setError("Give your stand a name.");
    if (next === stand.name) return onBack();
    setSaving(true);
    setError(null);
    const res = await fetch(standApi("/api/stand/settings", stand.id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: next }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { error?: string } | null;
    setSaving(false);
    if (!res?.ok) return setError(json?.error ?? "Couldn’t rename the stand. Try again.");
    onRenamed();
  }

  async function remove() {
    setDeleting("busy");
    setDeleteError(null);
    const res = await fetch(standApi("/api/stand/settings", stand.id), { method: "DELETE" }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { home?: string; error?: string } | null;
    if (!res?.ok || !json?.home) {
      setDeleting("confirm");
      return setDeleteError(json?.error ?? "Couldn’t delete the stand. Try again.");
    }
    // A full load, so no page of the deleted stand stays in the router's cache.
    window.location.assign(json.home);
  }

  const kindWord = { local: "stand", online: "store", donation: "donation stand" }[stand.kind];
  // What goes with the stand, in the warning and the confirmation.
  const contents = {
    local: { short: "Deletes its items and sales history.", long: " Its items and sales history go with it." },
    online: { short: "Deletes its items, store page and sales history.", long: " Its items, store page and orders go with it." },
    donation: { short: "Deletes its page, notes and gift history.", long: " Its page, notes and gift history go with it." },
  }[stand.kind];
  const cantDelete = onlyStand ? "This is your only stand. Make another before deleting this one." : null;

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={rename} className="flex flex-col gap-4">
        <TextField
          label="Stand name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={40}
          error={error ?? undefined}
        />
        <div className="flex flex-wrap-reverse justify-end gap-3">
          <Button variant="plain" type="button" onClick={onBack} disabled={saving}>
            Back
          </Button>
          <Button variant="filled" type="submit" loading={saving}>
            Save name
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-2 border-t border-hairline pt-5">
        {cantDelete ? (
          <p className="px-1 text-footnote text-ink-2">{cantDelete}</p>
        ) : deleting === "idle" ? (
          <>
            <Button variant="destructive" icon={<TrashIcon />} onClick={() => setDeleting("confirm")}>
              Delete this {kindWord}
            </Button>
            <p className="px-1 text-center text-footnote text-ink-2">{contents.short}</p>
          </>
        ) : (
          <div className="flex animate-rise flex-col gap-3 rounded-field bg-berry-soft p-4" role="alertdialog" aria-labelledby="delete-stand">
            <p id="delete-stand" className="text-callout">
              <strong className="font-semibold">Delete &ldquo;{stand.name}&rdquo;?</strong>
              {contents.long} Payments buyers already
              made stay in your PayPal account. You can&rsquo;t undo this.
            </p>
            {deleteError && (
              <p role="alert" className="text-footnote font-semibold text-berry">
                {deleteError}
              </p>
            )}
            <div className="flex flex-wrap-reverse justify-end gap-2">
              <Button variant="plain" disabled={deleting === "busy"} onClick={() => setDeleting("idle")}>
                Keep it
              </Button>
              <Button variant="filled" icon={<TrashIcon />} loading={deleting === "busy"} onClick={remove}>
                {deleting === "busy" ? "Deleting…" : "Yes, delete it"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Who's signed in, a way out, and a way to delete the account. */
function Account({
  name,
  email,
  userId,
  demoAccount,
  standCount,
  signingOut,
  onSignOut,
  onBack,
}: {
  name: string;
  email: string | null;
  userId: string;
  demoAccount: boolean;
  standCount: number;
  signingOut: boolean;
  onSignOut: () => void;
  onBack: () => void;
}) {
  const [deleting, setDeleting] = useState<"idle" | "confirm" | "busy">("idle");
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setDeleting("busy");
    setError(null);
    const res = await fetch("/api/auth/account", { method: "DELETE" }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { next?: string; error?: string } | null;
    if (!res?.ok || !json?.next) {
      setDeleting("confirm");
      return setError(json?.error ?? "Couldn’t delete your account. Try again.");
    }
    // A deleted demo account can't be opened again, so the sign-in page stops offering it.
    if (demoAccount) forgetDemoAccount(userId);
    window.location.assign(json.next);
  }

  return (
    <div className="flex flex-col gap-6">
      <GroupedList
        footer={
          demoAccount
            ? "This demo account is saved on this browser. Sign out and you can open it again from the sign-in page for 30 days."
            : "You signed in with PayPal. Signing out of Lemon Pal leaves your PayPal account signed in."
        }
      >
        <ListRow
          icon={<PersonIcon />}
          iconTone="ink"
          title={name}
          subtitle={demoAccount ? "Demo account" : (email ?? "PayPal account")}
        />
      </GroupedList>

      <div className="flex flex-wrap-reverse justify-end gap-3">
        <Button variant="plain" onClick={onBack} disabled={signingOut || deleting === "busy"}>
          Back
        </Button>
        {/* While the delete confirmation is up, its button is the one filled action on screen. */}
        <Button variant={deleting === "idle" ? "filled" : "tinted"} onClick={onSignOut} loading={signingOut} disabled={deleting === "busy"}>
          Sign out
        </Button>
      </div>

      <div className="flex flex-col gap-2 border-t border-hairline pt-5">
        {deleting === "idle" ? (
          <Button variant="destructive" icon={<TrashIcon />} onClick={() => setDeleting("confirm")}>
            {demoAccount ? "Delete this demo account" : "Delete my account"}
          </Button>
        ) : (
          <div className="flex animate-rise flex-col gap-3 rounded-field bg-berry-soft p-4" role="alertdialog" aria-labelledby="delete-account">
            <p id="delete-account" className="text-callout">
              <strong className="font-semibold">{demoAccount ? "Delete this demo account?" : "Delete your Lemon Pal account?"}</strong>{" "}
              Your{" "}
              {standCount === 1
                ? "stand, with its items, store and sales history, is"
                : `${standCount} stands, with their items, stores and sales history, are`}{" "}
              deleted.{" "}
              {demoAccount
                ? "You can make a new demo account any time."
                : "Payments buyers already made stay in your PayPal account, and PayPal itself isn’t touched."}{" "}
              You can&rsquo;t undo this.
            </p>
            {error && (
              <p role="alert" className="text-footnote font-semibold text-berry">
                {error}
              </p>
            )}
            <div className="flex flex-wrap-reverse justify-end gap-2">
              <Button variant="plain" disabled={deleting === "busy"} onClick={() => setDeleting("idle")}>
                Keep my account
              </Button>
              <Button variant="filled" icon={<TrashIcon />} loading={deleting === "busy"} onClick={remove}>
                {deleting === "busy" ? "Deleting…" : "Yes, delete it"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
