"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AiModePill,
  AIGlow,
  ArrowUpIcon,
  Button,
  CameraIcon,
  ExclamationIcon,
  MicIcon,
  PalChangeCard,
  PalMascot,
  PalProposalCard,
  Sheet,
  ShimmerText,
  XmarkIcon,
  cn,
  type PalConfirmState,
  type PalMood,
  type PalUndoState,
} from "@/components/kit";
import {
  PAL_CHANGED,
  type PalAction,
  type PalChange,
  type PalEvent,
  type PalOutcome,
  type PalProposal,
  type PalScreen,
  type PalTranscript,
} from "@/lib/pal-events";
import { PASSCODE_NAME, presetsFor, unlockHref, type PalPreset } from "@/lib/ai-preview";
import { standApi } from "@/lib/stands";
import type { StandKind } from "@/lib/types";
import { shrinkPhoto } from "../shrink-photo";
import { handOff, PHONE_QUERY } from "./handoff";

/** The stand and screen Pal is opened from. Each seller page sets it by rendering a PalButton. */
type Anchor = { standId: string; kind: StandKind; screen: PalScreen };

type Bubble =
  /** `photo` is a local preview, or true for a photo sent before a reload, which isn't kept. */
  | { id: string; from: "seller"; text: string; photo?: string | true }
  | { id: string; from: "pal"; text: string; changes: PalChange[]; proposals: PalProposal[]; error?: string };

type PalApi = {
  setAnchor: (anchor: Anchor | null) => void;
  open: () => void;
  mood: PalMood;
};

const PalContext = createContext<PalApi | null>(null);

/** Prompt chips for an empty chat, for the screen it opens on. */
function starters({ kind, screen }: Anchor): string[] {
  switch (screen) {
    case "register":
      return ["How’s today going?", "What’s selling best?", "Mark something sold out", "Add a 2 for $5 deal"];
    case "setup":
      return ["Add a new item", "Sort my items into categories", "Which items have no emoji?"];
    case "recap":
      return ["How’s today going?", "Chart sales by hour", "Refund the last sale", "What’s selling best?"];
    case "orders":
      return ["What needs shipping?", "Mark the oldest pickup collected", "Who ordered today?"];
    case "store":
      return ["Close the store for today", "Offer free shipping over $30", "Which items ship?"];
    case "jar":
      return ["How much came in today?", "Read me the latest notes", "Set a $500 goal", "Add a $50 amount"];
  }
  return {
    local: ["How’s today going?", "What’s selling best?", "Mark something sold out"],
    online: ["How’s the store doing?", "What needs shipping?", "Which items ship?"],
    donation: ["How much came in today?", "Read me the latest notes", "Set a goal"],
  }[kind];
}

const INTRO: Record<StandKind, string> = {
  local: "Ask me to change prices, mark things sold out, add a deal, refund a sale, or tell you how sales are going.",
  online: "Ask me to open or close the store, change shipping, list or hide items, mark orders shipped, or check sales.",
  donation: "Ask me to change the amounts or goal, hide a note, refund a gift, or tell you how much came in.",
};

