import { describe, it, expect } from "vitest";
import { BRUSHING_ZONES, TOTAL_DURATION, ZONE_STARTS, getPhaseAt, getZoneAt } from "./brushingZones";

describe("brushingZones", () => {
  it("has 8 steps lasting exactly 3 minutes, without the tongue", () => {
    expect(BRUSHING_ZONES).toHaveLength(8);
    expect(TOTAL_DURATION).toBe(180);
    expect(BRUSHING_ZONES.some((z) => z.region.includes("tongue"))).toBe(false);
  });

  it("follows outside → inside → back teeth left → right, upper then lower", () => {
    expect(BRUSHING_ZONES.map((z) => z.region)).toEqual([
      "upper-front", "upper-back", "upper-left", "upper-right",
      "lower-front", "lower-back", "lower-left", "lower-right",
    ]);
  });

  it("makes each back-teeth step cheek side first, then the inside, then the top", () => {
    const molarSteps = BRUSHING_ZONES.filter((z) => /left|right/.test(z.region));
    expect(molarSteps).toHaveLength(4);
    for (const z of molarSteps) {
      expect(z.phases.map((p) => p.view)).toEqual(["side", "side-inside", "top"]);
      expect(z.durationSeconds).toBe(27);
    }
  });

  it("gives the inside of the front teeth 14 seconds in « Derrière »", () => {
    const behind = BRUSHING_ZONES.filter((z) => /back$/.test(z.region));
    expect(behind.map((z) => z.durationSeconds)).toEqual([14, 14]);
    expect(behind.every((z) => z.phases.length === 1 && z.phases[0].view === "inside")).toBe(true);
  });

  it("computes zone start times", () => {
    expect(ZONE_STARTS.slice(0, 4)).toEqual([0, 22, 36, 63]);
    expect(ZONE_STARTS[7]).toBe(180 - 27);
  });

  it("finds the zone for a given second, including boundaries", () => {
    expect(getZoneAt(0)).toEqual({ index: 0, zoneElapsed: 0 });
    expect(getZoneAt(21)).toEqual({ index: 0, zoneElapsed: 21 });
    expect(getZoneAt(22)).toEqual({ index: 1, zoneElapsed: 0 });
    expect(getZoneAt(170)).toEqual({ index: 7, zoneElapsed: 17 });
  });

  it("clamps after the end and before the start", () => {
    expect(getZoneAt(999)).toEqual({ index: 7, zoneElapsed: 27 });
    expect(getZoneAt(-5)).toEqual({ index: 0, zoneElapsed: 0 });
  });

  it("finds the phase inside a step", () => {
    expect(getPhaseAt(2, 8.5)).toEqual({ phaseIndex: 0, phaseElapsed: 8.5 });
    expect(getPhaseAt(2, 9)).toEqual({ phaseIndex: 1, phaseElapsed: 0 });
    expect(getPhaseAt(2, 18)).toEqual({ phaseIndex: 2, phaseElapsed: 0 });
    expect(getPhaseAt(2, 27)).toEqual({ phaseIndex: 2, phaseElapsed: 9 });
    expect(getPhaseAt(0, 5)).toEqual({ phaseIndex: 0, phaseElapsed: 5 });
  });
});
