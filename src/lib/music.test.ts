import { describe, it, expect } from "vitest";
import { APP_SCORE, BAR, MUSIC_DUCKED, MUSIC_LEVEL, scoreEvents } from "./music";

const dB = (gain: number) => 20 * Math.log10(gain);
// Measured once (see music.ts): voice ≈ -20.7 dBFS, score at gain 0.55 ≈ -26 dBFS.
const VOICE_DBFS = -20.7;
const musicDbfs = (gain: number) => -26 + dB(gain / 0.55);

describe("music mode", () => {
  it("stays well under Quenottes's voice: ≥ 12 dB normally, ≥ 20 dB while he speaks", () => {
    expect(VOICE_DBFS - musicDbfs(MUSIC_LEVEL)).toBeGreaterThanOrEqual(12);
    expect(VOICE_DBFS - musicDbfs(MUSIC_DUCKED)).toBeGreaterThanOrEqual(20);
  });

  it("plays a flourish at every step change, and none at 0:00", () => {
    const flourishAt = (t: number) => scoreEvents(t, t + 0.3, APP_SCORE).filter((e) => e.instrument === "mallet" && e.notes[0] >= 84);
    expect(flourishAt(0)).toHaveLength(0);
    for (const s of APP_SCORE.stepStarts.slice(1)) expect(flourishAt(s).length).toBeGreaterThanOrEqual(4);
  });

  it("moves to F major with a shaker for the lower teeth", () => {
    const upper = scoreEvents(10, 20, APP_SCORE);
    const lower = scoreEvents(100, 110, APP_SCORE);
    expect(upper.some((e) => e.instrument === "shaker")).toBe(false);
    expect(lower.some((e) => e.instrument === "shaker")).toBe(true);
    const bass = (evs: typeof upper) => evs.filter((e) => e.instrument === "bass").map((e) => e.notes[0] % 12);
    expect(bass(lower).some((n) => n === 10)).toBe(true); // B♭ only exists in F major's chords here
    expect(bass(upper).some((n) => n === 10)).toBe(false);
  });

  it("ends with the finale in the last bar and nothing after 3:00", () => {
    expect(scoreEvents(APP_SCORE.total - BAR, APP_SCORE.total, APP_SCORE).length).toBeGreaterThan(5);
    expect(scoreEvents(APP_SCORE.total, APP_SCORE.total + 5, APP_SCORE)).toHaveLength(0);
  });

  it("is deterministic (same time → same notes), so resuming after a pause stays in sync", () => {
    expect(scoreEvents(42, 47, APP_SCORE)).toEqual(scoreEvents(42, 47, APP_SCORE));
  });
});
