import { describe, it, expect } from "vitest";
import {
  ARCH_TEETH,
  FULL_VIEWBOX,
  UPPER_TEETH,
  VIEW_H,
  VIEW_W,
  ZOOM,
  brushPlan,
  brushPosition,
  isSurfaceShiny,
  spotlightWindow,
  targetIndices,
  zoomViewBox,
} from "./geometry";

// Zone indices: 0 upper-front, 1 upper-back, 2 upper-left, 3 upper-right, 4.. lower.
const FRONT_TOP = { zoneIndex: 0, phaseIndex: 0 };
const INSIDE_TOP = { zoneIndex: 1, phaseIndex: 0 };
const LEFT_TOP_SIDE = { zoneIndex: 2, phaseIndex: 0 };
const LEFT_TOP_INSIDE = { zoneIndex: 2, phaseIndex: 1 };
const LEFT_TOP_CHEWING = { zoneIndex: 2, phaseIndex: 2 };
const RIGHT_TOP_SIDE = { zoneIndex: 3, phaseIndex: 0 };

describe("teeth", () => {
  it("draws 10 teeth per arch: 3 molars, 4 front, 3 molars", () => {
    expect(UPPER_TEETH.map((t) => t.side)).toEqual([
      "left", "left", "left", "front", "front", "front", "front", "right", "right", "right",
    ]);
    expect(UPPER_TEETH.filter((t) => t.molar)).toHaveLength(6);
    expect(ARCH_TEETH).toHaveLength(10);
  });

  it("follows the mirror convention: left molars are on the left of the screen", () => {
    expect(UPPER_TEETH[2].cx).toBeLessThan(UPPER_TEETH[7].cx);
    expect(ARCH_TEETH[0].cx).toBeLessThan(ARCH_TEETH[9].cx);
  });
});

describe("targets and spotlight", () => {
  it("targets the right teeth for each step (molars back to front)", () => {
    expect(targetIndices(FRONT_TOP)).toEqual([3, 4, 5, 6]);
    expect(targetIndices(INSIDE_TOP)).toEqual([3, 4, 5, 6]); // « Derrière »: the four front teeth only
    expect(targetIndices(LEFT_TOP_SIDE)).toEqual([0, 1, 2]);
    expect(targetIndices(LEFT_TOP_INSIDE)).toEqual([0, 1, 2]); // the inner side of the same molars
    expect(targetIndices(RIGHT_TOP_SIDE)).toEqual([9, 8, 7]);
  });

  it("puts every targeted tooth inside the spotlight window", () => {
    const box = spotlightWindow(FRONT_TOP);
    for (const i of targetIndices(FRONT_TOP)) {
      const t = UPPER_TEETH[i];
      expect(t.x0).toBeGreaterThanOrEqual(box.x);
      expect(t.x1).toBeLessThanOrEqual(box.x + box.w);
    }
  });
});

describe("molar zoom", () => {
  it("zooms only on cheek-side molar steps, on the right side, within the drawing", () => {
    expect(zoomViewBox(FRONT_TOP)).toBe(FULL_VIEWBOX);
    expect(zoomViewBox(LEFT_TOP_CHEWING)).toBe(FULL_VIEWBOX);
    expect(zoomViewBox(INSIDE_TOP)).toBe(FULL_VIEWBOX); // the front teeth are seen whole
    expect(zoomViewBox(LEFT_TOP_INSIDE)).toBe(zoomViewBox(LEFT_TOP_SIDE)); // the inner side zooms on the same molars
    const [x, y, w, h] = zoomViewBox(LEFT_TOP_SIDE).split(" ").map(Number);
    expect(w).toBeCloseTo(VIEW_W / ZOOM, 0);
    expect(h).toBeCloseTo(VIEW_H / ZOOM, 0);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    const [xRight] = zoomViewBox(RIGHT_TOP_SIDE).split(" ").map(Number);
    expect(xRight).toBeGreaterThan(x);
  });
});

describe("brush path", () => {
  it("goes across every targeted tooth and back", () => {
    const plan = brushPlan(FRONT_TOP);
    expect(plan.points).toHaveLength(4);
    expect(brushPosition(plan, 0)).toEqual(plan.points[0]);
    expect(brushPosition(plan, plan.passSeconds).x).toBeCloseTo(plan.points[3].x);
    expect(brushPosition(plan, 2 * plan.passSeconds).x).toBeCloseTo(plan.points[0].x);
  });

  it("uses the right gesture and layer per view", () => {
    expect(brushPlan(FRONT_TOP).gesture).toBe("circles");
    expect(brushPlan(INSIDE_TOP)).toMatchObject({ gesture: "flick-down", layer: "back" });
    expect(brushPlan(LEFT_TOP_INSIDE)).toMatchObject({ gesture: "flick-down", layer: "back" });
    expect(brushPlan(LEFT_TOP_INSIDE).points).toHaveLength(3);
    expect(brushPlan(LEFT_TOP_SIDE).gesture).toBe("scrub");
    expect(brushPlan(LEFT_TOP_CHEWING).gesture).toBe("slide");
  });
});

describe("shine", () => {
  it("makes a tooth shiny when the brush first reaches it", () => {
    const pass = brushPlan(FRONT_TOP).passSeconds;
    expect(isSurfaceShiny("upper", 3, "outer", FRONT_TOP, 0)).toBe(true); // first tooth, brush starts there
    expect(isSurfaceShiny("upper", 6, "outer", FRONT_TOP, 0)).toBe(false);
    expect(isSurfaceShiny("upper", 6, "outer", FRONT_TOP, pass)).toBe(true);
  });

  it("keeps earlier steps shiny and later steps matte", () => {
    expect(isSurfaceShiny("upper", 4, "outer", LEFT_TOP_SIDE, 0)).toBe(true); // front done in step 1
    expect(isSurfaceShiny("upper", 8, "outer", LEFT_TOP_SIDE, 0)).toBe(false); // right molars later
    expect(isSurfaceShiny("lower", 4, "outer", LEFT_TOP_SIDE, 0)).toBe(false); // lower arch later
    expect(isSurfaceShiny("upper", 0, "top", LEFT_TOP_SIDE, 5)).toBe(false); // tops come after cheek side
  });

  it("shines everywhere once finished", () => {
    expect(isSurfaceShiny("lower", 9, "top", FRONT_TOP, 0, true)).toBe(true);
  });
});
