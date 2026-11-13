import { BRUSHING_ZONES, type MouthView } from "@/data/brushingZones";

/**
 * Mouth drawings on a 320x260 canvas:
 * - "smile": front-facing open mouth (front, inside and zoomed molar-side views)
 * - "arch": top-down view of one arch (chewing surfaces)
 * Mirror convention: the phone faces the child like a mirror, so screen-left is
 * the child's left ("left" teeth are drawn on the left of the screen).
 */

export const VIEW_W = 320;
export const VIEW_H = 260;
const CX = VIEW_W / 2;
export const FULL_VIEWBOX = `0 0 ${VIEW_W} ${VIEW_H}`;

export type Arch = "upper" | "lower";
export type Side = "left" | "front" | "right";

export const LIPS_PATH = "M8,80 C52,24 268,24 312,80 C314,192 238,254 160,254 C82,254 6,192 8,80 Z";
export const CAVITY_PATH = "M24,88 C66,48 254,48 296,88 C296,184 228,238 160,238 C92,238 24,184 24,88 Z";
export const TONGUE = { cx: CX, cy: 170, rx: 72, ry: 36 };

/** Gum line of the upper teeth (teeth hang down from it). */
export const upperGumY = (x: number) => 82 + 0.0015 * (x - CX) ** 2;
/** Gum line of the lower teeth (teeth stand up from it). */
export const lowerGumY = (x: number) => 214 - 0.0017 * (x - CX) ** 2;

// 3 molars, 4 front teeth, 3 molars — left to right on screen.
const SIDES: Side[] = ["left", "left", "left", "front", "front", "front", "front", "right", "right", "right"];
const UPPER_WIDTHS = [20, 23, 26, 29, 33, 33, 29, 26, 23, 20];
const UPPER_HEIGHTS = [22, 24, 26, 31, 38, 38, 31, 26, 24, 22];
const LOWER_WIDTHS = [15, 18, 20, 22, 25, 25, 22, 20, 18, 15];
const LOWER_HEIGHTS = [18, 20, 22, 25, 28, 28, 25, 22, 20, 18];

export interface Tooth {
  /** 0..9, left to right on screen (same index in the smile and arch views). */
  index: number;
  arch: Arch;
  side: Side;
  molar: boolean;
  d: string;
  x0: number;
  x1: number;
  cx: number;
  cy: number;
  /** Biting edge (tip) y and gum-side y. */
  tipY: number;
  gumY: number;
}

/** Rounded tooth that extends 10px into the gum; molars get two small cusps. */
function toothPath(x0: number, x1: number, gumY: number, tipY: number, molar: boolean): string {
  const r = Math.min(8, (x1 - x0) / 2.8);
  const dir = tipY > gumY ? 1 : -1; // 1 = hangs down (upper), -1 = stands up (lower)
  const root = gumY - 10 * dir;
  const mid = (x0 + x1) / 2;
  const edge = molar
    ? `Q${mid - (x1 - x0) / 4},${tipY + 2 * dir} ${mid},${tipY - 2 * dir} Q${mid + (x1 - x0) / 4},${tipY + 2 * dir} ${x1 - r},${tipY}`
    : `L${x1 - r},${tipY}`;
  return [
    `M${x0},${root}`,
    `L${x0},${tipY - r * dir}`,
    `Q${x0},${tipY} ${x0 + r},${tipY}`,
    edge,
    `Q${x1},${tipY} ${x1},${tipY - r * dir}`,
    `L${x1},${root}`,
    "Z",
  ].join(" ");
}

