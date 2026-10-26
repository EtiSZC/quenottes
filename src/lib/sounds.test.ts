import { describe, it, expect, vi, afterEach } from "vitest";
import { isMuted, setMuted, subscribeMuted, playFanfare, unlockAudio } from "./sounds";

describe("sounds mute setting", () => {
  it("persists to localStorage and notifies subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMuted(listener);

    setMuted(true);
    expect(isMuted()).toBe(true);
    expect(localStorage.getItem("brosse-brille:muted")).toBe("1");
    expect(listener).toHaveBeenCalledWith(true);

    unsubscribe();
    setMuted(false);
    expect(localStorage.getItem("brosse-brille:muted")).toBe("0");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not throw when Web Audio is unavailable (jsdom)", () => {
    expect(() => playFanfare()).not.toThrow();
  });

  it("asks iPhone Safari to play like a media app (silent switch doesn't mute)", () => {
    const audioSession = { type: "auto" };
    Object.defineProperty(navigator, "audioSession", { value: audioSession, configurable: true });
    unlockAudio();
    expect(audioSession.type).toBe("playback");
    delete (navigator as unknown as Record<string, unknown>).audioSession;
  });
});

/** A minimal Web Audio stand-in whose state we control, like Safari after idle time. */
class FakeContext {
  static all: FakeContext[] = [];
  state: string;
  currentTime = 0;
  destination = {};
  resume = vi.fn(() => {
    if (this.canResume) this.state = "running";
    return this.canResume ? Promise.resolve() : new Promise<void>(() => {}); // never settles
  });
  close = vi.fn(() => {
    this.state = "closed";
    return Promise.resolve();
  });
  createBuffer = () => ({});
  createBufferSource = () => ({ connect() {}, start() {}, stop() {}, buffer: null });
  constructor(initial = "running", private canResume = true) {
    this.state = initial;
    FakeContext.all.push(this);
  }
}

describe("audio context recovery", () => {
  // Each test gets a fresh copy of the module (it keeps the shared context in a variable).
  const install = async (first: () => FakeContext) => {
    vi.resetModules();
    FakeContext.all = [];
    vi.stubGlobal("AudioContext", function () {
      return FakeContext.all.length === 0 ? first() : new FakeContext("running");
    });
    Object.defineProperty(window, "AudioContext", { value: globalThis.AudioContext, configurable: true });
    return (await import("./sounds")).unlockAudio;
  };
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as unknown as Record<string, unknown>).AudioContext;
  });

  it("keeps a running context, and a tap on a suspended one resumes it", async () => {
    const unlockAudio = await install(() => new FakeContext("running"));
    unlockAudio();
    const first = FakeContext.all[0];
    unlockAudio();
    expect(FakeContext.all).toHaveLength(1);
    first.state = "suspended";
    document.dispatchEvent(new Event("pointerdown"));
    expect(first.state).toBe("running");
  });

  it("replaces a context that Safari left interrupted and never resumes, inside the tap", async () => {
    const unlockAudio = await install(() => new FakeContext("running", false));
    unlockAudio();
    const stuck = FakeContext.all[0];
    stuck.state = "interrupted"; // idle for a few minutes
    unlockAudio();
    expect(stuck.close).toHaveBeenCalled();
    expect(FakeContext.all).toHaveLength(2);
    expect(FakeContext.all[1].state).toBe("running");
  });

  it("wakes the context when the page becomes visible again", async () => {
    const unlockAudio = await install(() => new FakeContext("running"));
    unlockAudio();
    const c = FakeContext.all[0];
    c.state = "interrupted";
    document.dispatchEvent(new Event("visibilitychange"));
    expect(c.state).toBe("running");
  });
});