/** The browser's speech recognition, where it has one. Chrome and Safari name it webkitSpeechRecognition. */
type Recognizer = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function recognizer(): (new () => Recognizer) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noSubscribe = () => () => {};

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function post(url: string, body?: unknown, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

/** Runs a confirmed proposal through the app's own route for it, the same one its screen uses. */
function runAction(action: PalAction) {
  const sale = (path: string) => `/api/stand/${path}/${encodeURIComponent("saleId" in action ? action.saleId : "")}`;
  switch (action.kind) {
    case "refund":
      return post(`${sale("sales")}/refund`);
    case "ship":
      return post(sale("orders"), { action: "ship", carrier: action.carrier, carrierName: action.carrierName, tracking: action.tracking });
    case "collect":
      return post(sale("orders"), { action: "collect" });
    case "delete_stand":
      return post(standApi("/api/stand/settings", action.standId), undefined, "DELETE");
  }
}

/**
 * Pal, the stand assistant, for every seller screen. It lives in the /stand layout so a chat carries on across
 * screens. Pages say which stand and screen they show by rendering a PalButton, which also opens the chat.
 */
export function PalProvider({ children, aiLive }: { children: ReactNode; aiLive: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [open, setOpen] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [mood, setMood] = useState<PalMood>("idle");
  const [undos, setUndos] = useState<Record<string, PalUndoState>>({});
  const [confirms, setConfirms] = useState<Record<string, PalConfirmState>>({});
  const [photo, setPhoto] = useState<{ url: string; blob: Blob } | null>(null);
  const [listening, setListening] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const canListen = useSyncExternalStore(noSubscribe, () => recognizer() !== null, () => false);
  const recognition = useRef<Recognizer | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const chatId = useRef<string | null>(null);
  const resumed = useRef(false);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  // A happy hop lasts a moment, then Pal settles back to waiting.
  useEffect(() => {
    if (mood !== "happy") return;
    const timer = setTimeout(() => setMood("idle"), 1800);
    return () => clearTimeout(timer);
  }, [mood]);

  // Keep the newest words in view as they arrive.
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [bubbles, status]);

  // The first time the chat opens, pick up the seller's last chat from the server: after a reload, a restart, or on
  // another device.
  useEffect(() => {
    if (!open || resumed.current) return;
    resumed.current = true;
    void (async () => {
      const res = await fetch("/api/stand/pal", { cache: "no-store" }).catch(() => null);
      const saved = res?.ok ? ((await res.json().catch(() => null)) as PalTranscript | null) : null;
      if (!saved?.bubbles.length || chatId.current) return;
      chatId.current = saved.chatId;
      setBubbles(saved.bubbles);
      const pal = saved.bubbles.flatMap((b) => (b.from === "pal" ? [b] : []));
      setUndos(Object.fromEntries(pal.flatMap((b) => b.changes.filter((c) => c.undone).map((c) => [c.id, "undone" as const]))));
      setConfirms(Object.fromEntries(pal.flatMap((b) => b.proposals.flatMap((p) => (p.outcome ? [[p.id, p.outcome]] : [])))));
    })();
  }, [open]);

  // On a keyboard and mouse, the chat is ready to type into. Phones wait for a tap, so the keyboard doesn't jump up.
  useEffect(() => {
    if (open && window.matchMedia("(pointer: fine)").matches) input.current?.focus();
  }, [open]);

  // Closing the chat stops listening.
  useEffect(() => {
    if (!open) recognition.current?.abort();
  }, [open]);

  function listen() {
    if (recognition.current) {
      recognition.current.stop();
      return;
    }
    const Recognition = recognizer();
    if (!Recognition) return;
    const rec = new Recognition();
    rec.lang = navigator.language;
    rec.interimResults = true;
    rec.continuous = false;
    const before = draft.trim() ? `${draft.trim()} ` : "";
    rec.onresult = (event) => {
      const heard = Array.from(event.results, (result) => result[0]?.transcript ?? "").join("");
      setDraft(`${before}${heard}`.slice(0, 2000));
    };
    rec.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") setComposerError("Allow the microphone to talk to Pal.");
      else if (event.error !== "aborted" && event.error !== "no-speech") setComposerError("Pal couldn’t hear that. Try again, or type.");
    };
    rec.onend = () => {
      recognition.current = null;
      setListening(false);
    };
    setComposerError(null);
    recognition.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      recognition.current = null;
      setListening(false);
    }
  }

  async function attach(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setComposerError(null);
    const blob = await shrinkPhoto(file);
    setPhoto((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return { url: URL.createObjectURL(blob), blob };
    });
    input.current?.focus();
  }

  const refresh = useCallback(() => {
    window.dispatchEvent(new Event(PAL_CHANGED));
    startTransition(() => router.refresh());
  }, [router]);

  /** `preset` names a suggested request, which is all Pal answers on simulated AI. */
  async function send(text: string, sign: { url: string; blob: Blob } | null = null, preset?: PalPreset) {
    // A photo on its own asks Pal to bring the items in line with the sign.
    const message = text.trim() || (sign ? "Update my items from this sign." : "");
    if (!anchor || busy || !message) return;
    recognition.current?.stop();
    setComposerError(null);
    let photoData: string | undefined;
    if (sign) {
      photoData = await dataUrl(sign.blob).catch(() => undefined);
      if (!photoData?.startsWith("data:image/jpeg;")) {
        setComposerError("That photo couldn’t be read. Try another.");
        return;
      }
      setPhoto(null);
    }
    chatId.current ??= crypto.randomUUID();
    const palId = crypto.randomUUID();
    const patch = (change: (bubble: Extract<Bubble, { from: "pal" }>) => Bubble) =>
      setBubbles((all) => all.map((b) => (b.id === palId && b.from === "pal" ? change(b) : b)));
    setBubbles((all) => [
      ...all,
      { id: crypto.randomUUID(), from: "seller", text: message, ...(sign ? { photo: sign.url } : {}) },
      { id: palId, from: "pal", text: "", changes: [], proposals: [] },
    ]);
    setDraft("");
    setBusy(true);
    setMood("thinking");
    setStatus("Thinking");

    let navigateTo: string | null = null;
    let handoff: string | null = null;
    let changed = false;
    let failed = false;
    const handle = (event: PalEvent) => {
      if (event.type === "status") {
        setStatus(event.text);
        setMood("thinking");
      } else if (event.type === "text") {
        setStatus(null);
        setMood("talking");
        patch((b) => ({ ...b, text: b.text + event.delta }));
      } else if (event.type === "change") {
        changed = true;
        patch((b) => ({ ...b, changes: [...b.changes, event.change] }));
        refresh();
      } else if (event.type === "proposal") {
        patch((b) => ({ ...b, proposals: [...b.proposals, event.proposal] }));
      } else if (event.type === "handoff") {
        handoff = event.prompt;
      } else if (event.type === "navigate") {
        navigateTo = event.href;
      } else if (event.type === "error") {
        failed = true;
        patch((b) => ({ ...b, error: event.message }));
      }
    };

    try {
      const res = await fetch(standApi("/api/stand/pal", anchor.standId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: chatId.current,
          message,
          photo: photoData,
          preset,
          screen: anchor.screen,
          analyst: !window.matchMedia(PHONE_QUERY).matches,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Pal couldn’t answer right now. Try again.");
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let pending = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += value;
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) handle(JSON.parse(line) as PalEvent);
      }
    } catch (error) {
      failed = true;
      const text = error instanceof Error && error.message !== "Failed to fetch" ? error.message : "Pal couldn’t reach Lemon Pal. Check the connection.";
      patch((b) => ({ ...b, error: text }));
    } finally {
      setBusy(false);
      setStatus(null);
      setMood(failed ? "oops" : changed ? "happy" : "idle");
    }

    if (failed) return;
    const question = handoff as string | null;
    let href = navigateTo as string | null;
    if (question) {
      // Booth Analyst only appears where Studio has room for its panel.
      if (window.matchMedia(PHONE_QUERY).matches) {
        patch((b) => ({ ...b, error: "Booth Analyst needs a bigger screen, like a tablet or computer." }));
        if (href === "/stand/recap") href = null;
      } else {
        setOpen(false);
        // After the sheet has closed and handed focus back, so Booth Analyst's box keeps it.
        setTimeout(() => handOff(question), 150);
      }
    }
    if (href) {
      setOpen(false);
      router.push(href, { transitionTypes: ["nav-forward"] });
    }
  }

  function tell(proposal: PalProposal, outcome: PalOutcome) {
    void post("/api/stand/pal/outcome", { proposalId: proposal.id, outcome }).catch(() => null);
  }

  async function confirm(proposal: PalProposal) {
    setConfirms((all) => ({ ...all, [proposal.id]: "working" }));
    const result = await runAction(proposal.action).catch(() => null);
    if (!result?.ok) {
      // Left open to try again, so Pal isn't told yet. Every route here is safe to repeat.
      const error = result?.json.error ?? "That didn’t go through. Try again.";
      setConfirms((all) => ({ ...all, [proposal.id]: { error } }));
      return;
    }
    setConfirms((all) => ({ ...all, [proposal.id]: "done" }));
    setMood("happy");
    tell(proposal, "done");
    if (proposal.action.kind === "delete_stand" && typeof result.json.home === "string") {
      setOpen(false);
      router.push(result.json.home, { transitionTypes: ["nav-back"] });
    } else {
      refresh();
    }
  }

  function dismiss(proposal: PalProposal) {
    setConfirms((all) => ({ ...all, [proposal.id]: "declined" }));
    tell(proposal, "declined");
  }

  async function undo(change: PalChange) {
    setUndos((all) => ({ ...all, [change.id]: "undoing" }));
    const res = await fetch("/api/stand/pal/undo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changeId: change.id }),
    }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok) {
      setUndos((all) => ({ ...all, [change.id]: "undone" }));
      refresh();
    } else {
      setUndos((all) => ({ ...all, [change.id]: { error: json.error ?? "Couldn’t undo that. Try again." } }));
    }
  }

  function newChat() {
    // The old chat is deleted on the server too, so it doesn't come back on the next visit.
    if (chatId.current) void fetch(`/api/stand/pal?chat=${chatId.current}`, { method: "DELETE" }).catch(() => null);
    chatId.current = null;
    setBubbles([]);
    setUndos({});
    setConfirms({});
    setMood("idle");
    setPhoto(null);
    input.current?.focus();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send(draft, photo);
  }

  const liveMood: PalMood = busy ? mood : listening || (typing && draft) ? "listening" : mood;
  const canAttach = aiLive && anchor !== null && anchor.kind !== "donation";

  return (
    <PalContext value={{ setAnchor, open: () => setOpen(true), mood: liveMood }}>
      {children}
      <Sheet open={open && anchor !== null} onClose={() => setOpen(false)} title="Ask Pal">
        <div className="flex flex-col gap-4">
          <div ref={list} className="-mx-2 flex max-h-[min(30rem,52dvh)] flex-col gap-4 overflow-y-auto overscroll-contain px-2 py-1">
            {bubbles.length === 0 ? (
              <div className="flex items-center gap-4">
                <PalMascot mood={liveMood} className="size-20 shrink-0 drop-shadow-md" />
                <p className="text-body text-ink-2">
                  Hi, I&rsquo;m Pal. {aiLive ? (anchor ? INTRO[anchor.kind] : null) : "This demo account runs me on simulated AI, so pick a request below and I’ll do it for real on your stand."}
                </p>
              </div>
            ) : (
              bubbles.map((bubble, i) =>
                bubble.from === "seller" ? (
                  <div key={bubble.id} className="flex max-w-[85%] flex-col items-end gap-1.5 self-end">
                    {typeof bubble.photo === "string" ? (
                      // A local preview of the photo the seller sent. Pal itself only gets what the sign reader read.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={bubble.photo} alt="Your sign photo" className="max-h-40 rounded-[18px] object-cover shadow-card" />
                    ) : bubble.photo ? (
                      <span className="flex items-center gap-1.5 rounded-full bg-fill px-3 py-1.5 text-footnote font-semibold text-ink-2">
                        <CameraIcon className="shrink-0" /> Sign photo
                      </span>
                    ) : null}
                    <p className="rounded-[22px] rounded-br-md bg-fill-2 px-4 py-2.5 text-body whitespace-pre-wrap wrap-anywhere">{bubble.text}</p>
                  </div>
                ) : (
                  <PalBubble
                    key={bubble.id}
                    bubble={bubble}
                    mood={i === bubbles.length - 1 ? liveMood : "idle"}
                    status={i === bubbles.length - 1 && busy ? status : null}
                    undos={undos}
                    confirms={confirms}
                    onUndo={undo}
                    onConfirm={confirm}
                    onDismiss={dismiss}
                  />
                ),
              )
            )}
          </div>

          {/* On simulated AI, the suggested requests are the only way to ask, so they stay. */}
          {!aiLive && anchor ? (
            <div className="flex flex-wrap gap-2">
              {presetsFor(anchor.kind).map((preset) => (
                <Button key={preset.id} variant="tinted" disabled={busy} onClick={() => void send(preset.label, null, preset.id)}>
                  {preset.label}
                </Button>
              ))}
            </div>
          ) : bubbles.length === 0 && anchor ? (
            <div className="flex flex-wrap gap-2">
              {starters(anchor).map((starter) => (
                <Button key={starter} variant="tinted" onClick={() => void send(starter)}>
                  {starter}
                </Button>
              ))}
            </div>
          ) : null}

          {aiLive ? null : (
            <div className="flex items-start gap-2">
              <AiModePill live={false} />
              <p className="flex-1 text-footnote text-ink-2">
                To ask Pal anything, typed or out loud, or send it a sign photo,{" "}
                <Link href={unlockHref(pathname)} className="font-semibold text-peel underline-offset-2 hover:underline">
                  enter the seller passcode ({PASSCODE_NAME})
                </Link>
                .
              </p>
              {bubbles.length > 0 ? (
                <Button variant="plain" size="sm" disabled={busy} onClick={newChat}>
                  New chat
                </Button>
              ) : null}
            </div>
          )}

          {aiLive ? (
          <form onSubmit={submit} className="flex flex-col gap-2">
            {photo ? (
              <div className="flex items-center gap-3 self-start rounded-[18px] bg-fill p-1.5 pr-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="" className="size-11 rounded-[12px] object-cover" />
                <span className="text-subhead text-ink-2">Sign photo</span>
                <Button
                  variant="ghost"
                  iconOnly
                  aria-label="Remove the sign photo"
                  icon={<XmarkIcon />}
                  onClick={() => {
                    URL.revokeObjectURL(photo.url);
                    setPhoto(null);
                  }}
                />
              </div>
            ) : null}
            <AIGlow active={busy || listening} shape="pill">
              <div className="flex items-center gap-1 rounded-full bg-fill p-1.5 pl-5 shadow-[inset_0_0_0_1px_var(--control-edge)] transition-[background-color,box-shadow] duration-200 focus-within:bg-surface focus-within:shadow-[inset_0_0_0_2px_var(--focus)]">
                <input
                  ref={input}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onFocus={() => setTyping(true)}
                  onBlur={() => setTyping(false)}
                  aria-label="Message Pal"
                  placeholder={listening ? "Listening…" : photo ? "Add a note, or send" : "Ask Pal to…"}
                  maxLength={2000}
                  enterKeyHint="send"
                  autoComplete="off"
                  className="h-11 min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-ink-3"
                />
                <Button
                  type="submit"
                  variant="filled"
                  iconOnly
                  aria-label="Send"
                  icon={<ArrowUpIcon />}
                  disabled={!draft.trim() && !photo}
                  loading={busy}
                />
              </div>
            </AIGlow>
            {composerError ? (
              <p role="alert" className="flex items-center gap-1.5 px-4 text-footnote font-semibold text-berry">
                <ExclamationIcon className="shrink-0" /> {composerError}
              </p>
            ) : null}
            {canAttach || canListen || bubbles.length > 0 ? (
              <div className="flex items-center gap-1 px-1">
                {canAttach ? (
                  <>
                    <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(event) => void attach(event)} />
                    <Button
                      variant="ghost"
                      iconOnly
                      aria-label="Add a photo of your price sign"
                      icon={<CameraIcon />}
                      disabled={busy}
                      onClick={() => fileInput.current?.click()}
                    />
                  </>
                ) : null}
                {canListen ? (
                  <Button
                    variant={listening ? "lemon" : "ghost"}
                    iconOnly
                    aria-label={listening ? "Stop listening" : "Talk to Pal"}
                    aria-pressed={listening}
                    icon={<MicIcon />}
                    disabled={busy}
                    onClick={listen}
                  />
                ) : null}
                {bubbles.length > 0 ? (
                  <Button variant="plain" size="sm" className="ml-auto" disabled={busy} onClick={newChat}>
                    New chat
                  </Button>
                ) : null}
              </div>
            ) : null}
          </form>
          ) : null}
        </div>
      </Sheet>
    </PalContext>
  );
}

