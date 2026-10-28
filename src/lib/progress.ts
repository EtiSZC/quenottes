// Brushing history, streak and stickers per child profile — stored on the device
// only (no account, nothing sent anywhere). Up to 4 profiles (first name/nickname
// + animal avatar); one or several can be "active" (brushing together).

export type Slot = "morning" | "evening";

export interface Session {
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  slot: Slot;
}

export interface ProfileData {
  sessions: Session[];
  /** Sticker ids in the order they were earned. */
  stickers: string[];
}

export interface ProfileMeta {
  id: string;
  /** First name or nickname; may be empty (e.g. the profile migrated from v1). */
  name: string;
  avatar: string;
}

export interface ProgressData {
  version: 2;
  profiles: ProfileMeta[];
  data: Record<string, ProfileData>;
  /** Profiles brushing right now (several = brushing together). */
  active: string[];
}

/** v1 (single child) — read once for migration, never deleted (restore point v0.5 still finds it). */
interface ProgressDataV1 {
  version: 1;
  profiles: Record<string, ProfileData>;
}

const STORAGE_KEY = "brosse-brille:progress:v2";
const LEGACY_KEY_V1 = "brosse-brille:progress:v1";
export const DEFAULT_PROFILE = "default";
export const MAX_PROFILES = 4;
export const AVATARS = ["🦊", "🐼", "🐯", "🐰", "🐸", "🐨", "🦁", "🐧"];

/** The collection: one random not-yet-earned sticker per new morning/evening slot. Never germ-themed. */
export const STICKERS = [
  { id: "unicorn", emoji: "🦄", name: "Licorne" },
  { id: "rocket", emoji: "🚀", name: "Fusée" },
  { id: "rainbow", emoji: "🌈", name: "Arc-en-ciel" },
  { id: "whale", emoji: "🐳", name: "Baleine" },
  { id: "dino", emoji: "🦖", name: "Dino" },
  { id: "strawberry", emoji: "🍓", name: "Fraise" },
  { id: "octopus", emoji: "🐙", name: "Pieuvre" },
  { id: "butterfly", emoji: "🦋", name: "Papillon" },
  { id: "balloon", emoji: "🎈", name: "Ballon" },
  { id: "turtle", emoji: "🐢", name: "Tortue" },
  { id: "sunflower", emoji: "🌻", name: "Tournesol" },
  { id: "bee", emoji: "🐝", name: "Abeille" },
  { id: "lion", emoji: "🦁", name: "Lion" },
  { id: "icecream", emoji: "🍦", name: "Glace" },
  { id: "palette", emoji: "🎨", name: "Palette" },
  { id: "penguin", emoji: "🐧", name: "Pingouin" },
  { id: "fox", emoji: "🦊", name: "Renard" },
  { id: "planet", emoji: "🪐", name: "Planète" },
  { id: "dolphin", emoji: "🐬", name: "Dauphin" },
  { id: "trophy", emoji: "🏆", name: "Trophée" },
] as const;

/**
 * Halloween batch: can only be won during the Halloween season (`isHalloweenSeason`),
 * every year; once won, a sticker stays in the album forever. No sweets (tooth-brushing app).
 */
export const HALLOWEEN_STICKERS = [
  { id: "pumpkin", emoji: "🎃", name: "Citrouille" },
  { id: "ghost", emoji: "👻", name: "Fantôme" },
  { id: "bat", emoji: "🦇", name: "Chauve-souris" },
  { id: "witch", emoji: "🧙", name: "Sorcière" },
  { id: "broom", emoji: "🧹", name: "Balai magique" },
  { id: "blackcat", emoji: "🐈‍⬛", name: "Chat noir" },
  { id: "owl", emoji: "🦉", name: "Hibou" },
  { id: "moon", emoji: "🌕", name: "Pleine lune" },
  { id: "crystal", emoji: "🔮", name: "Boule de cristal" },
  { id: "web", emoji: "🕸️", name: "Toile d'araignée" },
  { id: "vampire", emoji: "🧛", name: "Vampire" },
  { id: "wand", emoji: "🪄", name: "Baguette magique" },
  { id: "skull", emoji: "💀", name: "Crâne" },
  { id: "zombie", emoji: "🧟", name: "Zombie" },
  { id: "spider", emoji: "🕷️", name: "Araignée" },
] as const;

/**
 * « Automne en forêt »: 28 autumn + 28 forest stickers, interleaved. It lasts 3-30 November,
 * i.e. 56 brushings at two a day, so a child brushing morning and evening never runs dry.
 */
