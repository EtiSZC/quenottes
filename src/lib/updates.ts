// « A newer version exists » notice for parents (Parents area, small dot on Home), no push notification.
// - Web / PWA: when a new service worker takes control of a page that already had one, the page runs old code
//   → « Nouvelle version disponible » + reload. No network call of its own.
// - Android app: at most once a day, when the Parents area opens, read `version.json` published with the site
//   (`{ version, url }`) and compare it with this app's version. One request to github.io, no personal data;
//   the « Mises à jour » switch turns it off (then nothing is requested at all). Cut in a Play Store build.
import { Capacitor } from "@capacitor/core";

/** From package.json at build time (vite.config.ts). */
export const APP_VERSION = __APP_VERSION__;
/** What the Parents page shows at the bottom: « v0.15 ». */
export const versionLabel = (version = APP_VERSION) => `v${version.replace(/\.0$/, "")}`;

const VERSION_URL = import.meta.env.VITE_VERSION_URL ?? "https://etiszc.github.io/quenottes/version.json";
const RELEASES_PREFIX = "https://github.com/EtiSZC/quenottes/";
/** False in a Play Store build (VITE_DISABLE_UPDATE_CHECK=1): the store takes care of updates. */
export const UPDATE_CHECK_ALLOWED = import.meta.env.VITE_DISABLE_UPDATE_CHECK !== "1";

const SWITCH_KEY = "brosse-brille:updates";
const CACHE_KEY = "brosse-brille:update-check";

export interface UpdateInfo {
  version: string;
  url: string;
}
export interface UpdateState {
  /** The web app runs old code: a new version is already installed, a reload will use it. */
  web: boolean;
  /** The Android app: a newer version was announced by `version.json`. */
  apk: UpdateInfo | null;
}

function parseVersion(text: string): number[] | null {
  return /^\d+\.\d+(\.\d+)?$/.test(text) ? text.split(".").map(Number) : null;
}

/** Is `latest` strictly newer than `current`? Anything unreadable counts as not newer. */
export function isNewerVersion(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff) return diff > 0;
  }
  return false;
}

/** Does this build check for updates at all (Android app, not a Play Store build)? */
export const updateCheckAvailable = () => UPDATE_CHECK_ALLOWED && Capacitor.isNativePlatform();

export function updatesEnabled(): boolean {
  try {
    return localStorage.getItem(SWITCH_KEY) !== "0";
  } catch {
    return true;
  }
}

interface Cached extends UpdateInfo {
  /** Local day of the last successful check. */
  date: string;
}

function readCache(): Cached | null {
  try {
    const data = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
    return data && typeof data.date === "string" && typeof data.version === "string" && typeof data.url === "string" ? data : null;
  } catch {
    return null;
  }
}

/** Strict reading of version.json: a plain version and a link to our own releases, else nothing. */
function readInfo(data: unknown): UpdateInfo | null {
  const { version, url } = (data ?? {}) as Record<string, unknown>;
  if (typeof version !== "string" || !parseVersion(version)) return null;
  if (typeof url !== "string" || !url.startsWith(RELEASES_PREFIX)) return null;
  return { version, url };
}

const newer = (info: UpdateInfo | null) => (info && isNewerVersion(info.version, APP_VERSION) ? { version: info.version, url: info.url } : null);

const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ---------------------------------------------------------------------------
// Tiny store, so the Parents page and the Home dot agree
// ---------------------------------------------------------------------------

let state: UpdateState = { web: false, apk: updateCheckAvailable() && updatesEnabled() ? newer(readCache()) : null };
const listeners = new Set<() => void>();
const set = (next: Partial<UpdateState>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};
export const getUpdateState = () => state;
export function subscribeUpdates(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The « Mises à jour » switch. Off: nothing is requested and nothing is shown. */
export function setUpdatesEnabled(on: boolean) {
  try {
    localStorage.setItem(SWITCH_KEY, on ? "1" : "0");
  } catch {
    // Storage unavailable (private mode): the choice only lasts until the app closes.
  }
  set({ apk: on && updateCheckAvailable() ? newer(readCache()) : null });
}

interface CheckOptions {
  native?: boolean;
  fetchImpl?: typeof fetch;
  now?: Date;
}

/**
 * Android app: look for a newer version, at most once a day (a failed attempt is not counted, so the next
 * opening tries again). Nothing is requested when the switch is off, in a Play Store build, or on the web.
 */
export async function checkForUpdate({ native = Capacitor.isNativePlatform(), fetchImpl = fetch, now = new Date() }: CheckOptions = {}) {
  if (!UPDATE_CHECK_ALLOWED || !native || !updatesEnabled()) return;
  const cached = readCache();
  if (cached?.date === day(now)) {
    set({ apk: newer(cached) });
    return;
  }
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 6000);
  try {
    const res = await fetchImpl(VERSION_URL, { cache: "no-store", signal: abort.signal });
    if (!res.ok) return;
    const info = readInfo(await res.json());
    if (!info) return;
    localStorage.setItem(CACHE_KEY, JSON.stringify({ date: day(now), ...info }));
    set({ apk: newer(info) });
  } catch {
    // Offline, blocked, slow or garbled: stay quiet, try again at the next opening.
  } finally {
    clearTimeout(timer);
  }
}

/** Web / PWA: notice when a new service worker takes over a page that was already controlled by one. */
export function watchWebUpdate() {
  if (Capacitor.isNativePlatform() || !("serviceWorker" in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) set({ web: true });
  });
}
