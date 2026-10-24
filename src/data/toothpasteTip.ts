// Copy of the « Le petit pois » toothpaste tip. The voice lines are pre-recorded by
// scripts/generate-voice.mjs (run it after changing them), which imports this file from
// Node: keep it plain strings, no "@/" alias and no JSX.
//
// Sources: HAS « Stratégies de prévention de la carie dentaire » and ameli « Prévenir les
// caries dentaires » agree on a pea-sized amount from 3 years and on spitting without
// rinsing. They disagree on under-3s and on fluoride ppm, so neither is shown here.

export const TIP_TITLE = "Le petit pois";

/** Spoken when the tip opens. */
export const TIP_OPEN_LINE = "Un petit pois de dentifrice, pas plus !";
/** Spoken once the pea has landed on the brush. */
export const TIP_PEA_LINE = "Parfait ! Juste un petit pois.";
/** Spoken with the oversized blob. */
export const TIP_TOO_MUCH_LINE = "Oh là là, trop ! Un petit pois suffit.";
/** Spoken after the pea line: « don't rinse » in positive form. */
export const TIP_SPIT_LINE = "Après, on crache, et c'est tout !";

export const TIP_VOICE_LINES: string[] = [TIP_OPEN_LINE, TIP_PEA_LINE, TIP_TOO_MUCH_LINE, TIP_SPIT_LINE];

export const TIP_TOO_MUCH_BUTTON = "Trop ?";
export const TIP_FOOTNOTE = "On crache, on ne rince pas. Un adulte aide jusqu'à 6 ans.";

/** What a screen reader hears: the whole scene, then each change. */
export const TIP_SCENE_LABEL = "Un tube de dentifrice dépose un petit pois sur une brosse à dents";
export const TIP_ANNOUNCE = {
  empty: "",
  pea: "Un petit pois sur la brosse",
  blob: "Trop de dentifrice sur la brosse. Un petit pois suffit.",
} as const;

/** « Dentifrice : les repères » card of the parents area. */
export const PARENT_TIP = {
  title: "🪥 Dentifrice : les repères",
  lines: [
    "Un petit pois à partir de 3 ans. Avant 3 ans, demandez conseil à votre dentiste.",
    "On crache l'excès et on ne se rince pas la bouche : les fluorures continuent de protéger les dents. Un adulte brosse avant 6 ans.",
    "Teneur en fluor adaptée à l'âge : lisez l'étiquette ou demandez à votre dentiste ou pharmacien.",
  ],
  sources: "Sources : Haute Autorité de santé, ameli. En cas de doute, demandez à un professionnel.",
} as const;
