// Phone-to-phone sync without any server: each phone shows its state as a QR
// code, the other scans it and merges. Merging is a union (brushings and
// stickers are never removed), so syncing both ways makes the phones identical.
import {
  AVATARS,
  DEFAULT_PROFILE,
  MAX_PROFILES,
  FIRST_EDITION_YEAR,
  HALLOWEEN_STICKERS,
  SEASONS,
  STICKERS,
  editionId,
  newProfileId,
  splitSticker,
  toDay,
  unionHistory,
  type ProfileData,
  type ProfileMeta,
  type ProgressData,
  type Session,
  type Sticker,
} from "./progress";

export const SYNC_PREFIX = "BB1";
/** Only recent brushings travel in the QR (older ones are already shared by previous syncs). */
export const SYNC_WINDOW_DAYS = 400;

interface WireProfile {
  /** id */
  i: string;
  /** name */
  n: string;
  /** avatar index in AVATARS */
  a: number;
  /** first day of the bitmap, in days since 1970-01-01 */
  d: number;
  /** 2 bits per day (bit 0 = morning, bit 1 = evening), base64url */
  s: string;
  /** sticker bitmask (bit n = STICKERS[n]) — the 20 classics only: v0.8 phones refuse k ≥ 2^20 */
  k: number;
  /** Halloween 2026 bitmask (bit n = HALLOWEEN_STICKERS[n]); sent only when non-zero, ignored by v0.8 phones */
  h?: number;
  /**
   * Every other seasonal edition, « h2027 » / « a2026 » (season letter + year) → bitmap of its
   * stickers (base64url, bit n = the season's sticker n). Sent only when non-empty; older phones
   * ignore it, so they lose nothing.
   */
  e?: Record<string, string>;
}

interface WireState {
  v: 1;
  p: WireProfile[];
}

export interface RemoteProfile {
  id: string;
  name: string;
  avatar: string;
  sessions: Session[];
  stickers: string[];
}

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const dayNumber = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
};
const dayString = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (text: string) => {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
};

/** JSON with every non-ASCII character escaped, so any QR scanner reads it the same way. */
const asciiJson = (value: unknown) =>
  JSON.stringify(value).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);

/** Bit n set when set[n] is among the ids. */
const maskOf = (set: readonly Sticker[], ids: string[]) =>
  set.reduce((mask, s, i) => (ids.includes(s.id) ? mask | (1 << i) : mask), 0);
const idsOf = (set: readonly Sticker[], mask: number) => set.filter((_, i) => mask & (1 << i)).map((s) => s.id);

/** An edition's stickers as a bitmap of bytes (a season can hold more than 31 stickers). */
const bitmapOf = (set: readonly Sticker[], has: (id: string) => boolean) => {
  const bytes = new Uint8Array(Math.ceil(set.length / 8));
  set.forEach((s, i) => {
    if (has(s.id)) bytes[i >> 3] |= 1 << (i & 7);
  });
  return toBase64Url(bytes);
};

/** Reads an edition's bitmap; null when it is malformed (wrong length or bits past the last sticker). */
function idsOfBitmap(set: readonly Sticker[], text: string): string[] | null {
  let bytes: Uint8Array;
  try {
    bytes = fromBase64Url(text);
  } catch {
    return null;
  }
  if (bytes.length !== Math.ceil(set.length / 8)) return null;
  const ids: string[] = [];
  for (let i = 0; i < bytes.length * 8; i++) {
    if (!(bytes[i >> 3] & (1 << (i & 7)))) continue;
    if (i >= set.length) return null;
    ids.push(set[i].id);
  }
  return ids;
}

function encodeProfile(id: string, name: string, avatar: string, history: ProfileData, fromDay: number): WireProfile {
  const days = history.sessions.map((s) => dayNumber(s.date)).filter((d) => d >= fromDay);
  const first = days.length ? Math.min(...days) : 0;
  const last = days.length ? Math.max(...days) : -1;
  const bytes = new Uint8Array(Math.ceil((last - first + 1) / 4));
  for (const s of history.sessions) {
    const d = dayNumber(s.date);
    if (d < fromDay) continue;
    const bit = (d - first) * 2 + (s.slot === "evening" ? 1 : 0);
    bytes[bit >> 3] |= 1 << (bit & 7);
  }
  const wire: WireProfile = { i: id, n: name, a: Math.max(0, AVATARS.indexOf(avatar)), d: first, s: toBase64Url(bytes), k: maskOf(STICKERS, history.stickers) };
  const h = maskOf(HALLOWEEN_STICKERS, history.stickers.map((id) => (splitSticker(id).year === FIRST_EDITION_YEAR ? splitSticker(id).id : "")));
  if (h) wire.h = h;
  // Every other edition (the 2026 Halloween travels as `h`).
  const mine = history.stickers.map(splitSticker);
  for (const season of SEASONS) {
    const years = new Set(mine.filter((m) => m.year !== null && season.stickers.some((s) => s.id === m.id)).map((m) => m.year!));
    for (const y of years) {
      if (season.id === "halloween" && y === FIRST_EDITION_YEAR) continue;
      const bitmap = bitmapOf(season.stickers, (id) => history.stickers.includes(editionId(id, y)));
      (wire.e ??= {})[`${season.code}${y}`] = bitmap;
    }
  }
  return wire;
}

