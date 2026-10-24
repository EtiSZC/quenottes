import { describe, it, expect } from "vitest";
import manifest from "./voice-manifest.json";
import { VOICE_LINES } from "./voiceLines";
import {
  PARENT_TIP,
  TIP_ANNOUNCE,
  TIP_FOOTNOTE,
  TIP_SCENE_LABEL,
  TIP_TITLE,
  TIP_TOO_MUCH_BUTTON,
  TIP_VOICE_LINES,
} from "./toothpasteTip";

const allText = [
  TIP_TITLE,
  TIP_SCENE_LABEL,
  TIP_TOO_MUCH_BUTTON,
  TIP_FOOTNOTE,
  ...TIP_VOICE_LINES,
  ...Object.values(TIP_ANNOUNCE),
  PARENT_TIP.title,
  ...PARENT_TIP.lines,
  PARENT_TIP.sources,
];

describe("toothpaste tip copy", () => {
  it("has four distinct, short voice lines", () => {
    expect(TIP_VOICE_LINES).toHaveLength(4);
    expect(new Set(TIP_VOICE_LINES).size).toBe(4);
    TIP_VOICE_LINES.forEach((line) => expect(line.length).toBeLessThanOrEqual(60));
  });

  it("every voice line is recorded (run scripts/generate-voice.mjs if this fails)", () => {
    const clips = manifest as Record<string, string>;
    TIP_VOICE_LINES.forEach((line) => {
      expect(VOICE_LINES).toContain(line);
      expect(clips[line], line).toBeTruthy();
    });
  });

  it("writes French punctuation with a non-breaking space", () => {
    allText.forEach((text) => {
      expect(text).not.toMatch(/ [!?]/); // a plain space before ! or ?
      expect(text).not.toMatch(/[^\s][!?]/); // punctuation glued to a word
    });
  });

  it("never shows fluoride ppm, scores, germs, guilt or sweets", () => {
    const text = allText.join(" ").toLowerCase();
    [/ppm/, /score/, /microbe/, /germe/, /triste/, /bonbon/, /sucre/].forEach((bad) =>
      expect(text).not.toMatch(bad),
    );
  });

  it("names its sources and sends doubtful cases to a professional", () => {
    expect(PARENT_TIP.sources).toMatch(/Haute Autorité de santé/);
    expect(PARENT_TIP.sources).toMatch(/ameli/);
    expect(PARENT_TIP.sources).toMatch(/professionnel/);
    expect(PARENT_TIP.lines.join(" ")).toMatch(/petit pois à partir de 3 ans/);
  });
});
