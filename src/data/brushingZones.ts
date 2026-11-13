export type ToothRegion =
  | "upper-front"
  | "upper-back"
  | "upper-left"
  | "upper-right"
  | "lower-front"
  | "lower-back"
  | "lower-left"
  | "lower-right";

/**
 * How the mouth is shown during a phase:
 * - front: smile view, outer surfaces of the front teeth
 * - inside: smile view with see-through teeth, brush behind them (inner surfaces)
 * - side: smile view zoomed on one side's molars (cheek side)
 * - side-inside: the same zoom on one side's molars, teeth see-through, brush behind them (inner surfaces)
 * - top: top-down view of the arch (chewing surfaces of the molars)
 */
export type MouthView = "front" | "inside" | "side" | "side-inside" | "top";

export interface ZonePhase {
  view: MouthView;
  durationSeconds: number;
  instruction: string;
}

export interface BrushingZone {
  id: number;
  label: string;
  region: ToothRegion;
  arch: "upper" | "lower";
  /** Background colour family (HSL hue): upper = blue 200, lower = peach 25 */
  hue: number;
  /** A step can chain several views (molars: cheek side, then top). */
  phases: ZonePhase[];
  /** Sum of the phase durations. */
  durationSeconds: number;
}

function zone(id: number, label: string, region: ToothRegion, phases: ZonePhase[]): BrushingZone {
  const arch = region.startsWith("upper") ? "upper" : "lower";
  return {
    id,
    label,
    region,
    arch,
    hue: arch === "upper" ? 200 : 25,
    phases,
    durationSeconds: phases.reduce((sum, p) => sum + p.durationSeconds, 0),
  };
}

// Same order for each arch: outside → inside (front teeth) → back teeth left → back teeth right;
// each back-teeth step goes cheek side → inside → top. Every part gets the same time: 8 parts per arch
// (front outside, front inside, and cheek / inside / top for each side) × 11.25 s = 90 s per arch.
export const BRUSHING_ZONES: BrushingZone[] = [
  zone(1, "Devant en haut", "upper-front", [
    { view: "front", durationSeconds: 11.25, instruction: "Brosse le devant des dents du haut\u00A0!" },
  ]),
  zone(2, "Derrière en haut", "upper-back", [
    { view: "inside", durationSeconds: 11.25, instruction: "Maintenant, le derrière des dents du haut\u00A0!" },
  ]),
  zone(3, "Fond en haut à gauche", "upper-left", [
    { view: "side", durationSeconds: 11.25, instruction: "Les dents du fond en haut à gauche, côté joue\u00A0!" },
    { view: "side-inside", durationSeconds: 11.25, instruction: "Et l'intérieur des dents du fond, en haut à gauche\u00A0!" },
    { view: "top", durationSeconds: 11.25, instruction: "Et maintenant, le dessus des dents du fond\u00A0!" },
  ]),
  zone(4, "Fond en haut à droite", "upper-right", [
    { view: "side", durationSeconds: 11.25, instruction: "Les dents du fond en haut à droite, côté joue\u00A0!" },
    { view: "side-inside", durationSeconds: 11.25, instruction: "L'intérieur des dents du fond, en haut à droite\u00A0!" },
    { view: "top", durationSeconds: 11.25, instruction: "Le dessus des dents du fond, à droite\u00A0!" },
  ]),
  zone(5, "Devant en bas", "lower-front", [
    { view: "front", durationSeconds: 11.25, instruction: "On passe en bas ! Le devant des dents\u00A0!" },
  ]),
  zone(6, "Derrière en bas", "lower-back", [
    { view: "inside", durationSeconds: 11.25, instruction: "Et le derrière des dents du bas\u00A0!" },
  ]),
  zone(7, "Fond en bas à gauche", "lower-left", [
    { view: "side", durationSeconds: 11.25, instruction: "Les dents du fond en bas à gauche, côté joue\u00A0!" },
    { view: "side-inside", durationSeconds: 11.25, instruction: "Et l'intérieur des dents du fond, en bas à gauche\u00A0!" },
    { view: "top", durationSeconds: 11.25, instruction: "Et maintenant, le dessus des dents du fond\u00A0!" },
  ]),
  zone(8, "Fond en bas à droite", "lower-right", [
    { view: "side", durationSeconds: 11.25, instruction: "Les dents du fond en bas à droite, côté joue\u00A0!" },
    { view: "side-inside", durationSeconds: 11.25, instruction: "L'intérieur des dents du fond, en bas à droite\u00A0!" },
    { view: "top", durationSeconds: 11.25, instruction: "Le dessus des dents du fond, à droite\u00A0!" },
  ]),
];

// Total = 180 seconds = 3 minutes
export const TOTAL_DURATION = BRUSHING_ZONES.reduce((sum, z) => sum + z.durationSeconds, 0);

/** Second at which each zone starts: [0, 22, 44, ...]. */
export const ZONE_STARTS = BRUSHING_ZONES.map((_, i) =>
  BRUSHING_ZONES.slice(0, i).reduce((sum, z) => sum + z.durationSeconds, 0),
);

/**
 * Zone index and seconds spent in it, derived from total elapsed seconds.
 * Returns the last zone (fully elapsed) once the session is over.
 */
export function getZoneAt(elapsedSeconds: number): { index: number; zoneElapsed: number } {
  const t = Math.max(0, elapsedSeconds);
  for (let i = BRUSHING_ZONES.length - 1; i >= 0; i--) {
    if (t >= ZONE_STARTS[i]) {
      return {
        index: i,
        zoneElapsed: Math.min(t - ZONE_STARTS[i], BRUSHING_ZONES[i].durationSeconds),
      };
    }
  }
  return { index: 0, zoneElapsed: 0 };
}

/** Phase index inside a zone and (fractional) seconds spent in that phase. */
export function getPhaseAt(zoneIndex: number, secondsIntoZone: number): { phaseIndex: number; phaseElapsed: number } {
  const phases = BRUSHING_ZONES[zoneIndex].phases;
  let start = 0;
  for (let i = 0; i < phases.length; i++) {
    const end = start + phases[i].durationSeconds;
    if (secondsIntoZone < end || i === phases.length - 1) {
      return { phaseIndex: i, phaseElapsed: Math.min(Math.max(0, secondsIntoZone - start), phases[i].durationSeconds) };
    }
    start = end;
  }
  return { phaseIndex: 0, phaseElapsed: 0 };
}