/** This phone's state as the text to put in the QR code. */
export function encodeState(data: ProgressData, now = new Date()): string {
  const fromDay = dayNumber(toDay(now)) - SYNC_WINDOW_DAYS;
  const wire: WireState = {
    v: 1,
    p: data.profiles.map((p) => encodeProfile(p.id, p.name, p.avatar, data.data[p.id] ?? { sessions: [], stickers: [] }, fromDay)),
  };
  return SYNC_PREFIX + asciiJson(wire);
}

/** `ok` with the profiles, or not `ok` with a message for the parent (no union: the project is not in strict mode). */
export interface DecodeResult {
  ok: boolean;
  profiles: RemoteProfile[];
  error: string;
}

const INVALID: DecodeResult = { ok: false, profiles: [], error: "Ce code ne vient pas de Quenottes, ou il est abîmé." };

/** The stickers of every edition in `e`, as stored ids; null if any entry is unknown or malformed. */
function readEditions(e: WireProfile["e"]): string[] | null {
  const stored: string[] = [];
  for (const [key, bitmap] of Object.entries(e ?? {})) {
    const match = /^([a-z])(20\d\d)$/.exec(key);
    const season = match && SEASONS.find((s) => s.code === match[1]);
    if (!season || typeof bitmap !== "string" || !/^[\w-]{1,40}$/.test(bitmap)) return null;
    const ids = idsOfBitmap(season.stickers, bitmap);
    if (!ids) return null;
    stored.push(...ids.map((id) => editionId(id, Number(match![2]))));
  }
  return stored;
}

/** Strict reading of a scanned code: anything unexpected is refused. */
export function decodeState(text: string): DecodeResult {
  if (!text?.startsWith(SYNC_PREFIX) || text.length > 4000) return INVALID;
  let wire: WireState;
  try {
    wire = JSON.parse(text.slice(SYNC_PREFIX.length));
  } catch {
    return INVALID;
  }
  if (wire?.v !== 1 || !Array.isArray(wire.p) || wire.p.length < 1 || wire.p.length > MAX_PROFILES) return INVALID;

  const profiles: RemoteProfile[] = [];
  for (const w of wire.p) {
    const valid =
      typeof w?.i === "string" && /^[\w-]{1,40}$/.test(w.i) &&
      typeof w.n === "string" && w.n.length <= 20 &&
      Number.isInteger(w.a) && w.a >= 0 && w.a < AVATARS.length &&
      Number.isInteger(w.d) && w.d >= 0 &&
      typeof w.s === "string" && /^[\w-]{0,1000}$/.test(w.s) &&
      Number.isInteger(w.k) && w.k >= 0 && w.k < 2 ** STICKERS.length &&
      (w.h === undefined || (Number.isInteger(w.h) && w.h >= 0 && w.h < 2 ** HALLOWEEN_STICKERS.length)) &&
      (w.e === undefined || (typeof w.e === "object" && w.e !== null && !Array.isArray(w.e) && Object.keys(w.e).length <= 12));
    if (!valid) return INVALID;
    const editions = readEditions(w.e);
    if (!editions) return INVALID;

    const sessions: Session[] = [];
    let bytes: Uint8Array;
    try {
      bytes = fromBase64Url(w.s);
    } catch {
      return INVALID;
    }
    bytes.forEach((byte, i) => {
      for (let b = 0; b < 8; b++) {
        if (byte & (1 << b)) {
          const bit = i * 8 + b;
          sessions.push({ date: dayString(w.d + (bit >> 1)), slot: bit & 1 ? "evening" : "morning" });
        }
      }
    });
    const stickers = [
      ...idsOf(STICKERS, w.k),
      ...idsOf(HALLOWEEN_STICKERS, w.h ?? 0).map((id) => editionId(id, FIRST_EDITION_YEAR)),
      ...editions,
    ];
    profiles.push({ id: w.i, name: w.n, avatar: AVATARS[w.a], sessions, stickers });
  }
  return { ok: true, profiles, error: "" };
}