function PalBubble({
  bubble,
  mood,
  status,
  undos,
  confirms,
  onUndo,
  onConfirm,
  onDismiss,
}: {
  bubble: Extract<Bubble, { from: "pal" }>;
  mood: PalMood;
  status: string | null;
  undos: Record<string, PalUndoState>;
  confirms: Record<string, PalConfirmState>;
  onUndo: (change: PalChange) => void;
  onConfirm: (proposal: PalProposal) => void;
  onDismiss: (proposal: PalProposal) => void;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <PalMascot mood={mood} className="mt-0.5 size-9 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5" aria-live="polite">
        {bubble.text ? <p className="text-body whitespace-pre-wrap wrap-anywhere">{bubble.text}</p> : null}
        {status ? <ShimmerText className="text-body">{status}…</ShimmerText> : null}
        {bubble.changes.map((change) => (
          <PalChangeCard
            key={change.id}
            title={change.title}
            lines={change.lines}
            state={undos[change.id]}
            onUndo={change.undoable ? () => onUndo(change) : undefined}
          />
        ))}
        {bubble.proposals.map((proposal) => (
          <PalProposalCard
            key={proposal.id}
            title={proposal.title}
            lines={proposal.lines}
            confirm={proposal.confirm}
            danger={proposal.danger}
            state={confirms[proposal.id]}
            onConfirm={() => onConfirm(proposal)}
            onDismiss={() => onDismiss(proposal)}
          />
        ))}
        {bubble.error ? (
          <p role="alert" className="flex items-center gap-1.5 text-subhead font-semibold text-berry">
            <ExclamationIcon className="shrink-0" /> {bubble.error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Opens Pal for the stand on screen, and tells Pal which stand and screen that is. Put one in each seller page's
 * header. It shows Pal's face, so the seller can see Pal thinking even with the chat closed.
 */
export function PalButton({ standId, kind, screen, className }: Anchor & { className?: string }) {
  const pal = useContext(PalContext);
  const setAnchor = pal?.setAnchor;
  useEffect(() => {
    if (!setAnchor) return;
    setAnchor({ standId, kind, screen });
    return () => setAnchor(null);
  }, [setAnchor, standId, kind, screen]);
  if (!pal) return null;
  return (
    <Button
      variant="glass"
      onClick={pal.open}
      icon={<PalMascot mood={pal.mood} className="-my-2 -ml-2 size-9" />}
      className={cn("max-[24rem]:w-11 max-[24rem]:px-0", className)}
    >
      <span className="max-[24rem]:sr-only">Ask Pal</span>
    </Button>
  );
}
