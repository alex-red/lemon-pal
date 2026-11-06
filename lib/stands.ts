import type { Stand, StandKind } from "./types";

/** Stands from before accounts have no kind. They sold through the register, so they're local. */
export function kindOf(stand: Pick<Stand, "kind">): StandKind {
  return stand.kind ?? "local";
}

/** Where a stand's seller lands: the register for a local stand, the store editor for an online one. */
export function standHome(kind: StandKind): string {
  return kind === "online" ? "/stand/store" : "/stand/register";
}

/** Adds the stand to a seller API path, so a request always acts on the stand on screen. */
export function standApi(path: string, standId: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}stand=${encodeURIComponent(standId)}`;
}

/** What the switcher needs to know about each stand. */
export type StandSummary = { id: string; name: string; kind: StandKind };

export function summarize(stand: Stand): StandSummary {
  return { id: stand.id, name: stand.name, kind: kindOf(stand) };
}

/** Everything the stand switcher needs, from a page's current stand. */
export function switcherProps(current: { stand: Stand; stands: Stand[]; user: { name: string }; remembered: boolean }) {
  return {
    current: summarize(current.stand),
    stands: current.stands.map(summarize),
    userName: current.user.name,
    remembered: current.remembered,
  };
}