// ---------------------------------------------------------------------------
// Matching and merging
// ---------------------------------------------------------------------------

/** "  Léa " and "lea" are the same child. */
export const normalizeName = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().replace(/\s+/g, " ").toLowerCase();

/** For each remote child: the local child it is, or "add" (new on this phone), or "ignore". */
export type MatchTarget = { kind: "local"; id: string } | { kind: "add" } | { kind: "ignore" };
export interface Match {
  remote: RemoteProfile;
  target: MatchTarget;
}

/**
 * Default matching, in two passes so a weak guess never steals a better match:
 * 1. same id (already synced before) — only if the names agree or the local profile has no
 *    name (ids used to be shared by every install: "default"), then same name;
 * 2. for the rest: take over an empty, unnamed local profile (a fresh install's "Moi"),
 *    else add if there is room, else ignore.
 */
export function suggestMatches(local: ProgressData, remote: RemoteProfile[]): Match[] {
  const taken = new Set<string>();
  const targets = new Map<string, MatchTarget>();
  const sameName = (a: string, b: string) => normalizeName(a) === normalizeName(b);
  const isEmpty = (id: string) => !local.data[id]?.sessions.length && !local.data[id]?.stickers.length;

  for (const r of remote) {
    const byId = local.profiles.find((p) => p.id === r.id && (!p.name || !r.name || sameName(p.name, r.name)));
    if (byId) {
      taken.add(byId.id);
      targets.set(r.id, { kind: "local", id: byId.id });
    }
  }
  for (const r of remote) {
    if (targets.has(r.id) || !r.name) continue;
    const byName = local.profiles.find((p) => !taken.has(p.id) && p.name && sameName(p.name, r.name));
    if (byName) {
      taken.add(byName.id);
      targets.set(r.id, { kind: "local", id: byName.id });
    }
  }
  let room = MAX_PROFILES - local.profiles.length;
  for (const r of remote) {
    if (targets.has(r.id)) continue;
    const placeholder = local.profiles.find((p) => !taken.has(p.id) && !p.name && isEmpty(p.id));
    if (placeholder) {
      taken.add(placeholder.id);
      targets.set(r.id, { kind: "local", id: placeholder.id });
    } else if (room > 0) {
      room--;
      targets.set(r.id, { kind: "add" });
    } else {
      targets.set(r.id, { kind: "ignore" });
    }
  }
  return remote.map((r) => ({ remote: r, target: targets.get(r.id)! }));
}

export interface MergeSummaryItem {
  id: string;
  name: string;
  avatar: string;
  isNew: boolean;
  addedSessions: number;
  addedStickers: number;
}

const sessionKey = (s: Session) => `${s.date}|${s.slot}`;

/** Union merge (never removes anything). Returns a new state; `local` is not modified. */
export function mergeState(local: ProgressData, matches: Match[]): { data: ProgressData; summary: MergeSummaryItem[] } {
  const data: ProgressData = structuredClone(local);
  const summary: MergeSummaryItem[] = [];
  const renames: Record<string, string> = {}; // local id → converged id

  for (const { remote, target } of matches) {
    if (target.kind === "ignore") continue;

    if (target.kind === "add") {
      if (data.profiles.length >= MAX_PROFILES) continue;
      // Keep the other phone's id (so the next sync matches by id) unless it is already used here.
      const id = remote.id === DEFAULT_PROFILE || data.profiles.some((p) => p.id === remote.id) ? newProfileId() : remote.id;
      data.profiles.push({ id, name: remote.name, avatar: remote.avatar });
      data.data[id] = unionHistory({ sessions: [], stickers: [] }, remote);
      summary.push({ id, name: remote.name, avatar: remote.avatar, isNew: true, addedSessions: remote.sessions.length, addedStickers: remote.stickers.length });
      continue;
    }

    // Same child: both phones converge on the smaller id — but never onto an id another local
    // child already uses (that would make two children share one album), nor onto the legacy
    // shared "default".
    const smaller = target.id < remote.id ? target.id : remote.id;
    const usedElsewhere = data.profiles.some((p) => p.id === smaller && p.id !== target.id);
    const finalId = smaller === DEFAULT_PROFILE || usedElsewhere ? target.id : smaller;
    if (finalId !== target.id) {
      renames[target.id] = finalId;
      data.profiles = data.profiles.map((p) => (p.id === target.id ? { ...p, id: finalId } : p));
      data.data[finalId] = data.data[target.id] ?? { sessions: [], stickers: [] };
      delete data.data[target.id];
      data.active = data.active.map((id) => (id === target.id ? finalId : id));
    }
    const mine = data.data[finalId] ?? { sessions: [], stickers: [] };
    const merged = unionHistory(mine, remote);
    data.data[finalId] = merged;
    const newSessions = merged.sessions.length - mine.sessions.length;
    const newStickers = merged.stickers.length - mine.stickers.length;
    // A profile with no name here (a fresh install's "Moi") takes the child's name and avatar.
    const meta = data.profiles.find((p) => p.id === finalId)!;
    // Taking over an empty, unnamed profile = the child is new on this phone.
    const isNew = !meta.name && !mine.sessions.length && !mine.stickers.length;
    if (!meta.name && remote.name) {
      meta.name = remote.name;
      meta.avatar = remote.avatar;
    }
    summary.push({ id: finalId, name: meta.name, avatar: meta.avatar, isNew, addedSessions: newSessions, addedStickers: newStickers });
  }

  // Safety net: a sync may only ever add. Refuse rather than save a smaller album or history.
  const losses = findLosses(local, data, renames);
  if (losses.length) throw new SyncLossError(losses);
  return { data, summary };
}

