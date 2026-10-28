// Every sentence Quenottes says out loud. Pre-recorded with ElevenLabs by
// scripts/generate-voice.mjs (run it after changing any of these texts).
// The ".ts" extension lets Node import this file directly in that script.
import { BRUSHING_ZONES } from "./brushingZones.ts";
import { TIP_VOICE_LINES } from "./toothpasteTip.ts";

export const FINISH_LINE = "Bravo, tout brille\u00A0!";
export const CELEBRATION_LINE = "Bravo\u00A0! Tes dents sont toutes propres et brillantes\u00A0!";
export const CELEBRATION_LINE_TOGETHER = "Bravo\u00A0! Vos dents sont toutes propres et brillantes\u00A0!";

export const VOICE_LINES: string[] = [
  ...new Set([...BRUSHING_ZONES.flatMap((z) => z.phases.map((p) => p.instruction)), FINISH_LINE, CELEBRATION_LINE, CELEBRATION_LINE_TOGETHER, ...TIP_VOICE_LINES]),
];