export const AUTUMN_STICKERS = [
  { id: "leaf", emoji: "🍂", name: "Feuille morte" },
  { id: "pine", emoji: "🌲", name: "Sapin" },
  { id: "maple", emoji: "🍁", name: "Feuille d'érable" },
  { id: "tree", emoji: "🌳", name: "Arbre" },
  { id: "chestnut", emoji: "🌰", name: "Châtaigne" },
  { id: "deer", emoji: "🦌", name: "Cerf" },
  { id: "mushroom", emoji: "🍄", name: "Champignon" },
  { id: "bear", emoji: "🐻", name: "Ours" },
  { id: "squirrel", emoji: "🐿️", name: "Écureuil" },
  { id: "boar", emoji: "🐗", name: "Sanglier" },
  { id: "hedgehog", emoji: "🦔", name: "Hérisson" },
  { id: "rabbit", emoji: "🐇", name: "Lapin" },
  { id: "apple", emoji: "🍎", name: "Pomme" },
  { id: "beaver", emoji: "🦫", name: "Castor" },
  { id: "pear", emoji: "🍐", name: "Poire" },
  { id: "skunk", emoji: "🦨", name: "Mouffette" },
  { id: "grapes", emoji: "🍇", name: "Raisin" },
  { id: "snail", emoji: "🐌", name: "Escargot" },
  { id: "umbrella", emoji: "☔", name: "Parapluie" },
  { id: "ladybug", emoji: "🐞", name: "Coccinelle" },
  { id: "rain", emoji: "🌧️", name: "Pluie" },
  { id: "badger", emoji: "🦡", name: "Blaireau" },
  { id: "scarf", emoji: "🧣", name: "Écharpe" },
  { id: "camp", emoji: "🏕️", name: "Camp" },
  { id: "boots", emoji: "🥾", name: "Bottes" },
  { id: "fern", emoji: "🌿", name: "Fougère" },
  { id: "kite", emoji: "🪁", name: "Cerf-volant" },
  { id: "eagle", emoji: "🦅", name: "Aigle" },
  { id: "basket", emoji: "🧺", name: "Panier" },
  { id: "campfire", emoji: "🔥", name: "Feu de camp" },
  { id: "mittens", emoji: "🧤", name: "Moufles" },
  { id: "caterpillar", emoji: "🐛", name: "Chenille" },
  { id: "coat", emoji: "🧥", name: "Manteau" },
  { id: "ant", emoji: "🐜", name: "Fourmi" },
  { id: "wind", emoji: "🌬️", name: "Vent" },
  { id: "lizard", emoji: "🦎", name: "Lézard" },
  { id: "cloud", emoji: "☁️", name: "Nuage" },
  { id: "frog", emoji: "🐸", name: "Grenouille" },
  { id: "wheat", emoji: "🌾", name: "Blé" },
  { id: "cricket", emoji: "🦗", name: "Grillon" },
  { id: "corn", emoji: "🌽", name: "Maïs" },
  { id: "bird", emoji: "🐦", name: "Oiseau" },
  { id: "carrot", emoji: "🥕", name: "Carotte" },
  { id: "wolf", emoji: "🐺", name: "Loup" },
  { id: "duck", emoji: "🦆", name: "Canard" },
  { id: "compass", emoji: "🧭", name: "Boussole" },
  { id: "swan", emoji: "🦢", name: "Cygne" },
  { id: "map", emoji: "🗺️", name: "Carte" },
  { id: "peacock", emoji: "🦚", name: "Paon" },
  { id: "torch", emoji: "🔦", name: "Lampe torche" },
  { id: "yarn", emoji: "🧶", name: "Pelote de laine" },
  { id: "backpack", emoji: "🎒", name: "Sac à dos" },
  { id: "sunset", emoji: "🌅", name: "Coucher de soleil" },
  { id: "sprout", emoji: "🌱", name: "Pousse" },
  { id: "house", emoji: "🏡", name: "Maison" },
  { id: "leaves", emoji: "🍃", name: "Feuilles au vent" },
] as const;

export const ALL_STICKERS = [...STICKERS, ...HALLOWEEN_STICKERS, ...AUTUMN_STICKERS] as const;
export type Sticker = (typeof ALL_STICKERS)[number];

/** Halloween season: 15 October → 2 November (local date), every year. */
export function isHalloweenSeason(now = new Date()): boolean {
  const m = now.getMonth(), d = now.getDate();
  return (m === 9 && d >= 15) || (m === 10 && d <= 2);
}