function buildArch(arch: Arch): Tooth[] {
  const widths = arch === "upper" ? UPPER_WIDTHS : LOWER_WIDTHS;
  const heights = arch === "upper" ? UPPER_HEIGHTS : LOWER_HEIGHTS;
  const total = widths.reduce((a, b) => a + b, 0);
  let x = CX - total / 2;
  return widths.map((w, i) => {
    const x0 = x + 1;
    const x1 = x + w - 1;
    x += w;
    const cx = (x0 + x1) / 2;
    const gumY = arch === "upper" ? upperGumY(cx) : lowerGumY(cx);
    const tipY = arch === "upper" ? gumY + heights[i] : gumY - heights[i];
    const molar = SIDES[i] !== "front";
    return { index: i, arch, side: SIDES[i], molar, d: toothPath(x0, x1, gumY, tipY, molar), x0, x1, cx, cy: (gumY + tipY) / 2, tipY, gumY };
  });
}

export const UPPER_TEETH = buildArch("upper");
export const LOWER_TEETH = buildArch("lower");
export const ALL_TEETH = [...UPPER_TEETH, ...LOWER_TEETH];
export const teethOfArch = (arch: Arch) => (arch === "upper" ? UPPER_TEETH : LOWER_TEETH);

/** Gum shapes: everything above/below the gum line, clipped to the cavity when drawn. */
function gumPolygon(gumY: (x: number) => number, edgeY: number): string {
  const pts: string[] = [];
  for (let x = 0; x <= VIEW_W; x += 8) pts.push(`${x},${gumY(x).toFixed(1)}`);
  return `M0,${edgeY} L${pts.join(" L")} L${VIEW_W},${edgeY} Z`;
}
export const UPPER_GUM_PATH = gumPolygon(upperGumY, 0);
export const LOWER_GUM_PATH = gumPolygon(lowerGumY, VIEW_H);

// ---------------------------------------------------------------------------
// Top-down arch view (chewing surfaces)
// ---------------------------------------------------------------------------

export const ARCH_ELLIPSE = { cx: CX, cy: 225, rx: 110, ry: 175 };
/** Angle (degrees) of each tooth on the half-ellipse: back-left molar → back-right molar. */
const ARCH_ANGLES = [172, 156, 140, 122, 101, 79, 58, 40, 24, 8];
const ARCH_SIZES = [34, 32, 30, 22, 26, 26, 22, 30, 32, 34];

export interface ArchTooth {
  index: number;
  side: Side;
  molar: boolean;
  cx: number;
  cy: number;
  /** Rotation (degrees) following the curve of the arch. */
  rotate: number;
  size: number;
}

export const ARCH_TEETH: ArchTooth[] = ARCH_ANGLES.map((deg, i) => {
  const a = (deg * Math.PI) / 180;
  return {
    index: i,
    side: SIDES[i],
    molar: SIDES[i] !== "front",
    cx: ARCH_ELLIPSE.cx + ARCH_ELLIPSE.rx * Math.cos(a),
    cy: ARCH_ELLIPSE.cy - ARCH_ELLIPSE.ry * Math.sin(a),
    rotate: 90 - deg,
    size: ARCH_SIZES[i],
  };
});

/** Gum band of the arch view: half-ellipse through the tooth centres. */
export const ARCH_GUM_PATH = `M${CX - ARCH_ELLIPSE.rx},${ARCH_ELLIPSE.cy} A${ARCH_ELLIPSE.rx},${ARCH_ELLIPSE.ry} 0 0 1 ${CX + ARCH_ELLIPSE.rx},${ARCH_ELLIPSE.cy}`;

// ---------------------------------------------------------------------------
// Steps → targets, spotlight, zoom
// ---------------------------------------------------------------------------

export interface StepRef {
  zoneIndex: number;
  phaseIndex: number;
}

export function stepInfo({ zoneIndex, phaseIndex }: StepRef) {
  const zone = BRUSHING_ZONES[zoneIndex];
  const view: MouthView = zone.phases[phaseIndex].view;
  const side: Side = zone.region.endsWith("left") ? "left" : zone.region.endsWith("right") ? "right" : "front";
  return { zone, view, arch: zone.arch as Arch, side };
}

/** Views drawn with see-through teeth and the brush behind them (inner surfaces). */
export const showsInside = (view: MouthView) => view === "inside" || view === "side-inside";