export class SyncLossError extends Error {
  constructor(readonly losses: string[]) {
    super("Synchronisation annulée : elle aurait retiré des autocollants ou des brossages. Rien n'a été modifié.");
  }
}

/** What `after` would lose compared with `before` (empty = safe). `renames` maps ids changed by the merge. */
export function findLosses(before: ProgressData, after: ProgressData, renames: Record<string, string> = {}): string[] {
  const losses: string[] = [];
  const ids = after.profiles.map((p) => p.id);
  if (new Set(ids).size !== ids.length) losses.push("deux profils partageraient le même album");
  for (const p of before.profiles) {
    const was = before.data[p.id] ?? { sessions: [], stickers: [] };
    const now = after.data[renames[p.id] ?? p.id];
    if (!now) {
      if (was.sessions.length || was.stickers.length) losses.push(`${p.name || p.id}: profil disparu`);
      continue;
    }
    for (const k of was.stickers) if (!now.stickers.includes(k)) losses.push(`${p.name || p.id}: autocollant ${k}`);
    const kept = new Set(now.sessions.map(sessionKey));
    for (const s of was.sessions)
      if (!kept.has(sessionKey(s))) losses.push(`${p.name || p.id}: brossage ${s.date} ${s.slot === "morning" ? "matin" : "soir"}`);
  }
  return losses;
}

// ---------------------------------------------------------------------------
// Repair: two profiles that are probably the same child
// ---------------------------------------------------------------------------

export interface SameChildSuggestion {
  /** The profile to fold into one of the candidates. */
  other: ProfileMeta;
  /** Who it probably is (one for a same-name pair, every named child for an unnamed one). */
  candidates: ProfileMeta[];
  reason: "same-name" | "unnamed-with-data";
}

const DISMISSED_KEY = "brosse-brille:same-child-dismissed";

function readDismissed(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** "Non, ce sont deux enfants": never suggest this profile again. */
export function dismissSameChild(otherId: string) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...new Set([...readDismissed(), otherId])]));
  } catch {
    // Storage unavailable: the suggestion just comes back next time.
  }
}

/**
 * Profiles left by the old sync bug: the same first name twice, or an unnamed "Moi" holding a
 * child's stickers/brushings next to named children. Merging them (`mergeProfiles`) loses nothing.
 */
export function suggestSameChild(data: ProgressData, dismissed: string[] = readDismissed()): SameChildSuggestion[] {
  const suggestions: SameChildSuggestion[] = [];
  const named = data.profiles.filter((p) => p.name);
  const firstByName = new Map<string, ProfileMeta>();
  for (const p of named) {
    const key = normalizeName(p.name);
    const first = firstByName.get(key);
    if (!first) firstByName.set(key, p);
    else if (!dismissed.includes(p.id)) suggestions.push({ other: p, candidates: [first], reason: "same-name" });
  }
  for (const p of data.profiles) {
    const history = data.data[p.id];
    const hasData = !!history && (history.sessions.length > 0 || history.stickers.length > 0);
    if (!p.name && hasData && named.length && !dismissed.includes(p.id)) {
      suggestions.push({ other: p, candidates: named, reason: "unnamed-with-data" });
    }
  }
  return suggestions;
}