/** « Automne en forêt » season: 3 → 30 November (local date), every year. */
export function isAutumnSeason(now = new Date()): boolean {
  return now.getMonth() === 10 && now.getDate() >= 3;
}

// ---------------------------------------------------------------------------
// Seasonal editions: every year a season starts again with an empty grid
// ---------------------------------------------------------------------------

export type SeasonId = "halloween" | "autumn";

export interface Season {
  id: SeasonId;
  /** One letter in the sync code. */
  code: "h" | "a";
  title: string;
  stickers: readonly Sticker[];
  /** Month (0-based) and French name of its start, for « revient en octobre 2027 ». */
  startMonth: number;
  monthName: string;
  inSeason: (now: Date) => boolean;
}

export const SEASONS: readonly Season[] = [
  { id: "halloween", code: "h", title: "Halloween", stickers: HALLOWEEN_STICKERS, startMonth: 9, monthName: "octobre", inSeason: isHalloweenSeason },
  { id: "autumn", code: "a", title: "Automne en forêt", stickers: AUTUMN_STICKERS, startMonth: 10, monthName: "novembre", inSeason: isAutumnSeason },
];

/** Halloween stickers were stored without a year until the first edition (2026) had ended. */
export const FIRST_EDITION_YEAR = 2026;

/** A seasonal sticker is stored with its year (« pumpkin@2026 »); classics keep their bare id. */
export const editionId = (stickerId: string, year: number) => `${stickerId}@${year}`;

export function splitSticker(stored: string): { id: string; year: number | null } {
  const at = stored.indexOf("@");
  const year = at < 0 ? NaN : Number(stored.slice(at + 1));
  return at > 0 && Number.isInteger(year) ? { id: stored.slice(0, at), year } : { id: stored, year: null };
}

export const seasonOfSticker = (id: string): Season | undefined => SEASONS.find((s) => s.stickers.some((x) => x.id === id));

/** Halloween ids saved by v0.9-v0.11 (no year) are the 2026 edition. Keeps the order, drops duplicates. */
export function migrateStickerIds(ids: string[]): string[] {
  const halloween = new Set<string>(HALLOWEEN_STICKERS.map((s) => s.id));
  return [...new Set(ids.map((id) => (halloween.has(id) ? editionId(id, FIRST_EDITION_YEAR) : id)))];
}

/** A grid longer than this shows this many boxes at first, then one more row once they are all full. */
export const GRID_START = 20;
const GRID_ROW = 4;

/** Boxes shown for a grid of `size` stickers with `won` of them won. */
export function visibleCells(won: number, size: number): number {
  if (size <= GRID_START) return size;
  return won < GRID_START ? GRID_START : Math.min(size, GRID_ROW * (Math.floor(won / GRID_ROW) + 1));
}

/**
 * Where each won sticker sits in a long grid: the first 20 land in scattered boxes (a fixed shuffle
 * per `seed`, so the same child always sees the same picture), the next ones fill the added rows in
 * order. Returns one entry per box (`total`), holding the index in `won` or null for an empty box.
 */
export function placeInGrid(wonCount: number, total: number, seed: string): (number | null)[] {
  // Seeded shuffle of the first 20 boxes (FNV-1a hash → mulberry32).
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let a = h >>> 0;
  const random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const scatter = Array.from({ length: Math.min(GRID_START, total) }, (_, i) => i);
  for (let i = scatter.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [scatter[i], scatter[j]] = [scatter[j], scatter[i]];
  }
  const boxes: (number | null)[] = Array.from({ length: total }, () => null);
  for (let k = 0; k < Math.min(wonCount, total); k++) boxes[k < scatter.length ? scatter[k] : k] = k;
  return boxes;
}

export interface AlbumPage {
  key: string;
  /** null = the classics. */
  season: Season | null;
  year: number | null;
  /** « Halloween 2026 », « Automne en forêt 2026 », « Mes autocollants ». */
  title: string;
  stickers: readonly Sticker[];
  /** Base ids won in this edition. */
  earned: ReadonlySet<string>;
  /** The same ids in the order they were won: a long grid fills its boxes in that order. */
  earnedOrder: string[];
  /** A grid longer than 20 stickers (« Automne en forêt »): boxes follow the winning order, not the sticker. */
  slotted: boolean;
  won: number;
  /** Boxes shown (what counters divide by): every sticker, or 20 + a row each time they are all full. */
  total: number;
  /** How many stickers the edition holds. */
  size: number;
  complete: boolean;
  /** The grid being played now (open); every other page is folded at the bottom. */
  current: boolean;
  /** Line shown in the folded bar. */
  note: string;
}