/** Tooth indices (0..9) targeted by a step. Molars are listed back to front. */
export function targetIndices(step: StepRef): number[] {
  const { side } = stepInfo(step);
  if (side === "front") return [3, 4, 5, 6];
  return side === "left" ? [0, 1, 2] : [9, 8, 7];
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 8;

/** Window cut out of the dark veil around the targeted teeth. */
export function spotlightWindow(step: StepRef): Box {
  const { view, arch } = stepInfo(step);
  const ids = targetIndices(step);
  if (view === "top") {
    const teeth = ids.map((i) => ARCH_TEETH[i]);
    const x0 = Math.min(...teeth.map((t) => t.cx - t.size / 2 - 4));
    const x1 = Math.max(...teeth.map((t) => t.cx + t.size / 2 + 4));
    const y0 = Math.min(...teeth.map((t) => t.cy - t.size / 2 - 4));
    const y1 = Math.max(...teeth.map((t) => t.cy + t.size / 2 + 4));
    return { x: x0 - PAD, y: y0 - PAD, w: x1 - x0 + 2 * PAD, h: y1 - y0 + 2 * PAD };
  }
  const teeth = ids.map((i) => teethOfArch(arch)[i]);
  const x0 = Math.min(...teeth.map((t) => t.x0));
  const x1 = Math.max(...teeth.map((t) => t.x1));
  const y0 = Math.min(...teeth.flatMap((t) => [t.gumY, t.tipY]));
  const y1 = Math.max(...teeth.flatMap((t) => [t.gumY, t.tipY]));
  return { x: x0 - PAD, y: y0 - PAD, w: x1 - x0 + 2 * PAD, h: y1 - y0 + 2 * PAD };
}

export const ZOOM = 1.9;

/** viewBox of the smile drawing: zoomed on the molars for "side" and "side-inside" steps, full otherwise. */
export function zoomViewBox(step: StepRef): string {
  const { view, arch } = stepInfo(step);
  if (view !== "side" && view !== "side-inside") return FULL_VIEWBOX;
  const teeth = targetIndices(step).map((i) => teethOfArch(arch)[i]);
  const cx = teeth.reduce((s, t) => s + t.cx, 0) / teeth.length;
  const cy = teeth.reduce((s, t) => s + t.cy, 0) / teeth.length;
  const w = VIEW_W / ZOOM;
  const h = VIEW_H / ZOOM;
  const x = Math.min(Math.max(cx - w / 2, 0), VIEW_W - w);
  const y = Math.min(Math.max(cy - h / 2, 0), VIEW_H - h);
  return `${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`;
}

// ---------------------------------------------------------------------------
// Toothbrush path
// ---------------------------------------------------------------------------

export type Gesture = "circles" | "flick-down" | "flick-up" | "scrub" | "slide";

export interface BrushPlan {
  /** Points visited in order (ping-pong), one per targeted tooth. */
  points: { x: number; y: number }[];
  /** Seconds for one pass from the first to the last point. */
  passSeconds: number;
  /** SVG transform orienting the brush (drawn horizontally, bristles up, handle to the right). */
  orient: string;
  /** Visible handle length; short when the handle points at the viewer (inner surfaces). */
  handle: number;
  gesture: Gesture;
  /** "back" = drawn behind the (see-through) teeth. */
  layer: "front" | "back";
}

export function brushPlan(step: StepRef): BrushPlan {
  const { view, arch, side } = stepInfo(step);
  const ids = targetIndices(step);
  const upper = arch === "upper";

  if (view === "top") {
    return {
      points: ids.map((i) => ({ x: ARCH_TEETH[i].cx, y: ARCH_TEETH[i].cy })),
      passSeconds: 2,
      orient: side === "left" ? "scale(-1,1)" : "",
      handle: 64,
      gesture: "slide",
      layer: "front",
    };
  }
  const teeth = ids.map((i) => teethOfArch(arch)[i]);
  if (showsInside(view)) {
    return {
      points: teeth.map((t) => ({ x: t.cx, y: upper ? t.gumY + 12 : t.gumY - 12 })),
      passSeconds: view === "inside" ? 4 : 3,
      // Vertical brush behind the teeth, short handle pointing out of the mouth.
      orient: upper ? "rotate(90)" : "rotate(-90)",
      handle: 22,
      gesture: upper ? "flick-down" : "flick-up",
      layer: "back",
    };
  }
  if (view === "side") {
    const flipX = side === "left" ? -1 : 1;
    return {
      points: teeth.map((t) => ({ x: t.cx, y: t.cy })),
      passSeconds: 2.5,
      orient: `scale(${flipX},${upper ? 1 : -1})`,
      handle: 64,
      gesture: "scrub",
      layer: "front",
    };
  }
  return {
    points: teeth.map((t) => ({ x: t.cx, y: t.cy })),
    passSeconds: 3,
    orient: upper ? "" : "scale(1,-1)",
    handle: 64,
    gesture: "circles",
    layer: "front",
  };
}

/** Brush position after `t` seconds: back and forth along the points. */
export function brushPosition(plan: BrushPlan, t: number): { x: number; y: number } {
  const { points, passSeconds } = plan;
  if (points.length === 1) return points[0];
  const cycle = Math.max(0, t) % (2 * passSeconds);
  const u = cycle <= passSeconds ? cycle / passSeconds : 2 - cycle / passSeconds;
  const f = u * (points.length - 1);
  const i = Math.min(Math.floor(f), points.length - 2);
  const k = f - i;
  return {
    x: points[i].x + (points[i + 1].x - points[i].x) * k,
    y: points[i].y + (points[i + 1].y - points[i].y) * k,
  };
}

/** How many targets the brush has reached during its first pass after `t` seconds. */
export function reachedCount(plan: BrushPlan, t: number): number {
  const n = plan.points.length;
  if (t >= plan.passSeconds) return n;
  return Math.floor((Math.max(0, t) / plan.passSeconds) * (n - 1) + 1e-9) + 1;
}

// ---------------------------------------------------------------------------
// Shine: surfaces go from matte to shiny when the brush first reaches them
// ---------------------------------------------------------------------------

/** The step (zone, phase) that brushes a tooth's outer face or chewing top. */
function stepForSurface(arch: Arch, index: number, surface: "outer" | "top"): StepRef | null {
  const side = SIDES[index];
  for (let z = 0; z < BRUSHING_ZONES.length; z++) {
    const zone = BRUSHING_ZONES[z];
    if (zone.arch !== arch) continue;
    for (let p = 0; p < zone.phases.length; p++) {
      const ref = { zoneIndex: z, phaseIndex: p };
      const info = stepInfo(ref);
      if (info.side !== side) continue;
      if (surface === "outer" && (info.view === "front" || info.view === "side")) return ref;
      if (surface === "top" && info.view === "top") return ref;
    }
  }
  return null;
}

const compare = (a: StepRef, b: StepRef) => a.zoneIndex - b.zoneIndex || a.phaseIndex - b.phaseIndex;

/**
 * Is this surface already brushed? Earlier steps: yes. Later steps: no.
 * Current step: once the brush's first pass has reached that tooth.
 * Front-teeth tops are never a separate step, so they count as their outer face.
 */
export function isSurfaceShiny(
  arch: Arch,
  index: number,
  surface: "outer" | "top",
  current: StepRef,
  phaseElapsed: number,
  finished = false,
): boolean {
  if (finished) return true;
  const ref = stepForSurface(arch, index, surface) ?? stepForSurface(arch, index, "outer");
  if (!ref) return false;
  const order = compare(ref, current);
  if (order < 0) return true;
  if (order > 0) return false;
  const position = targetIndices(current).indexOf(index);
  return position >= 0 && position < reachedCount(brushPlan(current), phaseElapsed);
}
