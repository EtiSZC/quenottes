import { beforeEach, describe, expect, it, vi } from "vitest";

const RELEASES = "https://github.com/EtiSZC/quenottes/releases/latest";
const ok = (body: unknown) => vi.fn().mockResolvedValue({ ok: true, json: async () => body });

// The module keeps its state (what is known, the switch) between calls: load a fresh copy per test.
async function load() {
  vi.resetModules();
  return import("./updates");
}

describe("versions", () => {
  it("shows the version without a trailing .0, and compares numerically", async () => {
    const u = await load();
    expect(u.APP_VERSION).toBe("1.2.3"); // set by vitest.config.ts
    expect(u.versionLabel("0.15.0")).toBe("v0.15");
    expect(u.versionLabel("0.15.1")).toBe("v0.15.1");
    expect(u.isNewerVersion("1.3.0", "1.2.3")).toBe(true);
    expect(u.isNewerVersion("1.2.3", "1.2.3")).toBe(false);
    expect(u.isNewerVersion("1.2.2", "1.2.3")).toBe(false);
    expect(u.isNewerVersion("0.10", "0.9.0")).toBe(true); // 10 > 9, not a text comparison
    expect(u.isNewerVersion("1.3", "1.2.3")).toBe(true);
    expect(u.isNewerVersion("latest", "1.2.3")).toBe(false);
  });
});

describe("Android check (once a day, switch, Parents area)", () => {
  beforeEach(() => localStorage.clear());
  const day1 = new Date(2026, 11, 1, 9);

  it("announces a newer version, then asks only once a day", async () => {
    const u = await load();
    const fetchImpl = ok({ version: "1.3.0", url: RELEASES });
    await u.checkForUpdate({ native: true, fetchImpl, now: day1 });
    expect(u.getUpdateState().apk).toEqual({ version: "1.3.0", url: RELEASES });
    await u.checkForUpdate({ native: true, fetchImpl, now: new Date(2026, 11, 1, 20) }); // same day
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(u.getUpdateState().apk?.version).toBe("1.3.0"); // still known
    await u.checkForUpdate({ native: true, fetchImpl, now: new Date(2026, 11, 2, 9) }); // next day
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("says nothing when the app is up to date or ahead", async () => {
    const u = await load();
    await u.checkForUpdate({ native: true, fetchImpl: ok({ version: "1.2.3", url: RELEASES }), now: day1 });
    expect(u.getUpdateState().apk).toBeNull();
  });

  it("requests nothing on the web, nor when the switch is off", async () => {
    const u = await load();
    const fetchImpl = ok({ version: "1.3.0", url: RELEASES });
    await u.checkForUpdate({ native: false, fetchImpl, now: day1 });
    u.setUpdatesEnabled(false);
    await u.checkForUpdate({ native: true, fetchImpl, now: day1 });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(u.updatesEnabled()).toBe(false);
  });

  it("the switch hides a known update and shows it again without a new request", async () => {
    const u = await load();
    const fetchImpl = ok({ version: "1.3.0", url: RELEASES });
    await u.checkForUpdate({ native: true, fetchImpl, now: day1 });
    expect(u.getUpdateState().apk).not.toBeNull();
    u.setUpdatesEnabled(false);
    expect(u.getUpdateState().apk).toBeNull();
    u.setUpdatesEnabled(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("stays quiet when the network fails or the file is garbled, and tries again next time", async () => {
    const u = await load();
    await u.checkForUpdate({ native: true, fetchImpl: vi.fn().mockRejectedValue(new Error("offline")), now: day1 });
    await u.checkForUpdate({ native: true, fetchImpl: vi.fn().mockResolvedValue({ ok: false }), now: day1 });
    await u.checkForUpdate({ native: true, fetchImpl: ok({ version: "soon", url: RELEASES }), now: day1 });
    await u.checkForUpdate({ native: true, fetchImpl: ok({ version: "1.3.0", url: "https://example.com/apk" }), now: day1 }); // not our releases
    expect(u.getUpdateState().apk).toBeNull();
    const fetchImpl = ok({ version: "1.3.0", url: RELEASES });
    await u.checkForUpdate({ native: true, fetchImpl, now: day1 }); // a failure did not count as « checked today »
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(u.getUpdateState().apk?.version).toBe("1.3.0");
  });
});

describe("web update", () => {
  it("is noticed only when a new service worker takes over a page that already had one", async () => {
    const handlers: (() => void)[] = [];
    const sw = { controller: {}, addEventListener: (_: string, h: () => void) => handlers.push(h) };
    Object.defineProperty(navigator, "serviceWorker", { value: sw, configurable: true });
    const u = await load();
    u.watchWebUpdate();
    expect(u.getUpdateState().web).toBe(false);
    handlers.forEach((h) => h());
    expect(u.getUpdateState().web).toBe(true);

    // First visit ever (no controller yet): the worker claiming the page is not an update.
    sw.controller = null as unknown as object;
    handlers.length = 0;
    const fresh = await load();
    fresh.watchWebUpdate();
    handlers.forEach((h) => h());
    expect(fresh.getUpdateState().web).toBe(false);
    Reflect.deleteProperty(navigator, "serviceWorker");
  });
});