/**
 * The album's pages for one child: the grid being played now first (the season's edition,
 * else the classics), then the folded ones — classics, then past or finished editions, newest
 * first. A season with nothing won this year stays hidden outside its dates.
 */
export function albumPages(stored: string[], now = new Date()): AlbumPage[] {
  const year = now.getFullYear();
  const mine = stored.map(splitSticker);
  const build = (season: Season | null, y: number | null): AlbumPage => {
    const stickers = season ? season.stickers : STICKERS;
    const earnedOrder = [...new Set(mine.filter((m) => m.year === y && stickers.some((s) => s.id === m.id)).map((m) => m.id))];
    const earned = new Set(earnedOrder);
    return {
      key: season ? `${season.id}-${y}` : "classic",
      season,
      year: y,
      title: season ? `${season.title} ${y}` : "Mes autocollants",
      stickers,
      earned,
      earnedOrder,
      slotted: stickers.length > GRID_START,
      won: earned.size,
      total: visibleCells(earned.size, stickers.length),
      size: stickers.length,
      complete: earned.size >= stickers.length,
      current: false,
      note: "",
    };
  };

  const classic = build(null, null);
  const editions: AlbumPage[] = [];
  for (const season of SEASONS) {
    const years = new Set<number>();
    for (const m of mine) if (m.year !== null && season.stickers.some((s) => s.id === m.id)) years.add(m.year);
    if (season.inSeason(now)) years.add(year);
    for (const y of years) editions.push(build(season, y));
  }
  editions.sort((a, b) => b.year! - a.year! || SEASONS.indexOf(a.season!) - SEASONS.indexOf(b.season!));

  const live = editions.find((e) => e.year === year && e.season!.inSeason(now) && !e.complete);
  if (live) live.current = true;
  else if (!classic.complete) classic.current = true;

  for (const page of [classic, ...editions]) {
    if (page.complete) page.note = "Tous gagnés\u00A0! 🎉";
    else if (!page.season) page.note = live ? `À reprendre quand « ${live.season!.title} » est terminé.` : "";
    else if (!page.current) {
      const next = now.getMonth() < page.season.startMonth ? year : year + 1;
      if (page.year === next - 1) page.note = `Une nouvelle grille revient en ${page.season.monthName} ${next}\u00A0!`;
    }
  }
  return [...[classic, ...editions].filter((p) => p.current), ...[classic, ...editions].filter((p) => !p.current)];
}

// ---------------------------------------------------------------------------
// Dates (local time)
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");
export const toDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const slotOf = (d: Date): Slot => (d.getHours() < 14 ? "morning" : "evening");

function addDays(d: Date, n: number): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() + n);
  return copy;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const emptyProfile = (): ProfileData => ({ sessions: [], stickers: [] });
const readJson = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null; // blocked or corrupted storage
  }
};

/** Random profile id, unique per install (never the legacy shared "default"). */
export const newProfileId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Keep the data usable whatever happened: ≥ 1 profile, unique ids (never the legacy
 * "default" id that every install used to share — it made the QR sync pair the wrong
 * profiles), valid active selection. Returns whether ids had to be repaired.
 */
function repair(data: ProgressData): boolean {
  let changed = false;
  if (!data.profiles.length) {
    data.profiles = [{ id: newProfileId(), name: "", avatar: AVATARS[0] }];
    changed = true;
  }
  const seen = new Set<string>();
  data.profiles = data.profiles.map((p) => {
    const duplicate = seen.has(p.id);
    if (p.id !== DEFAULT_PROFILE && !duplicate) {
      seen.add(p.id);
      return p;
    }
    // Legacy shared id, or two profiles sharing one id: give a fresh id. A duplicate gets
    // a copy of the shared history so no sticker or brushing is lost.
    const id = newProfileId();
    seen.add(id);
    data.data[id] = structuredClone(data.data[p.id] ?? emptyProfile());
    if (!duplicate) {
      delete data.data[p.id];
      data.active = data.active.map((a) => (a === p.id ? id : a));
    }
    changed = true;
    return { ...p, id };
  });
  data.active = data.active.filter((id) => seen.has(id));
  if (!data.active.length) data.active = [data.profiles[0].id];
  for (const history of Object.values(data.data)) {
    const migrated = migrateStickerIds(history.stickers);
    if (migrated.length !== history.stickers.length || migrated.some((id, i) => id !== history.stickers[i])) {
      history.stickers = migrated;
      changed = true;
    }
  }
  return changed;
}

function normalize(data: ProgressData): ProgressData {
  repair(data);
  return data;
}

export function loadProgress(): ProgressData {
  const v2 = readJson<ProgressData>(STORAGE_KEY);
  if (v2?.version === 2 && Array.isArray(v2.profiles) && v2.data) {
    // Repaired ids are saved at once, so every later read sees the same ids.
    if (repair(v2)) saveProgress(v2);
    return v2;
  }

  // First run of this version: migrate the single-child history if there is one
  // (the v1 key is left untouched, so the v0.5 app still finds it).
  const v1 = readJson<ProgressDataV1>(LEGACY_KEY_V1);
  const data: ProgressData = {
    version: 2,
    profiles: [{ id: DEFAULT_PROFILE, name: "", avatar: AVATARS[0] }],
    data: v1?.version === 1 && v1.profiles ? { ...v1.profiles } : {},
    active: [DEFAULT_PROFILE],
  };
  repair(data);
  saveProgress(data);
  return data;
}

function saveProgress(data: ProgressData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable (private mode / full): keep going without saving.
  }
}

/** Replace the whole state (used by phone-to-phone sync), repaired by `normalize()`. */
export function replaceProgress(data: ProgressData) {
  saveProgress(normalize(data));
}

/** History of one profile (the first active one by default). */
export function getProfile(profile?: string, data = loadProgress()): ProfileData {
  return data.data[profile ?? data.active[0]] ?? emptyProfile();
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export const listProfiles = (): ProfileMeta[] => loadProgress().profiles;

/** Name shown on screen ("Moi" for the unnamed profile migrated from v1). */
export const displayName = (p: ProfileMeta) => p.name || "Moi";

/** "Léa", "Léa et Tom", "Léa, Tom et Zoé" — empty when nobody has a name yet. */
export function joinNames(profiles: ProfileMeta[]): string {
  const names = profiles.map((p) => p.name).filter(Boolean);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

export function getActiveProfiles(): ProfileMeta[] {
  const data = loadProgress();
  return data.active.map((id) => data.profiles.find((p) => p.id === id)!);
}

export function setActiveProfiles(ids: string[]) {
  const data = loadProgress();
  data.active = ids;
  saveProgress(normalize(data));
}

/** Returns the new profile, or null when the maximum is reached. */
export function addProfile(name: string, avatar: string): ProfileMeta | null {
  const data = loadProgress();
  if (data.profiles.length >= MAX_PROFILES) return null;
  const profile = { id: newProfileId(), name: name.trim(), avatar };
  data.profiles.push(profile);
  data.data[profile.id] = emptyProfile();
  saveProgress(data);
  return profile;
}

export function updateProfile(id: string, patch: Partial<Pick<ProfileMeta, "name" | "avatar">>) {
  const data = loadProgress();
  const profile = data.profiles.find((p) => p.id === id);
  if (!profile) return;
  if (patch.name !== undefined) profile.name = patch.name.trim();
  if (patch.avatar !== undefined) profile.avatar = patch.avatar;
  saveProgress(data);
}

const sessionKey = (s: Session) => `${s.date}|${s.slot}`;

/** Union of two histories: each brushing once (sorted), every sticker of both, no duplicate. Never removes anything. */
export function unionHistory(a: ProfileData, b: ProfileData): ProfileData {
  const known = new Set(a.sessions.map(sessionKey));
  const sessions = [...a.sessions, ...b.sessions.filter((s) => !known.has(sessionKey(s)))].sort((x, y) =>
    sessionKey(x).localeCompare(sessionKey(y)),
  );
  return { sessions, stickers: [...new Set([...a.stickers, ...b.stickers])] }; // also drops any old duplicate
}

/**
 * Two profiles that are the same child (e.g. a "Moi" that received a child's stickers
 * through an old sync, plus the same child created by hand): everything goes into `keepId`,
 * then `removeId` is deleted. Returns false if either profile is missing.
 */
export function mergeProfiles(keepId: string, removeId: string): boolean {
  const data = loadProgress();
  if (keepId === removeId || !data.profiles.some((p) => p.id === keepId) || !data.profiles.some((p) => p.id === removeId)) return false;
  data.data[keepId] = unionHistory(data.data[keepId] ?? emptyProfile(), data.data[removeId] ?? emptyProfile());
  data.profiles = data.profiles.filter((p) => p.id !== removeId);
  delete data.data[removeId];
  data.active = [...new Set(data.active.map((id) => (id === removeId ? keepId : id)))];
  saveProgress(normalize(data));
  return true;
}

/** Deletes a profile and its history. The last remaining profile can't be deleted. */
export function deleteProfile(id: string): boolean {
  const data = loadProgress();
  if (data.profiles.length <= 1 || !data.profiles.some((p) => p.id === id)) return false;
  data.profiles = data.profiles.filter((p) => p.id !== id);
  delete data.data[id];
  saveProgress(normalize(data));
  return true;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export interface SessionResult {
  slot: Slot;
  /** Sticker earned by this session, or null if this slot was already filled (or the album is complete). */
  newSticker: Sticker | null;
  /** The season this sticker belongs to (shown with a label), null for a classic. */
  season?: SeasonId | null;
  streak: number;
}

/**
 * Record a completed 3-minute session. Brushing twice in the same slot counts once.
 * The sticker is drawn at random among those not earned yet — in season, from this year's edition
 * of the running season first (Halloween, then « Automne en forêt »), then the classics; outside
 * a season, the classics only (`random` is injectable for tests).
 */
export function recordSession(now = new Date(), profile?: string, random = Math.random): SessionResult {
  const data = loadProgress();
  const id = profile ?? data.active[0];
  const p = getProfile(id, data);
  const session: Session = { date: toDay(now), slot: slotOf(now) };
  const alreadyFilled = p.sessions.some((s) => s.date === session.date && s.slot === session.slot);

  let newSticker: Sticker | null = null;
  let seasonId: SeasonId | null = null;
  if (!alreadyFilled) {
    p.sessions.push(session);
    const year = now.getFullYear();
    const season = SEASONS.find((s) => s.inSeason(now));
    const seasonal = season ? season.stickers.filter((s) => !p.stickers.includes(editionId(s.id, year))) : [];
    const pool: readonly Sticker[] = seasonal.length ? seasonal : STICKERS.filter((s) => !p.stickers.includes(s.id));
    newSticker = pool.length ? pool[Math.floor(random() * pool.length)] : null;
    if (newSticker) {
      seasonId = seasonal.length ? season!.id : null;
      p.stickers.push(seasonal.length ? editionId(newSticker.id, year) : newSticker.id);
    }
  }
  data.data[id] = p;
  saveProgress(data);
  return { slot: session.slot, newSticker, season: seasonId, streak: streakOf(p.sessions, now) };
}

export interface ProfileSessionResult extends SessionResult {
  profile: ProfileMeta;
}

/** Brushing together: one session counts for each child, each with their own sticker draw. */
export function recordSessions(ids?: string[], now = new Date(), random = Math.random): ProfileSessionResult[] {
  const data = loadProgress();
  const targets = (ids ?? data.active).filter((id) => data.profiles.some((p) => p.id === id));
  return targets.map((id) => ({
    ...recordSession(now, id, random),
    profile: data.profiles.find((p) => p.id === id)!,
  }));
}

/**
 * Forgiving streak: consecutive days with at least one session (one slot is
 * enough). Today not brushed yet doesn't break it — counting starts yesterday.
 */
export function streakOf(sessions: Session[], now = new Date()): number {
  const days = new Set(sessions.map((s) => s.date));
  let cursor = days.has(toDay(now)) ? new Date(now) : addDays(now, -1);
  let streak = 0;
  while (days.has(toDay(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export interface WeekDay {
  date: string;
  /** Short French label: L, M, M, J, V, S, D. */
  label: string;
  isToday: boolean;
  isFuture: boolean;
  morning: boolean;
  evening: boolean;
}

const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

/** Current week, Monday → Sunday, with which slots were brushed. */
export function weekOf(sessions: Session[], now = new Date()): WeekDay[] {
  const mondayOffset = (now.getDay() + 6) % 7; // getDay: 0 = Sunday
  const monday = addDays(now, -mondayOffset);
  const today = toDay(now);
  return DAY_LABELS.map((label, i) => {
    const date = toDay(addDays(monday, i));
    return {
      date,
      label,
      isToday: date === today,
      isFuture: date > today,
      morning: sessions.some((s) => s.date === date && s.slot === "morning"),
      evening: sessions.some((s) => s.date === date && s.slot === "evening"),
    };
  });
}
